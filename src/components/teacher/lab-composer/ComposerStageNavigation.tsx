import {
  COMPOSER_STAGES,
  summarizeStageReadiness,
  type ComposerStageId
} from "./composerStages";
import type { LabWorkflowDraftV2 } from "../../../lab-workflows/schema/v2";

import styles from "./LabComposer.module.css";

interface ComposerStageNavigationProps {
  readonly activeStage: ComposerStageId;
  readonly draft: Readonly<LabWorkflowDraftV2>;
  readonly onStageChange: (stageId: ComposerStageId) => void;
}

export function ComposerStageNavigation({
  activeStage,
  draft,
  onStageChange
}: ComposerStageNavigationProps) {
  return (
    <nav className={styles.stageNavigation} aria-label="Lab authoring stages">
      <ol>
        {COMPOSER_STAGES.map((stage, index) => {
          const readiness = summarizeStageReadiness(draft, stage.id);
          return (
            <li key={stage.id}>
              <button
                type="button"
                aria-current={activeStage === stage.id ? "step" : undefined}
                onClick={() => onStageChange(stage.id)}
              >
                <span aria-hidden="true">{index + 1}</span>
                <strong>{stage.label}</strong>
                <small data-state={readiness.state}>{readiness.summary}</small>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
