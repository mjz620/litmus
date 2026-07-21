"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  applyLabDraftTransaction,
  deserializeLabDraft,
  inspectLabDraftRemoval,
  serializeLabDraft,
  type LabDraftCommand,
  type LabDraftRemovalImpact,
  type LabDraftRemovalResolution,
  type LabDraftRemovalTarget
} from "../../../lab-workflows/authoring";
import { NATIVE_TITRATION_V2_DRAFT } from "../../../lab-workflows/definitions/titration/native-endpoint-control";
import { hashLabWorkflowSpec } from "../../../lab-workflows/hash";
import type { WorkflowRule } from "../../../lab-workflows/schema/conditions";
import {
  labWorkflowDraftV2Schema,
  type LabWorkflowDraftV2
} from "../../../lab-workflows/schema/v2";
import { componentRegistry } from "../../../lab-workflows/registries/components";
import {
  defaultPlacementForEquipment,
  planVerifiedLayoutMove
} from "../../../lab-workflows/registries/scene-placements";
import {
  evaluateLabWorkflowEligibilityV2,
  validateLabWorkflowSpecV2,
  type LabWorkflowV2ValidationOutcome
} from "../../../lab-workflows/validation";
import {
  composerActionCatalog,
  composerLabTemplateCatalog,
  composerObservableCatalog,
  quantityPresetsFor,
  type ComposerLabTemplateId
} from "./catalog";
import {
  LocalLabDraftRepository,
  LocalLabPreviewRepository
} from "./localRepository";
import {
  ComposerStageChrome,
  ComposerStageFooter
} from "./ComposerStageChrome";
import {
  ComposerAgentWorkspace,
  type ComposerAgentEvidenceState
} from "./ComposerAgentWorkspace";
import { ComposerDefineStage } from "./ComposerDefineStage";
import { ComposerAssessWorkspace } from "./ComposerAssessWorkspace";
import { ComposerRemovalDialog } from "./ComposerRemovalDialog";
import { ComposerSetupWorkspace } from "./ComposerSetupWorkspace";
import { ComposerValidationIssues } from "./ComposerValidationIssues";
import { ComposerWorkflowGraph } from "./ComposerWorkflowGraph";
import { ComposerAgentLoopTab } from "./ComposerAgentLoopTab";
import type { ComposerStageId } from "./composerStages";
import {
  CapabilityAuthorClientError,
  requestCapabilityAuthorProposal
} from "./capabilityAuthorClient";
import {
  applyComposerJudgeSuggestion,
  COMPOSER_JUDGE_CALL_LIMIT,
  COMPOSER_JUDGE_REVISION_LIMIT,
  createComposerJudgeSuggestions,
  reviewComposerWorkflow,
  type ComposerJudgeSuggestion
} from "./composerJudgeCycle";
import {
  ComposerJudgePanel,
  type ComposerJudgeHistoryEntry,
  type ComposerJudgeStatus
} from "./ComposerJudgePanel";
import { restoreDraftSnapshot } from "./draftHistory";
import type {
  CapabilityAuthorProgress,
  CapabilityAuthorSuccessResponse,
  CapabilityAuthorTraceSummary
} from "../../../lib/agent/lab-authoring/capabilityAuthorSchemas";
import type { WorkflowJudgeResponse } from "../../../lib/agent/lab-workflow-judge/schemas";
import {
  approveComposerDraft,
  createComposerAssignment,
  listComposerDrafts,
  listTeacherClasses,
  saveComposerDraft,
  type TeacherClassSummary
} from "../../../lib/persistence/composerDefinitionClient";

import styles from "./LabComposer.module.css";

const COMPOSER_RETURN_DRAFT_KEY = "labbench.composer.return-draft.v1";
const HISTORY_LIMIT = 50;
const AGENT_PROPOSAL_REQUEST_LIMIT = 3;

function localId(prefix: string, revision: number): string {
  return `teacher.${prefix}.${revision}`;
}

function draftRepository(): LocalLabDraftRepository {
  if (typeof window === "undefined")
    throw new TypeError(
      "Local draft storage is available in the browser only."
    );
  return new LocalLabDraftRepository(window.localStorage);
}

function previewRepository(): LocalLabPreviewRepository {
  if (typeof window === "undefined")
    throw new TypeError(
      "Local preview storage is available in the browser only."
    );
  return new LocalLabPreviewRepository(window.localStorage);
}

