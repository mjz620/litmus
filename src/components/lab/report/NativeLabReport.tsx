"use client";

import { type FormEvent, useState } from "react";

import {
  AUTHORED_EVALUATOR_CONTRACT_VERSION,
  type AuthoredEvaluationResponse
} from "../../../lib/agent/evaluatorSchemas";
import { createAuthoredEvaluationRequest } from "../../../lib/agent/authoredEvaluator";
import { currentApiPath } from "../../../lib/demo/demoEnvironment";
import type { GenericLabState } from "../../../lab-workflows/runtime";
import type { ValidatedLabWorkflowSpecV2 } from "../../../lab-workflows/schema/v2";

import styles from "./ReportForm.module.css";

interface ReportText {
  procedureSummary: string;
  dataAnalysis: string;
  conceptExplanation: string;
  sourcesOfError: string;
}

const EMPTY_REPORT: ReportText = {
  procedureSummary: "",
  dataAnalysis: "",
  conceptExplanation: "",
  sourcesOfError: ""
};

const REPORT_FIELDS: ReadonlyArray<
  readonly [keyof ReportText, string, string]
> = [
  [
    "procedureSummary",
    "What you did",
    "Summarise the procedure you actually carried out, in order."
  ],
  [
    "dataAnalysis",
    "What you measured",
    "Give your readings and what you worked out from them."
  ],
  [
    "conceptExplanation",
    "Why it happened",
    "Explain the chemistry behind what you observed."
  ],
  [
    "sourcesOfError",
    "What could have gone wrong",
    "Identify sources of error and how they would shift your result."
  ]
];

export interface NativeLabReportProps {
  readonly workflow: Readonly<ValidatedLabWorkflowSpecV2>;
  readonly sessionId: string;
  readonly runtimeState: Readonly<GenericLabState>;
}

/**
 * Lab report for any capability-native workflow.
 *
 * Report submission was previously wired only to titration — the route
 * 404'd for every other experiment — even though each workflow already
 * carries its own rubric and the v2 evaluator grades against whatever
 * definition it is handed. This surface is therefore workflow-agnostic: the
 * criteria shown, and the criteria graded, come from the lab the student
 * actually ran.
 */
export function NativeLabReport({
  workflow,
  sessionId,
  runtimeState
}: NativeLabReportProps) {
  const [report, setReport] = useState<ReportText>(EMPTY_REPORT);
  const [result, setResult] = useState<AuthoredEvaluationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const request = createAuthoredEvaluationRequest({
        sessionId,
        experimentId: workflow.id,
        assignedDefinition: workflow,
        runtimeState,
        report
      });
      const response = await fetch(currentApiPath("/api/evaluate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ...request,
          contractVersion: AUTHORED_EVALUATOR_CONTRACT_VERSION
        })
      });
      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "Sign in to submit a graded report. Your work is still saved."
            : `Evaluation is unavailable (${response.status}).`
        );
      }
      setResult((await response.json()) as AuthoredEvaluationResponse);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Evaluation is unavailable."
      );
    } finally {
      setPending(false);
    }
  }

  if (result) {
    const { criteria, earnedPoints, possiblePoints, overallSummary } =
      result.result;
    const deterministic = result.metadata.mode === "deterministic_fallback";
    return (
      <section className={styles.form} aria-labelledby="report-result-heading">
        <h1 id="report-result-heading">Report feedback</h1>
        <p>
          {earnedPoints} of {possiblePoints} points
        </p>
        <p>{overallSummary}</p>
        {deterministic && (
          /*
           * The evaluator falls back to deterministic scoring when the model
           * is unavailable or its output fails the grounding guards. Say so,
           * rather than presenting rule-derived marks as written feedback.
           */
          <p className="ui-notice" data-tone="warning">
            Scored from the lab&apos;s recorded evidence without written
            feedback from the model.
          </p>
        )}
        <ol>
          {criteria.map((criterion) => {
            const authored = workflow.rubric.criteria.find(
              ({ id }) => id === criterion.criterionId
            );
            return (
              <li key={criterion.criterionId}>
                <strong>
                  {authored?.description ?? criterion.criterionId}
                </strong>
                <p>
                  {criterion.score} / {authored?.maxPoints ?? "\u2014"} —{" "}
                  {criterion.feedback}
                </p>
              </li>
            );
          })}
        </ol>
      </section>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <h1>{workflow.metadata.title} — lab report</h1>
      <p>{workflow.metadata.learningObjective}</p>

      {workflow.rubric.criteria.length > 0 && (
        <section aria-labelledby="report-rubric-heading">
          <h2 id="report-rubric-heading">What this report is graded on</h2>
          <ul>
            {workflow.rubric.criteria.map((criterion) => (
              <li key={criterion.id}>
                {criterion.description} ({criterion.maxPoints} points)
              </li>
            ))}
          </ul>
        </section>
      )}

      {REPORT_FIELDS.map(([field, label, hint]) => (
        <label key={field}>
          {label}
          <span>{hint}</span>
          <textarea
            value={report[field]}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setReport((current) => ({ ...current, [field]: value }));
            }}
            required
            maxLength={4000}
          />
        </label>
      ))}

      <button className="ui-button" type="submit" disabled={pending}>
        {pending ? "Evaluating…" : "Submit report"}
      </button>
      {error && (
        <p className="ui-notice" data-tone="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
