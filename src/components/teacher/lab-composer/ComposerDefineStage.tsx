"use client";

import { useState } from "react";

import type {
  LabMetadataV2,
  LabWorkflowDraftV2
} from "../../../lab-workflows/schema/v2";
import { composerObjectiveCatalog } from "./catalog";

import styles from "./LabComposer.module.css";

interface ComposerDefineStageProps {
  readonly draft: Readonly<LabWorkflowDraftV2>;
  readonly onObjectiveToggle: (objectiveId: string, selected: boolean) => void;
  readonly onSaveMetadata: (metadata: Readonly<LabMetadataV2>) => boolean;
  readonly error?: string;
}

function teacherObjectiveDescription(description: string): string {
  return description
    .replace("verified reaction model", "supported reaction model")
    .replace("workflow-specific", "lab-specific")
    .replace("deterministic safety policies", "lab safety checks");
}

export function ComposerDefineStage({
  draft,
  onObjectiveToggle,
  onSaveMetadata,
  error
}: ComposerDefineStageProps) {
  const [metadata, setMetadata] = useState(draft.metadata);
  const [durationText, setDurationText] = useState(
    String(draft.metadata.estimatedMinutes)
  );

  function updateMetadata<Key extends keyof LabMetadataV2>(
    key: Key,
    value: LabMetadataV2[Key]
  ) {
    setMetadata((current) => ({ ...current, [key]: value }));
  }

  const titleValid = metadata.title.trim().length > 0;
  const summaryValid = metadata.studentSummary.trim().length > 0;
  const objectiveSummaryValid = metadata.learningObjective.trim().length > 0;
  const durationValid =
    Number.isInteger(metadata.estimatedMinutes) &&
    metadata.estimatedMinutes >= 1 &&
    metadata.estimatedMinutes <= 480 &&
    durationText.trim().length > 0;
  const canSave =
    titleValid && summaryValid && objectiveSummaryValid && durationValid;

  return (
    <section className={styles.workflowPanel}>
      <header>
        <p>Student purpose</p>
        <h2>Define the student experience</h2>
      </header>
      <div className={styles.definitionForm}>
        <label>
          Lab title (required)
          <input
            value={metadata.title}
            maxLength={160}
            required
            aria-invalid={!titleValid}
            onChange={(event) =>
              updateMetadata("title", event.currentTarget.value)
            }
          />
        </label>
        <label className={styles.fullRow}>
          Student summary (required)
          <textarea
            value={metadata.studentSummary}
            maxLength={4000}
            required
            aria-invalid={!summaryValid}
            onChange={(event) =>
              updateMetadata("studentSummary", event.currentTarget.value)
            }
          />
        </label>
        <label className={styles.fullRow}>
          Learning objective summary (required)
          <textarea
            value={metadata.learningObjective}
            maxLength={4000}
            required
            aria-invalid={!objectiveSummaryValid}
            onChange={(event) =>
              updateMetadata("learningObjective", event.currentTarget.value)
            }
          />
        </label>
        <label>
          Grade band
          <select
            value={metadata.gradeBand}
            onChange={(event) =>
              updateMetadata(
                "gradeBand",
                event.currentTarget.value as LabMetadataV2["gradeBand"]
              )
            }
          >
            <option value="9-10">Grades 9–10</option>
            <option value="11-12">Grades 11–12</option>
            <option value="mixed_high_school">Mixed high school</option>
          </select>
        </label>
        <label>
          Duration in minutes (required)
          <input
            type="number"
            min="1"
            max="480"
            value={durationText}
            required
            aria-invalid={!durationValid}
            onChange={(event) => {
              const raw = event.currentTarget.value;
              setDurationText(raw);
              // Do not silently coerce a cleared field to 0; only accept a
              // whole number of minutes in range.
              const parsed = Number(raw);
              if (
                raw.trim() !== "" &&
                Number.isInteger(parsed) &&
                parsed >= 1 &&
                parsed <= 480
              ) {
                updateMetadata("estimatedMinutes", parsed);
              }
            }}
          />
        </label>
        <label>
          Difficulty
          <select
            value={metadata.difficulty}
            onChange={(event) =>
              updateMetadata(
                "difficulty",
                event.currentTarget.value as LabMetadataV2["difficulty"]
              )
            }
          >
            <option value="intro">Intro</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={!canSave}
          title={canSave ? undefined : "Fill in every required field to save."}
          onClick={() => onSaveMetadata(metadata)}
        >
          Save definition
        </button>
        {!canSave && (
          <small className={styles.helpText} role="status">
            Add a title, student summary, learning objective, and a duration of
            1–480 minutes to save.
          </small>
        )}
        {error && (
          <small className={styles.inlineError} role="alert">
            {error}
          </small>
        )}
      </div>
      <section
        className={styles.objectiveSection}
        aria-labelledby="learning-objectives-heading"
      >
        <h3 id="learning-objectives-heading">Learning objectives</h3>
        <p className={styles.lede}>
          Choose the skills students should demonstrate. If an objective is
          already used elsewhere, you can review what will change before
          removing it.
        </p>
        <div className={styles.checkList}>
          {composerObjectiveCatalog.map((objective) => {
            const selected = draft.objectiveIds.includes(objective.id);
            return (
              <label key={objective.id}>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onObjectiveToggle(objective.id, selected)}
                />
                <span>
                  <strong>
                    {objective.id
                      .replaceAll("_", " ")
                      .replace(/\b\w/g, (letter) => letter.toUpperCase())}
                  </strong>
                  <small>
                    {teacherObjectiveDescription(objective.description)}
                  </small>
                </span>
              </label>
            );
          })}
        </div>
      </section>
    </section>
  );
}
