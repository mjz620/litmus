import type { FormEvent } from "react";

import type {
  CapabilityAuthorSuccessResponse,
  CapabilityAuthorProgress,
  CapabilityAuthorTraceSummary
} from "../../../lib/agent/lab-authoring/capabilityAuthorSchemas";

import styles from "./LabComposer.module.css";

export type ComposerAgentEvidenceState = "ready" | "loaded" | "stale";

interface ComposerAgentWorkspaceProps {
  readonly teacherRequest: string;
  readonly proposal: CapabilityAuthorSuccessResponse | null;
  readonly evidenceState: ComposerAgentEvidenceState | null;
  readonly remainingRequests: number;
  /**
   * Set when the viewer cannot call the proposal API (guests and students —
   * the route is teacher-gated). Rendered in place of the quota line so the
   * requirement is visible before a click instead of surfacing as a 401.
   */
  readonly signInNotice: string | null;
  readonly busy: boolean;
  readonly progressUpdates: readonly CapabilityAuthorProgress[];
  readonly error: string | null;
  readonly onTeacherRequestChange: (value: string) => void;
  readonly onGenerate: () => void;
  readonly onUseDraft: () => void;
  readonly onReject: () => void;
  readonly onRevalidate: () => void;
}

const TRACE_LABELS: Readonly<
  Record<CapabilityAuthorTraceSummary["kind"], string>
> = Object.freeze({
  valid: "Typical successful run",
  alternate_valid: "Another valid order",
  recoverable_mistake: "A mistake students can fix",
  terminal_mistake: "A mistake that must stop the run",
  tolerance_boundary: "A result at the accepted boundary"
});

const AUTHORING_STEPS: ReadonlyArray<
  Readonly<{ stage: CapabilityAuthorProgress["stage"]; label: string }>
> = Object.freeze([
  { stage: "understanding_request", label: "Understand the request" },
  { stage: "checking_available_parts", label: "Check available lab parts" },
  { stage: "building_draft", label: "Build the draft" },
  { stage: "checking_lab", label: "Check safety and compatibility" },
  { stage: "testing_student_paths", label: "Test student paths" },
  { stage: "finalizing", label: "Prepare for review" }
]);

function outcomeLabel(
  outcome: CapabilityAuthorSuccessResponse["result"]["outcome"]
): string {
  switch (outcome) {
    case "runnable":
      return "Ready for your review";
    case "needs_clarification":
      return "Needs a little more detail";
    case "unsupported":
      return "Not supported by the available lab tools";
    case "rejected_for_safety":
      return "Cannot be built safely";
    case "limited":
      return "Could not finish within the safe limits";
  }
}

function supportLabel(proposal: CapabilityAuthorSuccessResponse): string {
  if (!proposal.result.workflow) return "No simulation selected";
  return proposal.result.workflow.compatibility
    ? "Established titration simulation"
    : "Flexible equipment-and-action simulation";
}

function costLabel(proposal: CapabilityAuthorSuccessResponse): string {
  const cost = proposal.metadata.usage.estimatedCost;
  if (cost.amount === null) return "Price not supplied by the model provider";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: cost.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(cost.amount);
}

function submitLabel(
  hasProposal: boolean,
  remainingRequests: number,
  busy: boolean
): string {
  if (busy) return "Building proposal…";
  if (hasProposal) return `Try revised description (${remainingRequests} left)`;
  return "Create draft proposal";
}

