import type { RefObject } from "react";

import type { LabWorkflowDraftV2 } from "../../../lab-workflows/schema/v2";
import { ComposerStageNavigation } from "./ComposerStageNavigation";
import {
  COMPOSER_STAGE_IDS,
  COMPOSER_STAGES,
  summarizeStageReadiness,
  type ComposerStageId
} from "./composerStages";

import styles from "./LabComposer.module.css";

interface ComposerStageChromeProps {
  readonly stage: ComposerStageId;
  readonly draft: Readonly<LabWorkflowDraftV2>;
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
  readonly onStageChange: (stageId: ComposerStageId) => void;
}

export function ComposerStageChrome({
  stage,
  draft,
  headingRef,
  onStageChange
}: ComposerStageChromeProps) {
  const definition =
    COMPOSER_STAGES.find(({ id }) => id === stage) ?? COMPOSER_STAGES[0];
  const readiness = summarizeStageReadiness(draft, stage);

  return (
    <>
      <ComposerStageNavigation
        activeStage={stage}
        draft={draft}
        onStageChange={onStageChange}
      />
      <section className={styles.stageIntroduction} aria-live="polite">
        <div>
          <p>Authoring task</p>
          <h2 ref={headingRef} tabIndex={-1}>
            {definition.label}
          </h2>
          <span>{definition.purpose}</span>
        </div>
        <aside data-state={readiness.state}>
          <strong>Draft checklist</strong>
          <span>{readiness.summary}</span>
          <small>Use Check &amp; preview for the final readiness check.</small>
        </aside>
      </section>
    </>
  );
}

interface ComposerStageFooterProps {
  readonly stage: ComposerStageId;
  readonly onStageChange: (stageId: ComposerStageId) => void;
}

export function ComposerStageFooter({
  stage,
  onStageChange
}: ComposerStageFooterProps) {
  const index = COMPOSER_STAGE_IDS.indexOf(stage);
  const previous = COMPOSER_STAGE_IDS[index - 1];
  const next = COMPOSER_STAGE_IDS[index + 1];

  return (
    <nav className={styles.stageFooter} aria-label="Composer navigation">
      <button
        type="button"
        disabled={!previous}
        title={previous ? undefined : "This is the first task"}
        onClick={() => previous && onStageChange(previous)}
      >
        Previous
      </button>
      <span>
        {index + 1} of {COMPOSER_STAGE_IDS.length}
      </span>
      <button
        className={styles.primaryButton}
        type="button"
        disabled={!next}
        title={next ? undefined : "This is the final task"}
        onClick={() => next && onStageChange(next)}
      >
        Next
      </button>
    </nav>
  );
}