function titleCaseIdentifier(value: string): string {
  return value
    .replace(
      /^(action|observable|observation|submission|event|flag|rule)\./,
      ""
    )
    .replace(/\.v\d+$/, "")
    .replaceAll(/[._-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replaceAll(/\bMl\b/g, "mL")
    .replaceAll(/\bPh\b/g, "pH");
}

function teacherCommandError(code: string): string {
  switch (code) {
    case "authoring.registry_unknown.v1":
      return "That option is no longer available. Refresh the page and choose again.";
    case "authoring.registry_unavailable.v1":
      return "That option is not available in the current supported simulation.";
    case "authoring.duplicate_id.v1":
      return "That item has already been added.";
    case "authoring.reference_missing.v1":
      return "A related item is missing. Review this section and choose an available option.";
    case "authoring.incompatible.v1":
      return "Those choices cannot work together in the current supported simulation.";
    case "authoring.dependency_exists.v1":
      return "This item is still used elsewhere. Use Remove to review what else will change.";
    case "authoring.bounds_exceeded.v1":
      return "Enter a value within the allowed range.";
    case "authoring.ordering_cycle.v1":
      return "That order would create a loop. Choose a different first or next card.";
    case "authoring.revision_conflict.v1":
    case "authoring.removal_plan_stale.v1":
      return "The lab changed while you were working. Review the latest version and try again.";
    case "authoring.removal_confirmation_required.v1":
      return "Confirm the related changes before removing this item.";
    default:
      return "That change could not be applied. Review the highlighted choices and try again.";
  }
}

function ruleLabel(
  rule: Readonly<WorkflowRule>,
  rules: readonly Readonly<WorkflowRule>[]
): string {
  const condition = rule.condition;
  switch (condition.kind) {
    case "action_observed":
    case "action_count_within_range":
      return (
        composerActionCatalog.find(({ id }) => id === condition.actionId)
          ?.purpose ?? titleCaseIdentifier(condition.actionId)
      );
    case "observable_within_tolerance":
      return `${titleCaseIdentifier(condition.observableId)} from ${condition.minimum} to ${condition.maximum}`;
    case "rule_satisfied_before": {
      const predecessor = rules.find(
        ({ id }) => id === condition.predecessorRuleId
      );
      const successor = rules.find(
        ({ id }) => id === condition.successorRuleId
      );
      return `${predecessor ? ruleLabel(predecessor, rules) : "Earlier evidence"} must happen before ${successor ? ruleLabel(successor, rules) : "later evidence"}`;
    }
    case "event_flag":
      return `${titleCaseIdentifier(condition.flagId)} must be ${condition.presence}`;
    case "semantic_event_observed":
      return titleCaseIdentifier(condition.eventTypeId);
    case "observation_recorded":
      return `Record ${titleCaseIdentifier(condition.observationKeyId)}`;
    case "material_bound_to_container":
      return "Required material is placed in its container";
    case "equipment_capability_present":
      return `Equipment can ${condition.capabilityId.replaceAll("-", " ")}`;
    case "student_response_submitted":
      return `Submit ${titleCaseIdentifier(condition.submissionFieldId)}`;
    case "registered_completion_policy_satisfied":
      return "Complete the required lab steps";
    case "equipment_state_equals":
      return `Equipment reaches ${titleCaseIdentifier(condition.stateFieldKey)}`;
    case "forbidden_state_never_reached":
      return `Avoid forbidden ${titleCaseIdentifier(condition.stateFieldKey)}`;
  }
}

function ruleRole(rule: Readonly<WorkflowRule>): string {
  if (rule.severity === "safety" || rule.kind === "forbidden") return "Safety";
  switch (rule.kind) {
    case "success":
      return "Success";
    case "failure":
      return "Failure";
    case "best_practice":
      return "Best practice";
    case "ordering":
      return "Required order";
    case "scoring":
      return "Scoring evidence";
    default:
      return "Required";
  }
}

export function LabComposer() {
  const [draft, setDraft] = useState<Readonly<LabWorkflowDraftV2>>(
    NATIVE_TITRATION_V2_DRAFT
  );
  const [stage, setStage] = useState<ComposerStageId>("define");
  const [undoStack, setUndoStack] = useState<
    readonly Readonly<LabWorkflowDraftV2>[]
  >([]);
  const [redoStack, setRedoStack] = useState<
    readonly Readonly<LabWorkflowDraftV2>[]
  >([]);
  const [isValidating, setIsValidating] = useState(false);
  const stageHeadingRef = useRef<HTMLHeadingElement>(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>(
    draft.equipment[0]?.instanceId ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [, setErrorPath] = useState<string | null>(null);
  const [ruleKind, setRuleKind] = useState<
    "required" | "best_practice" | "scoring"
  >("required");
  const [ruleConditionType, setRuleConditionType] = useState<
    "action" | "tolerance"
  >("action");
  const [ruleObjectiveId, setRuleObjectiveId] = useState(
    draft.objectiveIds[0] ?? ""
  );
  const [ruleSeverity, setRuleSeverity] = useState<
    "info" | "best-practice" | "procedural" | "conceptual" | "safety"
  >("procedural");
  const [ruleRecoverable, setRuleRecoverable] = useState(true);
  const [ruleTerminal, setRuleTerminal] = useState(false);
  const [toleranceMinimum, setToleranceMinimum] = useState("24.95");
  const [toleranceMaximum, setToleranceMaximum] = useState("25.05");
  const [instructionTitle, setInstructionTitle] = useState("");
  const [instructionGuidance, setInstructionGuidance] = useState("");
  const [instructionRuleId, setInstructionRuleId] = useState(
    draft.rules[0]?.id ?? ""
  );
  const [validationOutcome, setValidationOutcome] =
    useState<LabWorkflowV2ValidationOutcome | null>(null);
  const [draftName, setDraftName] = useState("Endpoint practice");
  const [savedDraftNames, setSavedDraftNames] = useState<readonly string[]>([]);
  const [selectedSavedDraft, setSelectedSavedDraft] = useState("");
  const [serverDraftId, setServerDraftId] = useState<string | null>(null);
  const [serverStorageRevision, setServerStorageRevision] = useState<
    number | null
  >(null);
  const [teacherClasses, setTeacherClasses] = useState<
    readonly TeacherClassSummary[]
  >([]);
  const [teacherSignedIn, setTeacherSignedIn] = useState<boolean | null>(null);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [repositoryMessage, setRepositoryMessage] = useState<string | null>(
    null
  );
  const [itemErrors, setItemErrors] = useState<
    Readonly<Record<string, string | undefined>>
  >({});
  const [removalImpact, setRemovalImpact] =
    useState<Readonly<LabDraftRemovalImpact> | null>(null);
  const [removalLabel, setRemovalLabel] = useState("");
  const [removalError, setRemovalError] = useState<string | null>(null);
  const [removalReturnFocus, setRemovalReturnFocus] =
    useState<HTMLElement | null>(null);
  const [pendingReplacement, setPendingReplacement] = useState<{
    readonly definitionId: string;
    readonly slotId: string;
  } | null>(null);
  const [newLabMenuOpen, setNewLabMenuOpen] = useState(false);
  const [agentTeacherRequest, setAgentTeacherRequest] = useState("");
  const [agentProposal, setAgentProposal] =
    useState<CapabilityAuthorSuccessResponse | null>(null);
  const [agentEvidenceState, setAgentEvidenceState] =
    useState<ComposerAgentEvidenceState | null>(null);
  const [agentRequestsRemaining, setAgentRequestsRemaining] = useState(
    AGENT_PROPOSAL_REQUEST_LIMIT
  );
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentProgressUpdates, setAgentProgressUpdates] = useState<
    readonly CapabilityAuthorProgress[]
  >([]);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [judgeStatus, setJudgeStatus] = useState<ComposerJudgeStatus>("idle");
  const [judgeReview, setJudgeReview] = useState<WorkflowJudgeResponse | null>(
    null
  );
  const [judgeTraces, setJudgeTraces] = useState<
    readonly CapabilityAuthorTraceSummary[] | null
  >(null);
  const [judgeHistory, setJudgeHistory] = useState<
    readonly ComposerJudgeHistoryEntry[]
  >([]);
  const [judgeCallsRemaining, setJudgeCallsRemaining] = useState(
    COMPOSER_JUDGE_CALL_LIMIT
  );
  const [judgeRevisionsRemaining, setJudgeRevisionsRemaining] = useState(
    COMPOSER_JUDGE_REVISION_LIMIT
  );
  const [judgeError, setJudgeError] = useState<string | null>(null);
  const [judgeTerminationReason, setJudgeTerminationReason] = useState<
    string | null
  >(null);
  const [dismissedJudgeIssueIds, setDismissedJudgeIssueIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const judgeHistoryIdRef = useRef(0);
  const [baselineHash, setBaselineHash] = useState<string>(() =>
    hashLabWorkflowSpec(NATIVE_TITRATION_V2_DRAFT)
  );
  const hydratedRef = useRef(false);
  const autosaveFailedRef = useRef(false);

  useEffect(() => {
    void listTeacherClasses()
      .then((classes) => {
        setTeacherSignedIn(true);
        setTeacherClasses(classes);
        if (classes[0]) setSelectedClassId(classes[0].id);
      })
      .catch(() => {
        setTeacherClasses([]);
        setTeacherSignedIn(false);
      });
    void listComposerDrafts()
      .then((drafts) => {
        if (drafts.length === 0) return;
        setSavedDraftNames(drafts.map((entry) => entry.name));
        const latest = drafts[0];
        if (latest) {
          setServerDraftId(latest.id);
          setServerStorageRevision(latest.storageRevision);
        }
      })
      .catch(() => {
        // Local named drafts remain available when the teacher is offline.
      });
    const timer = window.setTimeout(() => {
      setSavedDraftNames((current) =>
        current.length > 0 ? current : draftRepository().list()
      );
      const returningDraft = window.sessionStorage.getItem(
        COMPOSER_RETURN_DRAFT_KEY
      );
      if (returningDraft) {
        try {
          const restored = deserializeLabDraft(returningDraft);
          setDraft(restored);
          setSelectedEquipmentId(restored.equipment[0]?.instanceId ?? "");
          setRuleObjectiveId(restored.objectiveIds[0] ?? "");
          setRepositoryMessage(
            "Your lab is still here. Check it again before reopening Preview."
          );
        } catch {
          setError("The preview-return draft could not be restored safely.");
          setErrorPath("sessionDraft");
        } finally {
          window.sessionStorage.removeItem(COMPOSER_RETURN_DRAFT_KEY);
        }
      } else {
        // No preview return: recover an autosaved working draft so an accidental
        // refresh or navigation does not lose unsaved authoring. Restored drafts
        // are unvalidated, so Preview stays closed until the checker runs again.
        try {
          const working = draftRepository().loadWorking();
          if (working) {
            setDraft(working);
            setSelectedEquipmentId(working.equipment[0]?.instanceId ?? "");
            setRuleObjectiveId(working.objectiveIds[0] ?? "");
            setRepositoryMessage(
              "Restored your unsaved lab from this device. Check it again before previewing."
            );
          }
        } catch {
          // A corrupt autosave should never block the builder; discard it.
          try {
            draftRepository().clearWorking();
          } catch {
            // Ignore storage errors while clearing a bad autosave.
          }
        }
      }
      hydratedRef.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Autosave the working draft after each edit, once initial hydration is done.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const timer = window.setTimeout(() => {
      try {
        draftRepository().saveWorking(draft);
        autosaveFailedRef.current = false;
      } catch {
        if (!autosaveFailedRef.current) {
          autosaveFailedRef.current = true;
          setRepositoryMessage(
            "This device could not save a backup copy. Use Save so you do not lose your work."
          );
        }
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const validated = validationOutcome?.schemaValid ? validationOutcome : null;
  const currentHash = useMemo(() => hashLabWorkflowSpec(draft), [draft]);
  const hasUnsavedChanges = currentHash !== baselineHash;

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);
  const validationIsCurrent =
    validated?.validation.canonicalSpecHash === currentHash;
  const previewEligibility =
    validationIsCurrent && validated
      ? evaluateLabWorkflowEligibilityV2(validated.spec, "preview")
      : null;
  const canPreview = previewEligibility?.eligible === true;
  const canAssign =
    canPreview &&
    validationIsCurrent &&
    validationOutcome?.schemaValid === true &&
    validationOutcome.validation.assignmentEligible === true;
  const judgeSuggestions = useMemo(
    () =>
      judgeReview && judgeTraces
        ? createComposerJudgeSuggestions(draft, judgeReview, judgeTraces)
        : [],
    [draft, judgeReview, judgeTraces]
  );
  function focusStageHeading() {
    window.requestAnimationFrame(() => stageHeadingRef.current?.focus());
  }

  function changeStage(nextStage: ComposerStageId) {
    setStage(nextStage);
    focusStageHeading();
  }

  function resetSelections(nextDraft: Readonly<LabWorkflowDraftV2>) {
    setSelectedEquipmentId(nextDraft.equipment[0]?.instanceId ?? "");
    setRuleObjectiveId(nextDraft.objectiveIds[0] ?? "");
    setInstructionRuleId(nextDraft.rules[0]?.id ?? "");
  }

  function clearAuthorityAfterEdit() {
    setValidationOutcome(null);
    setAgentEvidenceState((current) =>
      current === "loaded" ? "stale" : current
    );
    setRepositoryMessage(null);
    setError(null);
    setErrorPath(null);
    setJudgeStatus((current) =>
      current === "current" || current === "running" ? "stale" : current
    );
    setJudgeTraces(null);
    setJudgeError(null);
    setJudgeTerminationReason(
      judgeReview
        ? "The draft changed. Check it and run a fresh teaching review."
        : null
    );
  }

  function addJudgeHistory(entry: Omit<ComposerJudgeHistoryEntry, "id">) {
    judgeHistoryIdRef.current += 1;
    setJudgeHistory((history) => [
      ...history.slice(-11),
      { ...entry, id: `judge-history-${judgeHistoryIdRef.current}` }
    ]);
  }

  function runTransaction(
    commands: readonly LabDraftCommand[],
    errorKey = "command"
  ): boolean {
    const result = applyLabDraftTransaction(draft, commands, draft.revision);
    if (!result.ok) {
      setItemErrors((current) => ({
        ...current,
        [errorKey]: teacherCommandError(result.error.code)
      }));
      return false;
    }
    setUndoStack((history) => [...history.slice(-(HISTORY_LIMIT - 1)), draft]);
    setRedoStack([]);
    setDraft(result.draft);
    setItemErrors((current) => ({ ...current, [errorKey]: undefined }));
    clearAuthorityAfterEdit();
    return true;
  }

  function run(command: LabDraftCommand, errorKey = "command"): boolean {
    return runTransaction([command], errorKey);
  }

  function requestRemoval(
    target: LabDraftRemovalTarget,
    label: string,
    trigger: HTMLElement,
    replacement: {
      readonly definitionId: string;
      readonly slotId: string;
    } | null = null
  ) {
    const inspection = inspectLabDraftRemoval(draft, target);
    if (!inspection.ok) {
      setItemErrors((current) => ({
        ...current,
        removal: teacherCommandError(inspection.error.code)
      }));
      return;
    }
    setRemovalImpact(inspection.impact);
    setRemovalLabel(label);
    setRemovalReturnFocus(trigger);
    setPendingReplacement(replacement);
    setRemovalError(null);
  }

  function closeRemoval() {
    setRemovalImpact(null);
    setRemovalLabel("");
    setRemovalError(null);
    setPendingReplacement(null);
  }

  function confirmRemoval(
    resolution: LabDraftRemovalResolution,
    confirmations: {
      readonly compatibility: boolean;
      readonly dependents: boolean;
    }
  ) {
    if (!removalImpact) return;
    const commands: LabDraftCommand[] = [
      {
        type: "apply_removal",
        plan: {
          sourceRevision: removalImpact.sourceRevision,
          sourceDraftHash: removalImpact.sourceDraftHash,
          target: removalImpact.target
        },
        resolution,
        confirmCompatibilityEffects: confirmations.compatibility,
        confirmDependentContentRemoval: confirmations.dependents
      }
    ];
    let replacementInstanceId = "";
    if (pendingReplacement) {
      const definition = componentRegistry.get(pendingReplacement.definitionId);
      replacementInstanceId = localId(
        definition.id.replaceAll(".", "_"),
        draft.revision
      );
      commands.push({
        type: "add_equipment",
        equipment: {
          instanceId: replacementInstanceId,
          equipmentDefinitionId: definition.id,
          configurationPresetId: definition.defaultConfigurationPresetId,
          label: definition.displayName,
          required: true
        }
      });
      const removedInstanceId =
        removalImpact.target.kind === "equipment"
          ? removalImpact.target.instanceId
          : "";
      commands.push({
        type: "set_layout",
        layout: {
          ...draft.layout,
          placements: [
            ...draft.layout.placements.filter(
              ({ equipmentInstanceId, placementSlotId }) =>
                equipmentInstanceId !== removedInstanceId &&
                placementSlotId !== pendingReplacement.slotId
            ),
            {
              equipmentInstanceId: replacementInstanceId,
              placementSlotId: pendingReplacement.slotId
            }
          ]
        }
      });
    }
    const result = applyLabDraftTransaction(draft, commands, draft.revision);
    if (!result.ok) {
      setRemovalError(teacherCommandError(result.error.code));
      return;
    }
    setUndoStack((history) => [...history.slice(-(HISTORY_LIMIT - 1)), draft]);
    setRedoStack([]);
    setDraft(result.draft);
    if (replacementInstanceId) setSelectedEquipmentId(replacementInstanceId);
    else resetSelections(result.draft);
    clearAuthorityAfterEdit();
    closeRemoval();
  }

  function validateDraft() {
    setIsValidating(true);
    setRepositoryMessage("Checking the lab…");
    window.setTimeout(() => {
      const outcome = validateLabWorkflowSpecV2(draft, {
        checkedAt: new Date().toISOString()
      });
      setValidationOutcome(outcome);
      setRepositoryMessage(
        outcome.schemaValid && outcome.validation.runnable
          ? "All required checks passed. Preview is ready."
          : "The checker found items to review before Preview."
      );
      setIsValidating(false);
    }, 0);
  }

  function judgeRequestDescription(): string {
    return (
      agentTeacherRequest.trim() ||
      draft.sourceRequest.trim() ||
      draft.metadata.learningObjective
    );
  }

  async function runTeachingReview() {
    if (
      judgeStatus === "running" ||
      judgeCallsRemaining === 0 ||
      !validationIsCurrent ||
      !validated ||
      !canPreview
    ) {
      setJudgeError(
        "Check the current lab successfully before running the optional teaching review."
      );
      return;
    }
    const attempt = COMPOSER_JUDGE_CALL_LIMIT - judgeCallsRemaining + 1;
    const callsAfter = judgeCallsRemaining - 1;
    setJudgeCallsRemaining(callsAfter);
    setJudgeStatus("running");
    setJudgeError(null);
    setJudgeTerminationReason(null);
    try {
      const result = await reviewComposerWorkflow({
        teacherRequest: judgeRequestDescription(),
        workflow: validated.spec,
        attempt
      });
      if (
        result.review.metadata.workflowHash !== currentHash ||
        result.review.metadata.workflowRevision !== draft.revision
      ) {
        throw new TypeError(
          "The teaching review no longer matches this draft."
        );
      }
      setJudgeReview(result.review);
      setJudgeTraces(result.traces);
      setJudgeStatus("current");
      setDismissedJudgeIssueIds(new Set());
      addJudgeHistory({
        title: `Teaching review ${attempt}`,
        detail:
          result.review.critique.recommendation === "approve"
            ? "The review found no teaching change that needs attention."
            : `${result.review.critique.issues.length} teaching suggestion${result.review.critique.issues.length === 1 ? "" : "s"} returned.`,
        outcome: "review"
      });
      if (result.review.critique.recommendation === "approve") {
        setJudgeTerminationReason(
          "The current version passed the optional teaching review."
        );
      } else if (callsAfter === 0) {
        setJudgeTerminationReason(
          "The fixed review-call limit was reached. You can still edit and use the LabBench checker."
        );
      }
    } catch (reviewError) {
      const message =
        reviewError instanceof Error
          ? reviewError.message
          : "The optional teaching review could not finish. Your draft was not changed.";
      setJudgeError(message);
      setJudgeStatus(judgeReview ? "stale" : "stopped");
      setJudgeTerminationReason(
        callsAfter === 0
          ? "The fixed review-call limit was reached."
          : "The required scenario run or review did not complete."
      );
      addJudgeHistory({
        title: `Teaching review ${attempt} stopped`,
        detail: message,
        outcome: "stopped"
      });
    }
  }

  async function acceptJudgeSuggestion(
    suggestion: Readonly<ComposerJudgeSuggestion>
  ) {
    if (
      judgeStatus !== "current" ||
      !judgeReview ||
      judgeReview.metadata.workflowHash !== currentHash
    ) {
      setJudgeError(
        "That suggestion is out of date. Check the current draft and run a fresh teaching review."
      );
      return;
    }
    if (judgeRevisionsRemaining === 0 || judgeCallsRemaining === 0) {
      setJudgeTerminationReason(
        "The fixed suggested-change or review-call limit was reached."
      );
      return;
    }
    const attempt = COMPOSER_JUDGE_CALL_LIMIT - judgeCallsRemaining + 1;
    const callsAfter = judgeCallsRemaining - 1;
    const revisionsAfter = judgeRevisionsRemaining - 1;
    setJudgeCallsRemaining(callsAfter);
    setJudgeRevisionsRemaining(revisionsAfter);
    setJudgeStatus("running");
    setJudgeError(null);
    setJudgeTerminationReason(null);

    const result = await applyComposerJudgeSuggestion({
      draft,
      suggestion,
      teacherRequest: judgeRequestDescription(),
      attempt
    });
    if (!result.ok) {
      setJudgeStatus("current");
      setJudgeError(result.message);
      addJudgeHistory({
        title: `Suggestion rejected by ${
          result.stage === "validation"
            ? "the lab checker"
            : result.stage === "trace"
              ? "a student scenario"
              : "the bounded review"
        }`,
        detail: `${suggestion.label}. ${result.message}`,
        outcome: "rejected"
      });
      if (callsAfter === 0 || revisionsAfter === 0) {
        setJudgeTerminationReason(
          "The fixed suggested-change or review-call limit was reached."
        );
      }
      return;
    }

    setUndoStack((history) => [...history.slice(-(HISTORY_LIMIT - 1)), draft]);
    setRedoStack([]);
    setDraft(result.draft);
    resetSelections(result.draft);
    setValidationOutcome(result.validation);
    setJudgeReview(result.review);
    setJudgeTraces(result.traces);
    setJudgeStatus("current");
    setDismissedJudgeIssueIds(new Set());
    setAgentEvidenceState((current) =>
      current === "loaded" ? "stale" : current
    );
    setRepositoryMessage(
      "The accepted teaching suggestion passed the lab checker and all five student scenarios."
    );
    addJudgeHistory({
      title: `Teacher accepted: ${suggestion.label}`,
      detail: `The shared command change passed rechecking and teaching review ${attempt}.`,
      outcome: "accepted"
    });
    if (result.review.critique.recommendation === "approve") {
      setJudgeTerminationReason(
        "The revised version passed the optional teaching review."
      );
    } else if (callsAfter === 0 || revisionsAfter === 0) {
      setJudgeTerminationReason(
        "The fixed suggested-change or review-call limit was reached."
      );
    }
  }

  function skipJudgeSuggestion(suggestion: Readonly<ComposerJudgeSuggestion>) {
    setDismissedJudgeIssueIds(
      (current) => new Set([...current, suggestion.issueId])
    );
    addJudgeHistory({
      title: `Teacher skipped: ${suggestion.label}`,
      detail: "The draft was not changed.",
      outcome: "skipped"
    });
  }

  async function generateAgentProposal() {
    const teacherRequest = agentTeacherRequest.trim();
    if (!teacherRequest || agentBusy || agentRequestsRemaining === 0) return;
    setAgentBusy(true);
    setAgentProgressUpdates([]);
    setAgentError(null);
    setAgentRequestsRemaining((remaining) => Math.max(0, remaining - 1));
    try {
      const proposal = await requestCapabilityAuthorProposal(
        {
          contractVersion: "2.0.0",
          teacherRequest,
          gradeBand: draft.metadata.gradeBand,
          targetMinutes: Math.min(120, draft.metadata.estimatedMinutes),
          deviceProfileId: draft.metadata.deviceProfileId
        },
        fetch,
        (progress) =>
          setAgentProgressUpdates((current) =>
            current.at(-1)?.stage === progress.stage
              ? current
              : [...current, progress]
          )
      );
      setAgentProposal(proposal);
      setAgentEvidenceState("ready");
    } catch (proposalError) {
      setAgentProposal(null);
      setAgentEvidenceState(null);
      setAgentError(
        proposalError instanceof CapabilityAuthorClientError
          ? proposalError.message
          : "The draft helper could not finish. Your current lab was not changed."
      );
    } finally {
      setAgentBusy(false);
    }
  }

  function useAgentDraft() {
    const workflow = agentProposal?.result.workflow;
    const proposalValidation = agentProposal?.result.validation;
    if (
      !workflow ||
      !workflow.validation ||
      workflow.supportStatus !== "runnable" ||
      !proposalValidation?.runnable ||
      agentProposal?.result.outcome !== "runnable" ||
      agentProposal.result.traces.length !== 5 ||
      !agentProposal.result.traces.every(({ passed }) => passed)
    ) {
      setAgentError(
        "This proposal has not passed every required LabBench check, so it cannot be loaded."
      );
      return;
    }

    const { supportStatus, validation, judgeCritique, ...authored } = workflow;
    void supportStatus;
    void validation;
    void judgeCritique;
    const parsedDraft = labWorkflowDraftV2Schema.safeParse({
      ...authored,
      supportStatus: "draft_unvalidated",
      validation: null,
      judgeCritique: null
    });
    if (!parsedDraft.success) {
      setAgentError(
        "This proposal could not be loaded safely. Your current lab was not changed."
      );
      return;
    }

    const checked = validateLabWorkflowSpecV2(parsedDraft.data, {
      checkedAt: proposalValidation.checkedAt
    });
    if (
      !checked.schemaValid ||
      !checked.validation.runnable ||
      checked.validation.canonicalSpecHash !==
        proposalValidation.canonicalSpecHash ||
      checked.validation.canonicalSpecHash !== validation.canonicalSpecHash
    ) {
      setAgentError(
        "The proposal changed before it could be loaded. Generate it again to keep the checks exact."
      );
      return;
    }

    setUndoStack((history) => [...history.slice(-(HISTORY_LIMIT - 1)), draft]);
    setRedoStack([]);
    setDraft(parsedDraft.data);
    resetSelections(parsedDraft.data);
    setValidationOutcome(checked);
    setAgentEvidenceState("loaded");
    setAgentError(null);
    setJudgeStatus("idle");
    setJudgeReview(null);
    setJudgeTraces(null);
    setJudgeHistory([]);
    setJudgeCallsRemaining(COMPOSER_JUDGE_CALL_LIMIT);
    setJudgeRevisionsRemaining(COMPOSER_JUDGE_REVISION_LIMIT);
    setJudgeError(null);
    setJudgeTerminationReason(null);
    setDismissedJudgeIssueIds(new Set());
    setError(null);
    setErrorPath(null);
    setItemErrors({});
    setRepositoryMessage(
      "The proposed draft is loaded and its LabBench checks match this exact version. Review or edit anything before Preview."
    );
  }

  function rejectAgentProposal() {
    setAgentProposal(null);
    setAgentEvidenceState(null);
    setAgentError(null);
  }

  function undoEdit() {
    const snapshot = undoStack.at(-1);
    if (!snapshot) return;
    try {
      const restored = restoreDraftSnapshot(draft, snapshot);
      setUndoStack((history) => history.slice(0, -1));
      setRedoStack((history) => [
        ...history.slice(-(HISTORY_LIMIT - 1)),
        draft
      ]);
      setDraft(restored);
      resetSelections(restored);
      clearAuthorityAfterEdit();
      setRepositoryMessage(
        "Last change undone. Check the lab again before previewing."
      );
    } catch (historyError) {
      setError(
        historyError instanceof Error
          ? historyError.message
          : "That change could not be undone."
      );
      setErrorPath("draftHistory.undo");
    }
  }

  function redoEdit() {
    const snapshot = redoStack.at(-1);
    if (!snapshot) return;
    try {
      const restored = restoreDraftSnapshot(draft, snapshot);
      setRedoStack((history) => history.slice(0, -1));
      setUndoStack((history) => [
        ...history.slice(-(HISTORY_LIMIT - 1)),
        draft
      ]);
      setDraft(restored);
      resetSelections(restored);
      clearAuthorityAfterEdit();
      setRepositoryMessage(
        "Change restored. Check the lab again before previewing."
      );
    } catch (historyError) {
      setError(
        historyError instanceof Error
          ? historyError.message
          : "That change could not be restored."
      );
      setErrorPath("draftHistory.redo");
    }
  }

  function startNewLab(templateId: ComposerLabTemplateId) {
    setNewLabMenuOpen(false);
    if (
      hasUnsavedChanges &&
      !window.confirm(
        "Start a new lab? Unsaved changes to the current lab will be lost."
      )
    )
      return;
    const template = composerLabTemplateCatalog.find(
      ({ id }) => id === templateId
    );
    if (!template) return;
    const next = template.draft;
    setDraft(next);
    setUndoStack([]);
    setRedoStack([]);
    resetSelections(next);
    setBaselineHash(hashLabWorkflowSpec(next));
    clearAuthorityAfterEdit();
    setItemErrors({});
    try {
      draftRepository().clearWorking();
    } catch {
      // A storage failure here is non-fatal; autosave will retry on next edit.
    }
    setRepositoryMessage(
      templateId === "blank"
        ? "Started a new blank lab. Add objectives and equipment to begin."
        : `Started from the ${template.title.toLocaleLowerCase()} template.`
    );
    changeStage("define");
  }

  async function saveDraft() {
    try {
      const repository = draftRepository();
      repository.save(draftName, draft);
      const names = repository.list();
      setSavedDraftNames(names);
      setSelectedSavedDraft(draftName.trim());
      setBaselineHash(currentHash);
      setError(null);
      setErrorPath(null);
      try {
        const saved = await saveComposerDraft({
          idempotencyKey: crypto.randomUUID(),
          draftId: serverDraftId ?? undefined,
          expectedStorageRevision: serverStorageRevision ?? undefined,
          name: draftName.trim(),
          draft
        });
        setServerDraftId(saved.id);
        setServerStorageRevision(saved.storageRevision);
        setSavedDraftNames((current) =>
          Object.freeze([...new Set([saved.name, ...current, ...names])].sort())
        );
        setRepositoryMessage(
          `Saved “${draftName.trim()}” to your teacher account.`
        );
      } catch (serverError) {
        const message =
          serverError instanceof Error ? serverError.message : "unknown error";
        setRepositoryMessage(
          message.toLowerCase().includes("authentication") ||
            message.toLowerCase().includes("sign in") ||
            message.includes("401")
            ? `Saved “${draftName.trim()}” on this device. Sign in as a teacher to sync to the cloud and assign.`
            : `Saved “${draftName.trim()}” on this device. Server sync unavailable: ${message}`
        );
        setTeacherSignedIn(false);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed.");
      setErrorPath("localDraftRepository.save");
    }
  }

  async function assignLab() {
    if (!canAssign || !validated) return;
    if (!selectedClassId) {
      setError("Choose a class before assigning this lab.");
      setErrorPath("assign.classId");
      return;
    }
    setIsAssigning(true);
    setError(null);
    setErrorPath(null);
    try {
      const saved = await saveComposerDraft({
        idempotencyKey: crypto.randomUUID(),
        draftId: serverDraftId ?? undefined,
        expectedStorageRevision: serverStorageRevision ?? undefined,
        name: draftName.trim(),
        draft
      });
      setServerDraftId(saved.id);
      setServerStorageRevision(saved.storageRevision);
      const version = await approveComposerDraft({
        draftId: saved.id,
        idempotencyKey: crypto.randomUUID(),
        expectedStorageRevision: saved.storageRevision,
        expectedCanonicalHash: validated.validation.canonicalSpecHash
      });
      const assignment = await createComposerAssignment({
        idempotencyKey: crypto.randomUUID(),
        classId: selectedClassId,
        versionId: version.id,
        title: draftName.trim()
      });
      setRepositoryMessage(
        `Assigned “${assignment.title}”. Student start: /assignments/${assignment.id}`
      );
    } catch (assignError) {
      setError(
        assignError instanceof Error ? assignError.message : "Assign failed."
      );
      setErrorPath("assignLab");
    } finally {
      setIsAssigning(false);
    }
  }

  function loadDraft() {
    if (!selectedSavedDraft) return;
    try {
      const loaded = draftRepository().load(selectedSavedDraft);
      if (!loaded) throw new TypeError("The selected local draft is missing.");
      const restored = restoreDraftSnapshot(draft, loaded);
      setUndoStack((history) => [
        ...history.slice(-(HISTORY_LIMIT - 1)),
        draft
      ]);
      setRedoStack([]);
      setDraft(restored);
      resetSelections(restored);
      clearAuthorityAfterEdit();
      setRepositoryMessage(
        `Loaded “${selectedSavedDraft}”. Check it before previewing.`
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Load failed.");
      setErrorPath("localDraftRepository.load");
    }
  }

  function launchPreview() {
    if (!canPreview || !validated) return;
    window.sessionStorage.setItem(
      COMPOSER_RETURN_DRAFT_KEY,
      serializeLabDraft(draft)
    );
    previewRepository().save(validated.spec);
    const hash = encodeURIComponent(validated.validation.canonicalSpecHash);
    window.location.assign(`/teacher/lab-composer/preview?hash=${hash}`);
  }

  function addEquipmentToSlot(definitionId: string, slotId: string) {
    const occupied = draft.layout.placements.find(
      ({ placementSlotId }) => placementSlotId === slotId
    );
    if (occupied) {
      setItemErrors((current) => ({
        ...current,
        [`equipment:${definitionId}`]:
          "That slot is occupied. Use Replace to review and resolve the existing equipment dependencies."
      }));
      return;
    }
    const definition = componentRegistry.get(definitionId);
    const instanceId = localId(
      definition.id.replaceAll(".", "_"),
      draft.revision
    );
    const planned = planVerifiedLayoutMove({
      equipment: [
        ...draft.equipment.map((equipment) => {
          const registered = componentRegistry.get(
            equipment.equipmentDefinitionId
          );
          return {
            instanceId: equipment.instanceId,
            equipmentDefinitionId: registered.id,
            visualAdapterDefinitionId: registered.visualAdapterDefinitionId
          };
        }),
        {
          instanceId,
          equipmentDefinitionId: definition.id,
          visualAdapterDefinitionId: definition.visualAdapterDefinitionId
        }
      ],
      placements: [
        ...draft.layout.placements,
        { equipmentInstanceId: instanceId, placementSlotId: slotId }
      ],
      equipmentInstanceId: instanceId,
      targetPlacementSlotId: slotId
    });
    if (!planned.ok) {
      setItemErrors((current) => ({
        ...current,
        [`equipment:${definitionId}`]: planned.reason
      }));
      return;
    }
    if (
      runTransaction(
        [
          {
            type: "add_equipment",
            equipment: {
              instanceId,
              equipmentDefinitionId: definition.id,
              configurationPresetId: definition.defaultConfigurationPresetId,
              label: definition.displayName,
              required: true
            }
          },
          {
            type: "set_layout",
            layout: {
              ...draft.layout,
              placements: [...planned.placements]
            }
          }
        ],
        `equipment:${definitionId}`
      )
    ) {
      setSelectedEquipmentId(instanceId);
    }
  }

  function moveEquipmentToSlot(instanceId: string, slotId: string) {
    const planned = planVerifiedLayoutMove({
      equipment: draft.equipment.map((equipment) => {
        const definition = componentRegistry.get(
          equipment.equipmentDefinitionId
        );
        return {
          instanceId: equipment.instanceId,
          equipmentDefinitionId: definition.id,
          visualAdapterDefinitionId: definition.visualAdapterDefinitionId
        };
      }),
      placements: draft.layout.placements,
      equipmentInstanceId: instanceId,
      targetPlacementSlotId: slotId
    });
    if (!planned.ok) {
      setItemErrors((current) => ({
        ...current,
        [`equipment:${instanceId}`]: planned.reason
      }));
      return;
    }
    const unchanged = planned.placements.every(
      (placement, index) =>
        placement.equipmentInstanceId ===
          draft.layout.placements[index]?.equipmentInstanceId &&
        placement.placementSlotId ===
          draft.layout.placements[index]?.placementSlotId
    );
    if (unchanged) return;
    run(
      {
        type: "set_layout",
        layout: {
          ...draft.layout,
          placements: [...planned.placements]
        }
      },
      `equipment:${instanceId}`
    );
  }

  function resetEquipmentArrangement() {
    try {
      const placements = draft.equipment.map((equipment) => ({
        equipmentInstanceId: equipment.instanceId,
        placementSlotId: defaultPlacementForEquipment(
          equipment.equipmentDefinitionId
        ).id
      }));
      if (
        new Set(placements.map(({ placementSlotId }) => placementSlotId))
          .size !== placements.length
      ) {
        setItemErrors((current) => ({
          ...current,
          arrangement:
            "This setup has more than one item for the same default position. Move or remove the extra item first."
        }));
        return;
      }
      const currentByInstance = new Map(
        draft.layout.placements.map((placement) => [
          placement.equipmentInstanceId,
          placement.placementSlotId
        ])
      );
      if (
        placements.every(
          (placement) =>
            currentByInstance.get(placement.equipmentInstanceId) ===
            placement.placementSlotId
        )
      ) {
        return;
      }
      run(
        {
          type: "set_layout",
          layout: { ...draft.layout, placements }
        },
        "arrangement"
      );
    } catch {
      setItemErrors((current) => ({
        ...current,
        arrangement: "This setup does not have a complete default arrangement."
      }));
    }
  }

  function bindMaterialToContainer(
    materialProfileId: string,
    containerId: string
  ) {
    const quantityPresetId = quantityPresetsFor(materialProfileId)[0]?.id;
    if (!quantityPresetId) return;
    run(
      {
        type: "bind_material",
        binding: {
          instanceId: localId("material", draft.revision),
          materialProfileId,
          containerInstanceId: containerId,
          quantityPresetId
        }
      },
      `material:${materialProfileId}`
    );
  }

  function setMaterialConcentration(
    instanceId: string,
    decimalValue: string,
    configurationSchemaId: string,
    unitId: string
  ) {
    run(
      {
        type: "set_material_concentration",
        instanceId,
        initialization: {
          kind: "bounded_concentration",
          configurationSchemaId,
          concentration: { decimalValue, unitId }
        }
      },
      `material:${instanceId}:concentration`
    );
  }

  function enableEquipmentAction(
    nextActionId: string,
    sourceInstanceId: string | undefined,
    targetInstanceIds: readonly string[]
  ) {
    run(
      {
        type: "permit_action",
        action: {
          id: localId("permission", draft.revision),
          actionId: nextActionId,
          ...(sourceInstanceId
            ? { sourceEquipmentInstanceId: sourceInstanceId }
            : {}),
          targetEquipmentInstanceIds: [...targetInstanceIds],
          availability: { allSatisfiedRuleIds: [], allUnsatisfiedRuleIds: [] }
        }
      },
      `action:${nextActionId}`
    );
  }

  function addActionRule() {
    const permission = draft.permittedActions[0];
    if (!permission || !ruleObjectiveId) return;
    run({
      type: "add_rule",
      rule: {
        id: localId("action_rule", draft.revision),
        kind: ruleKind,
        condition: {
          kind: "action_observed",
          actionId: permission.actionId,
          ...(permission.sourceEquipmentInstanceId
            ? {
                sourceEquipmentInstanceId: permission.sourceEquipmentInstanceId
              }
            : {}),
          targetEquipmentInstanceIds: permission.targetEquipmentInstanceIds
        },
        severity: ruleSeverity,
        recoverable: ruleTerminal ? false : ruleRecoverable,
        terminal: ruleTerminal,
        objectiveIds: [ruleObjectiveId]
      }
    });
  }

  function addToleranceRule() {
    const minimum = Number(toleranceMinimum);
    const maximum = Number(toleranceMaximum);
    const observable = composerObservableCatalog[0];
    if (
      !observable ||
      !ruleObjectiveId ||
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      minimum > maximum ||
      minimum < 0
    ) {
      setItemErrors((current) => ({
        ...current,
        tolerance:
          "Enter a result range with a low value at least 0 and no higher than the high value."
      }));
      return;
    }
    run(
      {
        type: "add_rule",
        rule: {
          id: localId("tolerance", draft.revision),
          kind: "required",
          condition: {
            kind: "observable_within_tolerance",
            observableId: observable.id,
            minimum,
            maximum,
            minimumInclusive: true,
            maximumInclusive: true,
            unitId: "unit.ml.v1"
          },
          severity: ruleSeverity,
          recoverable: true,
          terminal: false,
          objectiveIds: [ruleObjectiveId]
        }
      },
      "tolerance"
    );
  }

  function addInstruction() {
    if (
      !instructionTitle.trim() ||
      !instructionGuidance.trim() ||
      !instructionRuleId
    )
      return;
    if (
      run(
        {
          type: "add_instruction",
          instruction: {
            id: localId("instruction", draft.revision),
            title: instructionTitle.trim(),
            guidance: instructionGuidance.trim(),
            relatedRuleIds: [instructionRuleId]
          }
        },
        "instruction"
      )
    ) {
      setInstructionTitle("");
      setInstructionGuidance("");
    }
  }

  return (
    <div className={styles.composer} data-draft-revision={draft.revision}>
      {teacherSignedIn === false && (
        <p className={styles.authBanner} role="status">
          Authoring and Preview work without an account.{" "}
          <a href="/auth/sign-in">Sign in as a teacher</a> to save cloud drafts
          and assign labs to a class.
        </p>
      )}
      <section className={styles.statusBar} aria-label="Draft status">
        <div>
          <span
            className={styles.statusDot}
            data-state={canPreview ? "runnable" : "draft"}
            aria-hidden="true"
          />
          <strong>
            {isValidating
              ? "Checking lab…"
              : canPreview
                ? "Ready to preview"
                : "Needs checking"}
          </strong>
        </div>
        <div className={styles.statusActions}>
          <div className={styles.newLabControl}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={newLabMenuOpen}
              onClick={() => setNewLabMenuOpen((open) => !open)}
            >
              New lab
            </button>
            {newLabMenuOpen && (
              <div
                className={styles.newLabMenu}
                role="menu"
                aria-label="Start a new lab"
                onKeyDown={(event) => {
                  if (event.key === "Escape") setNewLabMenuOpen(false);
                }}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => startNewLab("blank")}
                >
                  Start from scratch
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => startNewLab("titration")}
                >
                  Acid–base titration template
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => startNewLab("weak_acid_titration")}
                >
                  Acetic acid titration template
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => startNewLab("solution_preparation")}
                >
                  Dilute 0.5000 M NaCl → 0.0500 M
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => startNewLab("solution_preparation_stock_1m")}
                >
                  Dilute 1.000 M NaCl → 0.1000 M
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => startNewLab("solution_preparation_quarter")}
                >
                  Dilute 0.2500 M NaCl → 0.0250 M
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => startNewLab("calorimetry")}
                >
                  Hot/cold water calorimetry
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => startNewLab("dissolution_calorimetry")}
                >
                  Ammonium nitrate dissolution calorimetry
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={undoStack.length === 0}
            title={
              undoStack.length > 0
                ? "Undo the last successful edit"
                : "Nothing to undo"
            }
            onClick={undoEdit}
          >
            Undo
          </button>
          <button
            type="button"
            disabled={redoStack.length === 0}
            title={
              redoStack.length > 0
                ? "Redo the last undone edit"
                : "Nothing to redo"
            }
            onClick={redoEdit}
          >
            Redo
          </button>
          <button type="button" onClick={saveDraft}>
            Save
          </button>
          <button
            className={styles.validateButton}
            type="button"
            disabled={isValidating}
            title={isValidating ? "Validation is already running" : undefined}
            onClick={validateDraft}
          >
            {isValidating ? "Checking…" : "Check lab"}
          </button>
          <button
            type="button"
            disabled={!canPreview}
            title={
              canPreview
                ? "Open isolated preview"
                : "Validation is required first"
            }
            onClick={launchPreview}
          >
            Preview
          </button>
          <label className={styles.assignClass}>
            <span className={styles.srOnly}>Class</span>
            <select
              aria-label="Class for assignment"
              value={selectedClassId}
              disabled={teacherClasses.length === 0 || isAssigning}
              onChange={(event) => setSelectedClassId(event.target.value)}
            >
              {teacherClasses.length === 0 ? (
                <option value="">No classes yet</option>
              ) : (
                teacherClasses.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <button
            type="button"
            disabled={!canAssign || !selectedClassId || isAssigning}
            title={
              canAssign
                ? selectedClassId
                  ? "Approve the current runnable lab and assign it to the selected class"
                  : "Create a class before assigning"
                : "A current assignment-eligible validation is required first"
            }
            onClick={() => {
              void assignLab();
            }}
          >
            {isAssigning ? "Assigning…" : "Assign"}
          </button>
        </div>
      </section>

      {error && (
        <div className={styles.error} role="alert">
          <strong>That change was not saved.</strong>
          <span>{error}</span>
        </div>
      )}

      {repositoryMessage && (
        <p className={styles.notice} role="status">
          {repositoryMessage}
        </p>
      )}

      <ComposerStageChrome
        stage={stage}
        draft={draft}
        headingRef={stageHeadingRef}
        onStageChange={changeStage}
      />

      {stage === "define" && (
        <ComposerAgentWorkspace
          teacherRequest={agentTeacherRequest}
          proposal={agentProposal}
          evidenceState={agentEvidenceState}
          remainingRequests={agentRequestsRemaining}
          busy={agentBusy}
          progressUpdates={agentProgressUpdates}
          error={agentError}
          onTeacherRequestChange={setAgentTeacherRequest}
          onGenerate={() => void generateAgentProposal()}
          onUseDraft={useAgentDraft}
          onReject={rejectAgentProposal}
          onRevalidate={validateDraft}
        />
      )}

      {stage === "agent_loop" && (
        <ComposerAgentLoopTab
          proposal={agentProposal}
          evidenceState={agentEvidenceState}
          authorBusy={agentBusy}
          authorProgress={agentProgressUpdates}
          authorError={agentError}
          validationState={
            validationIsCurrent && canPreview
              ? "passed"
              : validationOutcome
                ? "needs-attention"
                : "not-checked"
          }
          judgeStatus={judgeStatus}
          judgeHistory={judgeHistory}
          callsRemaining={judgeCallsRemaining}
          revisionsRemaining={judgeRevisionsRemaining}
          onOpenDefine={() => changeStage("define")}
          onOpenValidation={() => changeStage("validate")}
        />
      )}

      <section
        className={styles.validationPanel}
        aria-labelledby="validation-heading"
        hidden={stage !== "validate"}
        aria-busy={isValidating}
      >
        <header>
          <p>Final review</p>
          <h2 id="validation-heading">Check and preview the lab</h2>
        </header>
        <div className={styles.validationActions}>
          <button
            className={styles.validateButton}
            type="button"
            disabled={isValidating}
            onClick={validateDraft}
          >
            {isValidating ? "Checking…" : "Check lab"}
          </button>
          <label>
            Local draft name
            <input
              value={draftName}
              maxLength={80}
              onChange={(event) => setDraftName(event.currentTarget.value)}
            />
          </label>
          <button type="button" onClick={saveDraft}>
            Save locally
          </button>
          <label>
            Saved draft
            <select
              value={selectedSavedDraft}
              onChange={(event) =>
                setSelectedSavedDraft(event.currentTarget.value)
              }
            >
              <option value="">Select a saved draft</option>
              {savedDraftNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!selectedSavedDraft}
            onClick={loadDraft}
          >
            Load selected
          </button>
        </div>

        {validationOutcome && (
          <div
            className={styles.validationResult}
            data-runnable={canPreview ? "true" : "false"}
          >
            {validationOutcome.schemaValid ? (
              <>
                <dl className={styles.authoritySummary}>
                  <div>
                    <dt>Lab checker</dt>
                    <dd>
                      {validationOutcome.validation.runnable
                        ? "Passed"
                        : "Needs changes"}
                    </dd>
                  </div>
                  <div>
                    <dt>Preview</dt>
                    <dd>
                      {validationOutcome.validation.previewEligible
                        ? "Ready"
                        : "Not ready"}
                    </dd>
                  </div>
                  <div>
                    <dt>Assignment</dt>
                    <dd>
                      {validationOutcome.validation.assignmentEligible
                        ? "Ready"
                        : "Not available yet"}
                    </dd>
                  </div>
                  <div>
                    <dt>Current simulation</dt>
                    <dd>
                      {draft.compatibility
                        ? "Acid–base titration · supported"
                        : "Supported lab simulation"}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <strong>
                This lab has a structural problem and cannot be previewed.
              </strong>
            )}
            <ComposerValidationIssues
              issues={validationOutcome.issues}
              onReviewStage={changeStage}
            />
          </div>
        )}
        <ComposerJudgePanel
          validatorReady={canPreview && validationIsCurrent}
          status={judgeStatus}
          review={judgeReview}
          suggestions={judgeSuggestions}
          dismissedIssueIds={dismissedJudgeIssueIds}
          history={judgeHistory}
          callsRemaining={judgeCallsRemaining}
          revisionsRemaining={judgeRevisionsRemaining}
          error={judgeError}
          terminationReason={judgeTerminationReason}
          onReview={() => void runTeachingReview()}
          onAcceptSuggestion={(suggestion) =>
            void acceptJudgeSuggestion(suggestion)
          }
          onSkipSuggestion={skipJudgeSuggestion}
        />
      </section>

      {stage === "setup" && (
        <div>
          <ComposerSetupWorkspace
            draft={draft}
            selectedEquipmentId={selectedEquipmentId}
            errors={itemErrors}
            onSelectEquipment={setSelectedEquipmentId}
            onAddToSlot={addEquipmentToSlot}
            onMoveToSlot={moveEquipmentToSlot}
            onResetArrangement={resetEquipmentArrangement}
            onBindMaterial={bindMaterialToContainer}
            onSetMaterialConcentration={setMaterialConcentration}
            onClearMaterialConcentration={(instanceId) =>
              run(
                { type: "clear_material_concentration", instanceId },
                `material:${instanceId}:concentration`
              )
            }
            onConfigure={(instanceId, presetId) =>
              run(
                {
                  type: "configure_equipment",
                  instanceId,
                  configurationPresetId: presetId
                },
                `equipment:${instanceId}`
              )
            }
            onEnableAction={enableEquipmentAction}
            onRequestRemoval={requestRemoval}
            onRequestReplace={(target, label, definitionId, slotId, trigger) =>
              requestRemoval(target, label, trigger, { definitionId, slotId })
            }
          />
        </div>
      )}

      <div
        className={styles.workflowGrid}
        data-stage={stage}
        hidden={
          stage !== "define" && stage !== "workflow" && stage !== "assess"
        }
      >
        {stage === "define" && (
          <ComposerDefineStage
            key={`define:${draft.id}:${draft.revision}`}
            draft={draft}
            error={itemErrors.metadata}
            onSaveMetadata={(metadata) =>
              run({ type: "update_metadata", metadata }, "metadata")
            }
            onObjectiveToggle={(objectiveId, selected) => {
              if (!selected) {
                run(
                  { type: "add_objective", objectiveId },
                  `objective:${objectiveId}`
                );
                return;
              }
              const trigger = document.activeElement;
              requestRemoval(
                { kind: "objective", objectiveId },
                objectiveId.replaceAll("_", " "),
                trigger instanceof HTMLElement ? trigger : document.body
              );
            }}
          />
        )}

        <section className={styles.workflowPanel} hidden={stage !== "workflow"}>
          <header>
            <p>Add something students should do or demonstrate</p>
            <h2>Add an activity check</h2>
          </header>
          <div className={styles.inlineForm}>
            <label>
              What should the lab check?
              <select
                value={ruleConditionType}
                onChange={(event) =>
                  setRuleConditionType(
                    event.currentTarget.value as typeof ruleConditionType
                  )
                }
              >
                <option value="action">A student action</option>
                <option value="tolerance">A measured result</option>
              </select>
            </label>
            <label>
              How is it used?
              <select
                value={ruleKind}
                onChange={(event) =>
                  setRuleKind(event.currentTarget.value as typeof ruleKind)
                }
              >
                <option value="required">Required step</option>
                <option value="best_practice">Helpful practice</option>
                <option value="scoring">Scoring evidence</option>
              </select>
            </label>
            <label>
              Objective
              <select
                value={ruleObjectiveId}
                onChange={(event) =>
                  setRuleObjectiveId(event.currentTarget.value)
                }
              >
                {draft.objectiveIds.map((id) => (
                  <option key={id} value={id}>
                    {titleCaseIdentifier(id)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Feedback type
              <select
                value={ruleSeverity}
                onChange={(event) =>
                  setRuleSeverity(
                    event.currentTarget.value as typeof ruleSeverity
                  )
                }
              >
                <option value="info">Information</option>
                <option value="best-practice">Helpful practice</option>
                <option value="procedural">Procedure problem</option>
                <option value="conceptual">Concept misunderstanding</option>
                <option value="safety">Safety problem</option>
              </select>
            </label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={ruleRecoverable}
                disabled={ruleTerminal}
                onChange={(event) =>
                  setRuleRecoverable(event.currentTarget.checked)
                }
              />{" "}
              Students can correct this and continue
            </label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={ruleTerminal}
                onChange={(event) =>
                  setRuleTerminal(event.currentTarget.checked)
                }
              />{" "}
              End the attempt when this happens
            </label>
            {ruleConditionType === "action" && (
              <>
                <button
                  type="button"
                  disabled={!draft.permittedActions[0] || !ruleObjectiveId}
                  title={
                    !draft.permittedActions[0]
                      ? "Enable a student action in Set up first."
                      : !ruleObjectiveId
                        ? "Choose an objective first."
                        : undefined
                  }
                  onClick={addActionRule}
                >
                  Add student action
                </button>
                {!draft.permittedActions[0] && (
                  <small className={styles.helpText} role="status">
                    Enable a student action on the Set up bench before adding an
                    action check.
                  </small>
                )}
              </>
            )}
          </div>
          {ruleConditionType === "tolerance" && (
            <div className={styles.toleranceForm}>
              <strong>Accepted result range</strong>
              <label>
                Lowest value
                <input
                  type="number"
                  step="0.01"
                  value={toleranceMinimum}
                  onChange={(event) =>
                    setToleranceMinimum(event.currentTarget.value)
                  }
                />
              </label>
              <label>
                Highest value
                <input
                  type="number"
                  step="0.01"
                  value={toleranceMaximum}
                  onChange={(event) =>
                    setToleranceMaximum(event.currentTarget.value)
                  }
                />
              </label>
              <button
                type="button"
                disabled={
                  !ruleObjectiveId ||
                  !Number.isFinite(Number(toleranceMinimum)) ||
                  !Number.isFinite(Number(toleranceMaximum)) ||
                  Number(toleranceMinimum) < 0 ||
                  Number(toleranceMinimum) > Number(toleranceMaximum)
                }
                title={
                  !ruleObjectiveId ? "Choose an objective first." : undefined
                }
                onClick={addToleranceRule}
              >
                Add result range
              </button>
              {itemErrors.tolerance && (
                <small className={styles.inlineError} role="alert">
                  {itemErrors.tolerance}
                </small>
              )}
            </div>
          )}
        </section>

        {stage === "workflow" && (
          <ComposerWorkflowGraph
            draft={draft}
            error={itemErrors.edge ?? itemErrors.rule}
            ruleLabel={(rule) => ruleLabel(rule, draft.rules)}
            ruleRole={ruleRole}
            onAddDependency={(predecessorId, successorId) =>
              run(
                {
                  type: "add_ordering_dependency",
                  ruleId: localId("ordering", draft.revision),
                  predecessorRuleId: predecessorId,
                  successorRuleId: successorId,
                  severity: ruleSeverity,
                  recoverable: true,
                  objectiveIds: [draft.objectiveIds[0] ?? ""]
                },
                "edge"
              )
            }
            onRemoveDependency={(ruleId) =>
              run({ type: "remove_ordering_dependency", ruleId }, "edge")
            }
            onReplaceRule={(rule) =>
              run(
                { type: "replace_rule", ruleId: rule.id, rule },
                `rule:${rule.id}`
              )
            }
            onRequestRemoval={requestRemoval}
          />
        )}

        <section className={styles.workflowPanel} hidden={stage !== "workflow"}>
          <header>
            <p>Shown to students</p>
            <h2>Student directions</h2>
          </header>
          <div className={styles.stackForm}>
            <label>
              Title (required)
              <input
                value={instructionTitle}
                required
                onChange={(event) =>
                  setInstructionTitle(event.currentTarget.value)
                }
                maxLength={160}
              />
            </label>
            <label>
              Guidance (required)
              <textarea
                value={instructionGuidance}
                required
                onChange={(event) =>
                  setInstructionGuidance(event.currentTarget.value)
                }
                maxLength={4000}
              />
            </label>
            <label>
              Show with
              <select
                value={instructionRuleId}
                onChange={(event) =>
                  setInstructionRuleId(event.currentTarget.value)
                }
              >
                {draft.rules.map((rule) => (
                  <option key={rule.id} value={rule.id}>
                    {ruleLabel(rule, draft.rules)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={
                !instructionTitle.trim() ||
                !instructionGuidance.trim() ||
                !instructionRuleId
              }
              title={
                !instructionRuleId
                  ? "Add an activity check first so the direction has something to show with."
                  : undefined
              }
              onClick={addInstruction}
            >
              Add direction
            </button>
            {!instructionRuleId && (
              <small className={styles.helpText} role="status">
                Add an activity check above before writing a student direction.
              </small>
            )}
            {itemErrors.instruction && (
              <small className={styles.inlineError} role="alert">
                {itemErrors.instruction}
              </small>
            )}
          </div>
          <ol className={styles.compactList}>
            {draft.instructions.map((instruction) => (
              <li key={instruction.id}>
                <strong>{instruction.title}</strong>
                <span>{instruction.guidance}</span>
                <button
                  type="button"
                  onClick={(event) =>
                    requestRemoval(
                      { kind: "instruction", instructionId: instruction.id },
                      instruction.title,
                      event.currentTarget
                    )
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
        </section>

        {stage === "assess" && (
          <ComposerAssessWorkspace
            draft={draft}
            validatorIssues={validationOutcome?.issues ?? []}
            ruleLabel={(rule) => ruleLabel(rule, draft.rules)}
            onAddCriterion={(criterion) =>
              run(
                { type: "add_rubric_criterion", criterion },
                `criterion:${criterion.id}`
              )
            }
            onReplaceCriterion={(criterion) =>
              run(
                {
                  type: "replace_rubric_criterion",
                  criterionId: criterion.id,
                  criterion
                },
                `criterion:${criterion.id}`
              )
            }
            onRequestRemoval={requestRemoval}
          />
        )}
      </div>

      <ComposerRemovalDialog
        key={removalImpact?.sourceDraftHash ?? "closed-removal"}
        impact={removalImpact}
        draft={draft}
        label={removalLabel}
        error={removalError}
        returnFocusTo={removalReturnFocus}
        onCancel={closeRemoval}
        onConfirm={confirmRemoval}
      />

      <ComposerStageFooter stage={stage} onStageChange={changeStage} />
    </div>
  );
}