export function ComposerAgentWorkspace({
  teacherRequest,
  proposal,
  evidenceState,
  remainingRequests,
  signInNotice,
  busy,
  progressUpdates,
  error,
  onTeacherRequestChange,
  onGenerate,
  onUseDraft,
  onReject,
  onRevalidate
}: ComposerAgentWorkspaceProps) {
  const result = proposal?.result ?? null;
  const workflowCanBeUsed =
    result?.outcome === "runnable" &&
    result.workflow !== null &&
    result.validation?.runnable === true &&
    result.traces.length === 5 &&
    result.traces.every(({ passed }) => passed);
  const passedTraces =
    result?.traces.filter(({ passed }) => passed).length ?? 0;
  const currentProgress = progressUpdates.at(-1) ?? null;
  const completedProgressStages = new Set(
    progressUpdates.slice(0, -1).map(({ stage }) => stage)
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onGenerate();
  }

  return (
    <section
      className={styles.agentWorkspace}
      aria-labelledby="agent-workspace-heading"
      data-proposal-state={evidenceState ?? "none"}
    >
      <header className={styles.agentWorkspaceHeader}>
        <div>
          <p>Optional starting point</p>
          <h2 id="agent-workspace-heading">Describe the lab you want</h2>
        </div>
        <span>
          AI suggests a structure. Litmus runs the safety, support, and
          simulation checks.
        </span>
      </header>

      <form className={styles.agentRequestForm} onSubmit={submit}>
        <label>
          Lab description
          <textarea
            value={teacherRequest}
            maxLength={2_000}
            placeholder="For example: Create a sodium chloride dilution using a volumetric pipette and flask."
            onChange={(event) =>
              onTeacherRequestChange(event.currentTarget.value)
            }
          />
        </label>
        <div>
          <button
            className={styles.agentGenerateButton}
            type="submit"
            disabled={
              busy ||
              remainingRequests === 0 ||
              !teacherRequest.trim() ||
              signInNotice !== null
            }
          >
            {submitLabel(proposal !== null, remainingRequests, busy)}
          </button>
          <small>
            {signInNotice ??
              (remainingRequests === 0
                ? "This page-session proposal limit has been reached."
                : `${remainingRequests} bounded proposal request${remainingRequests === 1 ? "" : "s"} available in this page session.`)}
          </small>
        </div>
      </form>

      {busy && (
        <section
          className={styles.agentProgress}
          aria-labelledby="agent-progress-heading"
          aria-live="polite"
        >
          <header>
            <span aria-hidden="true">✦</span>
            <div>
              <h3 id="agent-progress-heading">Building your lab</h3>
              <p>{currentProgress?.message ?? "Starting the lab helper…"}</p>
            </div>
          </header>
          <ol>
            {AUTHORING_STEPS.map((step) => {
              const state = completedProgressStages.has(step.stage)
                ? "complete"
                : step.stage ===
                    (currentProgress?.stage ?? AUTHORING_STEPS[0]?.stage)
                  ? "current"
                  : "upcoming";
              return (
                <li key={step.stage} data-state={state}>
                  <span aria-hidden="true">
                    {state === "complete"
                      ? "✓"
                      : state === "current"
                        ? "●"
                        : "○"}
                  </span>
                  {step.label}
                </li>
              );
            })}
          </ol>
          <small>
            This shows the actions the helper is taking, not private model
            thoughts.
          </small>
          {progressUpdates.some(
            ({ stage }) => stage === "using_verified_fallback"
          ) && (
            <p className={styles.agentFallbackNotice}>
              The live helper did not finish, so Litmus continued with its
              verified local builder.
            </p>
          )}
        </section>
      )}

      {error && (
        <p className={styles.agentError} role="alert">
          {error}
        </p>
      )}

      {proposal && result && (
        <article
          className={styles.agentProposal}
          data-proposal-outcome={result.outcome}
        >
          <header className={styles.agentProposalHeader}>
            <div>
              <p>AI suggestion</p>
              <h3>{result.objective}</h3>
            </div>
            <strong>{outcomeLabel(result.outcome)}</strong>
          </header>

          <div className={styles.agentSuggestionGrid}>
            <section aria-labelledby="agent-assumptions-heading">
              <h4 id="agent-assumptions-heading">What this draft assumes</h4>
              {result.assumptions.length > 0 ? (
                <ul>
                  {result.assumptions.map((assumption) => (
                    <li key={assumption}>{assumption}</li>
                  ))}
                </ul>
              ) : (
                <p>No extra assumptions.</p>
              )}
            </section>
            {result.questions.length > 0 && (
              <section aria-labelledby="agent-questions-heading">
                <h4 id="agent-questions-heading">What to clarify</h4>
                <ul>
                  {result.questions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </section>
            )}
            {result.limitations.length > 0 && (
              <section aria-labelledby="agent-limitations-heading">
                <h4 id="agent-limitations-heading">Current limits</h4>
                <ul>
                  {result.limitations.map((limitation) => (
                    <li key={limitation}>{limitation}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {result.workflow && result.validation && (
            <section
              className={styles.agentDeterministicChecks}
              aria-labelledby="agent-checks-heading"
            >
              <header>
                <div>
                  <p>Litmus checks · deterministic</p>
                  <h4 id="agent-checks-heading">What the simulator verified</h4>
                </div>
                <strong>
                  {evidenceState === "stale"
                    ? "Out of date after editing"
                    : result.validation.runnable
                      ? "Passed"
                      : "Needs changes"}
                </strong>
              </header>

              {evidenceState === "stale" && (
                <div className={styles.agentStaleNotice} role="status">
                  <strong>
                    The generated checks no longer match this draft.
                  </strong>
                  <span>
                    Check the edited lab again before Preview. Generate a new
                    proposal to rerun all five practice runs.
                  </span>
                  <button type="button" onClick={onRevalidate}>
                    Check edited draft
                  </button>
                </div>
              )}

              <dl className={styles.agentCheckSummary}>
                <div>
                  <dt>Lab check</dt>
                  <dd>
                    {result.validation.runnable ? "Passed" : "Needs work"}
                  </dd>
                </div>
                <div>
                  <dt>Practice runs</dt>
                  <dd>
                    {passedTraces} of {result.traces.length} passed
                  </dd>
                </div>
                <div>
                  <dt>Simulation</dt>
                  <dd>{supportLabel(proposal)}</dd>
                </div>
              </dl>

              <ul className={styles.agentTraceList}>
                {result.traces.map((trace) => (
                  <li key={trace.traceId} data-passed={trace.passed}>
                    <strong>{TRACE_LABELS[trace.kind]}</strong>
                    <span>{trace.passed ? "Passed" : "Needs review"}</span>
                    <small>
                      {trace.actionCount} student action
                      {trace.actionCount === 1 ? "" : "s"};{" "}
                      {trace.evidenceEventIds.length} evidence item
                      {trace.evidenceEventIds.length === 1 ? "" : "s"}
                    </small>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className={styles.agentProposalActions}>
            {workflowCanBeUsed && evidenceState === "ready" && (
              <button
                className={styles.agentUseButton}
                type="button"
                onClick={onUseDraft}
              >
                Use this draft
              </button>
            )}
            {evidenceState === "loaded" && (
              <strong role="status">
                This proposal is loaded in the editor.
              </strong>
            )}
            <button type="button" onClick={onReject}>
              {evidenceState === "loaded" || evidenceState === "stale"
                ? "Dismiss AI notes"
                : "Reject proposal"}
            </button>
          </div>

          <details className={styles.agentGenerationDetails}>
            <summary>Generation details</summary>
            <dl>
              <div>
                <dt>Mode</dt>
                <dd>
                  {proposal.metadata.mode === "mock"
                    ? "Deterministic local fallback"
                    : "Live model"}
                </dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>{proposal.metadata.model}</dd>
              </div>
              <div>
                <dt>Prompt version</dt>
                <dd>{proposal.metadata.promptVersion}</dd>
              </div>
              <div>
                <dt>Tool contract</dt>
                <dd>{proposal.metadata.toolContractVersion}</dd>
              </div>
              <div>
                <dt>Usage</dt>
                <dd>
                  {proposal.metadata.usage.totalTokens.toLocaleString()} tokens
                  · {costLabel(proposal)}
                </dd>
              </div>
              <div>
                <dt>Bounded generation</dt>
                <dd>
                  {proposal.metadata.hashLineage.length} of{" "}
                  {proposal.metadata.limits.maxRevisionAttempts} revision
                  attempts · {proposal.metadata.usage.toolCalls} of{" "}
                  {proposal.metadata.limits.maxToolCalls} tool calls
                </dd>
              </div>
            </dl>
          </details>
        </article>
      )}
    </section>
  );
}
