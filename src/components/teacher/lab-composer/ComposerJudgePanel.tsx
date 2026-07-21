import {
  WORKFLOW_JUDGE_LIMITS,
  type WorkflowJudgeResponse
} from "../../../lib/agent/lab-workflow-judge/schemas";
import type { ComposerJudgeSuggestion } from "./composerJudgeCycle";
import { COMPOSER_JUDGE_REQUEST_TIMEOUT_MS } from "./workflowJudgeClient";

import styles from "./LabComposer.module.css";

export type ComposerJudgeStatus =
  | "idle"
  | "running"
  | "current"
  | "stale"
  | "stopped";

export interface ComposerJudgeHistoryEntry {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly outcome: "review" | "accepted" | "rejected" | "skipped" | "stopped";
}

interface ComposerJudgePanelProps {
  readonly validatorReady: boolean;
  readonly status: ComposerJudgeStatus;
  readonly review: WorkflowJudgeResponse | null;
  readonly suggestions: readonly ComposerJudgeSuggestion[];
  readonly dismissedIssueIds: ReadonlySet<string>;
  readonly history: readonly ComposerJudgeHistoryEntry[];
  readonly callsRemaining: number;
  readonly revisionsRemaining: number;
  readonly error: string | null;
  readonly terminationReason: string | null;
  /**
   * Set when the viewer cannot call the review API (guests and students — the
   * route is teacher-gated). Shown in place of the remaining-calls line so the
   * requirement is visible before a click rather than after a failed request.
   */
  readonly signInNotice: string | null;
  readonly onReview: () => void;
  readonly onAcceptSuggestion: (suggestion: ComposerJudgeSuggestion) => void;
  readonly onSkipSuggestion: (suggestion: ComposerJudgeSuggestion) => void;
}

function recommendationLabel(
  recommendation: WorkflowJudgeResponse["critique"]["recommendation"]
): string {
  switch (recommendation) {
    case "approve":
      return "Teaching review looks good";
    case "revise":
      return "Teaching review suggests changes";
    case "mark_partially_supported":
      return "The learning goal may be broader than this lab";
    case "reject":
      return "Teaching review recommends a different approach";
  }
}

