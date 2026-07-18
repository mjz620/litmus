"use client";

import { type FormEvent, useState } from "react";

import type {
  ReportText,
  RubricResponse
} from "../../../lib/agent/evaluatorSchemas";
import { isTitrationState, useLabStore } from "../../../stores/labStore";
import { ReportFeedback } from "./ReportFeedback";

import styles from "./ReportForm.module.css";

const initialText: ReportText = {
  procedureSummary: "",
  dataAnalysis: "",
  conceptExplanation: "",
  sourcesOfError: ""
};
const reportFields: ReadonlyArray<[keyof ReportText, string]> = [
  ["procedureSummary", "Procedure summary"],
  ["dataAnalysis", "Data analysis"],
  ["conceptExplanation", "Concept explanation"],
  ["sourcesOfError", "Sources of error"]
];

export function ReportForm() {
  const sessionId = useLabStore((store) => store.sessionId);
  const state = useLabStore((store) =>
    isTitrationState(store.state) ? store.state : null
  );
  const model = useLabStore((store) => store.studentModel);
  const dispatch = useLabStore((store) => store.dispatch);
  const checkpoint = useLabStore((store) => store.checkpoint);
  const [studentText, setStudentText] = useState(initialText);
  const [reportedMolarity, setReportedMolarity] = useState("0.100");
  const [rubric, setRubric] = useState<RubricResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!sessionId || !state || !model) {
    return (
      <p className={styles.form}>
        Return to the lab and begin a session before writing the report.
      </p>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const molarity = Number(reportedMolarity);
    if (!Number.isFinite(molarity) || molarity <= 0) {
      setError("Enter a positive reported molarity.");
      return;
    }
    setPending(true);
    setError(null);
    dispatch({
      type: "submit_report",
      reportedMolarityM: molarity,
      explanation: studentText.conceptExplanation
    });
    const current = useLabStore.getState();
    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          experimentId: "acid_base_titration",
          finalState: current.state,
          events: current.eventQueue,
          studentModel: current.studentModel,
          labWorkflowContext: current.runtimeConsumerContext ?? undefined,
          studentText
        })
      });
      if (!response.ok)
        throw new Error(`Evaluation failed (${response.status}).`);
      setRubric((await response.json()) as RubricResponse);
      checkpoint(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Evaluation failed.");
    } finally {
      setPending(false);
    }
  }

  if (rubric) return <ReportFeedback rubric={rubric} sessionId={sessionId} />;

  return (
    <form className={styles.form} onSubmit={submit}>
      <h1>Lab report</h1>
      <label>
        Reported analyte molarity (M)
        <input
          type="number"
          min="0.0001"
          step="0.0001"
          value={reportedMolarity}
          onChange={(event) => setReportedMolarity(event.currentTarget.value)}
          required
        />
      </label>
      {reportFields.map(([field, label]) => (
        <label key={field}>
          {label}
          <textarea
            value={studentText[field]}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setStudentText((current) => ({
                ...current,
                [field]: value
              }));
            }}
            required
            maxLength={4000}
          />
        </label>
      ))}
      <button type="submit" disabled={pending}>
        {pending ? "Evaluating…" : "Submit report"}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
