import type { LabWorkflowV2ValidationOutcome } from "../../../lab-workflows/validation";
import {
  COMPOSER_STAGES,
  stageForIssuePath,
  type ComposerStageId
} from "./composerStages";

import styles from "./LabComposer.module.css";

interface ComposerValidationIssuesProps {
  readonly issues: LabWorkflowV2ValidationOutcome["issues"];
  readonly onReviewStage: (stageId: ComposerStageId) => void;
}

export function ComposerValidationIssues({
  issues,
  onReviewStage
}: ComposerValidationIssuesProps) {
  if (issues.length === 0) return null;
  return (
    <ul className={styles.issueList}>
      {issues.map((issue, index) => {
        const stageId = stageForIssuePath(issue.path);
        const stageLabel =
          COMPOSER_STAGES.find(({ id }) => id === stageId)?.label ?? "Validate";
        return (
          <li
            key={`${issue.code}:${issue.path}:${index}`}
            data-severity={issue.severity}
          >
            <strong>{issue.message}</strong>
            <span>Review the {stageLabel} task.</span>
            <em>
              {stageLabel} · {issue.severity}
              {issue.safetyRelated ? " · safety-related" : ""}
            </em>
            <button type="button" onClick={() => onReviewStage(stageId)}>
              Review {stageLabel}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
