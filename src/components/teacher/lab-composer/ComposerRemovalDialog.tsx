"use client";

import { useMemo, useState } from "react";

import type {
  LabDraftRemovalImpact,
  LabDraftRemovalResolution,
  RemovalResolutionKind
} from "../../../lab-workflows/authoring";
import type { LabWorkflowDraftV2 } from "../../../lab-workflows/schema/v2";
import { ComposerDialog } from "./ComposerDialog";

import styles from "./LabComposer.module.css";

interface ComposerRemovalDialogProps {
  readonly impact: Readonly<LabDraftRemovalImpact> | null;
  readonly draft: Readonly<LabWorkflowDraftV2>;
  readonly label: string;
  readonly error?: string | null;
  readonly returnFocusTo?: HTMLElement | null;
  readonly onCancel: () => void;
  readonly onConfirm: (
    resolution: LabDraftRemovalResolution,
    confirmations: {
      readonly compatibility: boolean;
      readonly dependents: boolean;
    }
  ) => void;
}

const RESOLUTION_LABELS: Readonly<Record<RemovalResolutionKind, string>> = {
  remove_only: "Remove",
  cascade: "Remove and update the rest of the lab",
  reassign: "Move related items to another objective",
  detach: "Keep related items where possible",
  remove_dependents: "Remove this and its related items"
};

const IMPACT_LABELS: Readonly<
  Record<LabDraftRemovalImpact["references"][number]["kind"], string>
> = {
  adaptive_retry: "Retry guidance",
  coach_trigger: "Coaching prompt",
  compatibility_binding: "Current simulation setup",
  instruction: "Student instruction",
  instruction_guidance: "Student guidance",
  layout_placement: "Bench placement",
  material_binding: "Material placement",
  material_label: "Material name",
  permitted_action: "Student interaction",
  rubric_criterion: "Grading item",
  rule_prompt: "Teacher prompt",
  safety_binding: "Safety guidance",
  workflow_rule: "Workflow step"
};

export function ComposerRemovalDialog({
  impact,
  draft,
  label,
  error,
  returnFocusTo,
  onCancel,
  onConfirm
}: ComposerRemovalDialogProps) {
  const replacementObjectives = useMemo(() => {
    const target = impact?.target;
    return target?.kind === "objective"
      ? draft.objectiveIds.filter((id) => id !== target.objectiveId)
      : [];
  }, [draft.objectiveIds, impact]);
  const preferredResolution = impact?.allowedResolutions.includes("reassign")
    ? "reassign"
    : (impact?.allowedResolutions[0] ?? "remove_only");
  const [resolutionKind, setResolutionKind] =
    useState<RemovalResolutionKind>(preferredResolution);
  const [replacementObjectiveId, setReplacementObjectiveId] = useState(
    replacementObjectives[0] ?? ""
  );
  const [confirmed, setConfirmed] = useState(false);
  const affectedGroups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const reference of impact?.references ?? []) {
      const label = IMPACT_LABELS[reference.kind];
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([left], [right]) =>
      left.localeCompare(right)
    );
  }, [impact]);

  if (!impact) return null;
  const currentImpact = impact;
  const destructive =
    resolutionKind === "cascade" || resolutionKind === "remove_dependents";
  const requiresConfirmation =
    destructive &&
    (impact.references.length > 0 || impact.compatibilityEffects.length > 0);
  const confirmDisabled =
    (resolutionKind === "reassign" && !replacementObjectiveId) ||
    (requiresConfirmation && !confirmed);

  function confirm() {
    const resolution: LabDraftRemovalResolution =
      resolutionKind === "reassign"
        ? { kind: "reassign", replacementObjectiveId }
        : { kind: resolutionKind };
    onConfirm(resolution, {
      compatibility:
        currentImpact.compatibilityEffects.length === 0 || confirmed,
      dependents: currentImpact.references.length === 0 || confirmed
    });
  }

  return (
    <ComposerDialog
      open
      title={`Remove ${label}?`}
      description="Review what else will change. If the lab changes while this window is open, nothing will be removed until you review it again."
      confirmLabel={
        resolutionKind === "reassign" ? "Move items and remove" : "Remove"
      }
      destructive={destructive}
      confirmDisabled={confirmDisabled}
      returnFocusTo={returnFocusTo}
      onCancel={onCancel}
      onConfirm={confirm}
    >
      <fieldset className={styles.removalChoices}>
        <legend>What should happen to related items?</legend>
        {impact.allowedResolutions.map((kind) => (
          <label key={kind}>
            <input
              type="radio"
              name="removal-resolution"
              value={kind}
              checked={resolutionKind === kind}
              onChange={() => {
                setResolutionKind(kind);
                setConfirmed(false);
              }}
            />
            <span>{RESOLUTION_LABELS[kind]}</span>
          </label>
        ))}
      </fieldset>
      {resolutionKind === "reassign" && (
        <label>
          Move related items to
          <select
            value={replacementObjectiveId}
            onChange={(event) =>
              setReplacementObjectiveId(event.currentTarget.value)
            }
          >
            {replacementObjectives.map((objectiveId) => (
              <option key={objectiveId} value={objectiveId}>
                {objectiveId.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      )}
      {impact.references.length > 0 && (
        <section
          className={styles.impactSection}
          aria-label="Other parts of the lab that will change"
        >
          <h3>Other parts of the lab that will change</h3>
          <ul>
            {affectedGroups.map(([affectedLabel, count]) => (
              <li key={affectedLabel}>
                <strong>{affectedLabel}</strong>
                <span>
                  {count} item{count === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {impact.compatibilityEffects.length > 0 && (
        <section
          className={styles.compatibilityWarning}
          aria-label="Preview availability"
        >
          <h3>Preview will be unavailable</h3>
          <p>
            This equipment is needed by the current simulation. You can still
            remove it, but Preview will stay off until a supported replacement
            is added and the lab passes its checks again.
          </p>
        </section>
      )}
      {requiresConfirmation && (
        <label className={styles.destructiveConfirmation}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.currentTarget.checked)}
          />
          I understand that the related items listed above will also change.
        </label>
      )}
      {error && (
        <p className={styles.inlineError} role="alert">
          {error}
        </p>
      )}
    </ComposerDialog>
  );
}
