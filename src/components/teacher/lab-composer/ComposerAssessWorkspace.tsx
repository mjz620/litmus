"use client";

import { useMemo, useState } from "react";

import type { LabDraftRemovalTarget } from "../../../lab-workflows/authoring";
import type {
  RubricCriterionSpecV2,
  WorkflowRule
} from "../../../lab-workflows/schema/conditions";
import type { ValidationIssue } from "../../../lab-workflows/schema";
import type { LabWorkflowDraftV2 } from "../../../lab-workflows/schema/v2";

import styles from "./LabComposer.module.css";

interface ComposerAssessWorkspaceProps {
  readonly draft: Readonly<LabWorkflowDraftV2>;
  readonly validatorIssues: readonly ValidationIssue[];
  readonly ruleLabel: (rule: Readonly<WorkflowRule>) => string;
  readonly onAddCriterion: (
    criterion: Readonly<RubricCriterionSpecV2>
  ) => boolean;
  readonly onReplaceCriterion: (
    criterion: Readonly<RubricCriterionSpecV2>
  ) => boolean;
  readonly onRequestRemoval: (
    target: LabDraftRemovalTarget,
    label: string,
    trigger: HTMLElement
  ) => void;
}

function objectiveLabel(id: string): string {
  return id
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function ComposerAssessWorkspace({
  draft,
  validatorIssues,
  ruleLabel,
  onAddCriterion,
  onReplaceCriterion,
  onRequestRemoval
}: ComposerAssessWorkspaceProps) {
  const [selectedObjectiveId, setSelectedObjectiveId] = useState(
    draft.objectiveIds[0] ?? ""
  );
  const currentObjectiveId = draft.objectiveIds.includes(selectedObjectiveId)
    ? selectedObjectiveId
    : (draft.objectiveIds[0] ?? "");
  const criteria = useMemo(
    () =>
      draft.rubric.criteria.filter((criterion) =>
        criterion.objectiveIds.includes(currentObjectiveId)
      ),
    [currentObjectiveId, draft.rubric.criteria]
  );
  const [selectedCriterionId, setSelectedCriterionId] = useState(
    criteria[0]?.id ?? ""
  );
  const [creatingCriterion, setCreatingCriterion] = useState(false);

  const currentCriterionId =
    !creatingCriterion && criteria.some(({ id }) => id === selectedCriterionId)
      ? selectedCriterionId
      : creatingCriterion
        ? ""
        : (criteria[0]?.id ?? "");
  const selectedCriterion = draft.rubric.criteria.find(
    ({ id }) => id === currentCriterionId
  );
  const evidenceRules = draft.rules.filter(
    (rule) =>
      rule.kind !== "ordering" &&
      (selectedCriterion?.ruleIds.includes(rule.id) ||
        (!selectedCriterion && rule.objectiveIds.includes(currentObjectiveId)))
  );
  const rubricIssues = validatorIssues.filter(
    ({ path }) => path.startsWith("rubric") || path.includes("objective")
  );

  return (
    <section
      className={styles.assessWorkspace}
      aria-labelledby="assessment-heading"
    >
      <header>
        <p>How learning is scored</p>
        <h2 id="assessment-heading">Connect goals, grading, and evidence</h2>
      </header>
      <p className={styles.total}>
        Current total: <strong>{draft.rubric.totalPoints} points</strong>. The
        lab checker will flag missing evidence or scoring problems before
        Preview.
      </p>
      {rubricIssues.length > 0 && (
        <ul
          className={styles.validatorRelationshipIssues}
          aria-label="Assessment validator findings"
        >
          {rubricIssues.map((issue) => (
            <li key={`${issue.code}:${issue.path}`}>
              <strong>{issue.message}</strong>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.relationshipColumns}>
        <section aria-labelledby="objective-column-heading">
          <h3 id="objective-column-heading">Objectives</h3>
          <ul>
            {draft.objectiveIds.map((objectiveId) => {
              const criterionCount = draft.rubric.criteria.filter((criterion) =>
                criterion.objectiveIds.includes(objectiveId)
              ).length;
              return (
                <li key={objectiveId}>
                  <button
                    type="button"
                    aria-pressed={currentObjectiveId === objectiveId}
                    onClick={() => {
                      setSelectedObjectiveId(objectiveId);
                      setCreatingCriterion(false);
                    }}
                  >
                    <strong>{objectiveLabel(objectiveId)}</strong>
                    <small>
                      {criterionCount} grading item
                      {criterionCount === 1 ? "" : "s"}
                    </small>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        <section aria-labelledby="criterion-column-heading">
          <h3 id="criterion-column-heading">Grading items</h3>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => setCreatingCriterion(true)}
          >
            New grading item
          </button>
          {criteria.length === 0 ? (
            <p className={styles.empty}>
              No grading item has been added for this goal.
            </p>
          ) : (
            <ul>
              {criteria.map((criterion) => (
                <li key={criterion.id}>
                  <button
                    type="button"
                    aria-pressed={currentCriterionId === criterion.id}
                    onClick={() => {
                      setSelectedCriterionId(criterion.id);
                      setCreatingCriterion(false);
                    }}
                  >
                    <strong>{criterion.description}</strong>
                    <small>{criterion.maxPoints} points</small>
                  </button>
                  <button
                    type="button"
                    onClick={(event) =>
                      onRequestRemoval(
                        { kind: "rubric_criterion", criterionId: criterion.id },
                        criterion.description,
                        event.currentTarget
                      )
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="evidence-column-heading">
          <h3 id="evidence-column-heading">Evidence to look for</h3>
          {evidenceRules.length === 0 ? (
            <p className={styles.empty}>No evidence is connected yet.</p>
          ) : (
            <ul>
              {evidenceRules.map((rule) => (
                <li key={rule.id}>
                  <strong>{ruleLabel(rule)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <CriterionInspector
        key={selectedCriterion?.id ?? `new:${currentObjectiveId}`}
        draft={draft}
        objectiveId={currentObjectiveId}
        criterion={selectedCriterion}
        ruleLabel={ruleLabel}
        onAdd={onAddCriterion}
        onReplace={onReplaceCriterion}
      />
    </section>
  );
}

function CriterionInspector({
  draft,
  objectiveId,
  criterion,
  ruleLabel,
  onAdd,
  onReplace
}: {
  readonly draft: Readonly<LabWorkflowDraftV2>;
  readonly objectiveId: string;
  readonly criterion?: Readonly<RubricCriterionSpecV2>;
  readonly ruleLabel: (rule: Readonly<WorkflowRule>) => string;
  readonly onAdd: ComposerAssessWorkspaceProps["onAddCriterion"];
  readonly onReplace: ComposerAssessWorkspaceProps["onReplaceCriterion"];
}) {
  const objectiveRules = draft.rules.filter(
    (rule) =>
      rule.kind !== "ordering" && rule.objectiveIds.includes(objectiveId)
  );
  const [description, setDescription] = useState(criterion?.description ?? "");
  const [maxPoints, setMaxPoints] = useState(String(criterion?.maxPoints ?? 1));
  const [ruleIds, setRuleIds] = useState<readonly string[]>(
    criterion?.ruleIds ?? (objectiveRules[0] ? [objectiveRules[0].id] : [])
  );

  function save() {
    const points = Number(maxPoints);
    if (
      !description.trim() ||
      !objectiveId ||
      ruleIds.length === 0 ||
      !Number.isFinite(points) ||
      points <= 0
    )
      return;
    const existingNonRuleMappings =
      criterion?.evidenceMappings.filter(
        ({ kind }) => kind !== "rule_diagnosis"
      ) ?? [];
    const next: RubricCriterionSpecV2 = {
      id: criterion?.id ?? `teacher.criterion.${draft.revision}`,
      objectiveIds: [objectiveId],
      ruleIds: [...ruleIds],
      description: description.trim(),
      maxPoints: points,
      assessmentModeId:
        criterion?.assessmentModeId ?? "assessment.event_performance.v1",
      evidenceMappings: [
        ...existingNonRuleMappings,
        ...ruleIds.map((ruleId) => ({
          kind: "rule_diagnosis" as const,
          ruleId,
          required: true
        }))
      ],
      scoringGuide: criterion?.scoringGuide ?? [
        "0: evidence absent",
        `${points}: evidence demonstrated`
      ]
    };
    if (criterion) onReplace(next);
    else if (onAdd(next)) {
      setDescription("");
      setMaxPoints("1");
    }
  }

  return (
    <aside
      className={styles.criterionInspector}
      aria-label="Grading item editor"
    >
      <header>
        <p>{criterion ? "Edit grading item" : "Add grading item"}</p>
        <h3>
          {criterion
            ? criterion.description
            : objectiveLabel(objectiveId || "objective")}
        </h3>
      </header>
      <label>
        Description
        <input
          value={description}
          maxLength={4000}
          onChange={(event) => setDescription(event.currentTarget.value)}
        />
      </label>
      <label>
        Maximum points
        <input
          type="number"
          min="1"
          max="1000"
          value={maxPoints}
          aria-invalid={!(Number(maxPoints) > 0)}
          onChange={(event) => setMaxPoints(event.currentTarget.value)}
        />
      </label>
      <fieldset className={styles.objectiveChecks}>
        <legend>Evidence to use</legend>
        {objectiveRules.map((rule) => (
          <label key={rule.id}>
            <input
              type="checkbox"
              checked={ruleIds.includes(rule.id)}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setRuleIds((current) =>
                  checked
                    ? [...current, rule.id]
                    : current.filter((id) => id !== rule.id)
                );
              }}
            />
            {ruleLabel(rule)}
          </label>
        ))}
      </fieldset>
      <button
        type="button"
        className={styles.primaryButton}
        disabled={
          !description.trim() ||
          ruleIds.length === 0 ||
          !(Number(maxPoints) > 0)
        }
        onClick={save}
      >
        {criterion ? "Save grading item" : "Add grading item"}
      </button>
      {objectiveRules.length === 0 ? (
        <small className={styles.helpText} role="status">
          Add an activity check for this objective on the Workflow step before
          grading it.
        </small>
      ) : (
        (!description.trim() || ruleIds.length === 0) && (
          <small className={styles.helpText} role="status">
            Add a description and choose at least one piece of evidence to save.
          </small>
        )
      )}
    </aside>
  );
}