export function ComposerJudgePanel({
  validatorReady,
  status,
  review,
  suggestions,
  dismissedIssueIds,
  history,
  callsRemaining,
  revisionsRemaining,
  error,
  terminationReason,
  signInNotice,
  onReview,
  onAcceptSuggestion,
  onSkipSuggestion
}: ComposerJudgePanelProps) {
  const visibleSuggestions = suggestions.filter(
    ({ issueId }) => !dismissedIssueIds.has(issueId)
  );
  const averageScore = review
    ? review.critique.scores.reduce((sum, { score }) => sum + score, 0) /
      review.critique.scores.length
    : null;

  return (
    <aside
      className={styles.judgePanel}
      aria-labelledby="judge-panel-heading"
      aria-busy={status === "running"}
      data-status={status}
    >
      <header className={styles.judgePanelHeader}>
        <div>
          <p>Optional AI teaching review · advisory</p>
          <h3 id="judge-panel-heading">Review the learning experience</h3>
        </div>
        <strong>
          {status === "running"
            ? "Reviewing…"
            : status === "stale"
              ? "Out of date"
              : review
                ? recommendationLabel(review.critique.recommendation)
                : "Not run"}
        </strong>
      </header>

      <p className={styles.judgeAuthorityNote}>
        This review can suggest teaching improvements. It cannot approve the
        simulation or turn on Preview; only the Litmus checker can do that.
      </p>

      {!review && status !== "running" && (
        <p>
          Run this only after the lab checker passes. Litmus will repeat five
          student scenarios before asking for teaching feedback.
        </p>
      )}

      {status === "stale" && (
        <p className={styles.judgeStaleNotice} role="status">
          The draft changed after this review. Check the lab, repeat the
          scenarios, and request a new review before using any suggestion.
        </p>
      )}

      {error && (
        <p className={styles.agentError} role="alert">
          {error}
        </p>
      )}

      {review && (
        <div className={styles.judgeReviewBody}>
          <dl className={styles.judgeReviewSummary}>
            <div>
              <dt>Teaching score</dt>
              <dd>{averageScore?.toFixed(1)} / 5</dd>
            </div>
            <div>
              <dt>Suggestions to consider</dt>
              <dd>{review.critique.issues.length}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{review.critique.uncertainty.level}</dd>
            </div>
          </dl>
          <p>{review.critique.summary}</p>

          {review.critique.strengths.length > 0 && (
            <section aria-labelledby="judge-strengths-heading">
              <h4 id="judge-strengths-heading">What is working well</h4>
              <ul>
                {review.critique.strengths.map((strength, index) => (
                  <li key={`${strength.statement}-${index}`}>
                    {strength.statement}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {review.critique.issues.length > 0 && (
            <section aria-labelledby="judge-issues-heading">
              <h4 id="judge-issues-heading">What to improve</h4>
              <ul className={styles.judgeIssueList}>
                {review.critique.issues.map((issue) => {
                  const suggestion = visibleSuggestions.find(
                    ({ issueId }) => issueId === issue.id
                  );
                  return (
                    <li key={issue.id}>
                      <strong>{issue.critique}</strong>
                      <span>{issue.suggestedRevision}</span>
                      {suggestion && status === "current" && (
                        <div>
                          <p>
                            <strong>{suggestion.label}</strong>
                            <br />
                            {suggestion.explanation}
                          </p>
                          <button
                            type="button"
                            disabled={
                              revisionsRemaining === 0 || callsRemaining === 0
                            }
                            onClick={() => onAcceptSuggestion(suggestion)}
                          >
                            Apply, check, and review again
                          </button>
                          <button
                            type="button"
                            onClick={() => onSkipSuggestion(suggestion)}
                          >
                            Skip suggestion
                          </button>
                        </div>
                      )}
                      {dismissedIssueIds.has(issue.id) && (
                        <small>Skipped by teacher.</small>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}

      <div className={styles.judgePanelActions}>
        <button
          type="button"
          disabled={
            !validatorReady ||
            status === "running" ||
            callsRemaining === 0 ||
            signInNotice !== null
          }
          onClick={onReview}
        >
          {status === "running"
            ? "Repeating scenarios…"
            : review
              ? "Run a fresh teaching review"
              : "Run teaching review"}
        </button>
        <small>
          {signInNotice ?? (
            <>
              {callsRemaining} review call{callsRemaining === 1 ? "" : "s"} and{" "}
              {revisionsRemaining} suggested change
              {revisionsRemaining === 1 ? "" : "s"} left in this page session.
            </>
          )}
        </small>
      </div>

      {terminationReason && (
        <p className={styles.judgeTermination} role="status">
          <strong>Review stopped:</strong> {terminationReason}
        </p>
      )}

      {history.length > 0 && (
        <details className={styles.judgeHistory}>
          <summary>Teaching review history ({history.length})</summary>
          <ol>
            {history.map((entry) => (
              <li key={entry.id} data-outcome={entry.outcome}>
                <strong>{entry.title}</strong>
                <span>{entry.detail}</span>
              </li>
            ))}
          </ol>
        </details>
      )}

      <details className={styles.judgeHistory}>
        <summary>Review limits and usage</summary>
        <dl className={styles.judgeReviewSummary}>
          <div>
            <dt>Page-session limit</dt>
            <dd>
              {callsRemaining} of 3 reviews · {revisionsRemaining} of 2 changes
              left
            </dd>
          </div>
          <div>
            <dt>Time limit</dt>
            <dd>
              {COMPOSER_JUDGE_REQUEST_TIMEOUT_MS / 1_000} seconds per review
            </dd>
          </div>
          <div>
            <dt>Response limit</dt>
            <dd>
              {WORKFLOW_JUDGE_LIMITS.maxOutputTokens.toLocaleString()} tokens
            </dd>
          </div>
          <div>
            <dt>Latest usage</dt>
            <dd>
              {review
                ? `${(
                    review.metadata.promptTokens + review.metadata.outputTokens
                  ).toLocaleString()} tokens · ${
                    review.metadata.estimatedCost.amount === null
                      ? "provider price not supplied"
                      : new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: review.metadata.estimatedCost.currency,
                          maximumFractionDigits: 4
                        }).format(review.metadata.estimatedCost.amount)
                  }`
                : "No review usage yet"}
            </dd>
          </div>
        </dl>
      </details>
    </aside>
  );
}
