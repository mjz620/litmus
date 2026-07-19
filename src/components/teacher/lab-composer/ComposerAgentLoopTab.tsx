import type {
  CapabilityAuthorProgress,
  CapabilityAuthorSuccessResponse
} from "../../../lib/agent/lab-authoring/capabilityAuthorSchemas";
import type { ComposerAgentEvidenceState } from "./ComposerAgentWorkspace";
import type {
  ComposerJudgeHistoryEntry,
  ComposerJudgeStatus
} from "./ComposerJudgePanel";

import styles from "./LabComposer.module.css";

type LoopEntryState = "waiting" | "working" | "passed" | "needs-attention";

interface LoopEntry {
  readonly id: string;
  readonly actor: "Draft helper" | "LabBench" | "Teaching review" | "Teacher";
  readonly title: string;
  readonly detail: string;
  readonly state: LoopEntryState;
}

interface ComposerAgentLoopTabProps {
  readonly proposal: CapabilityAuthorSuccessResponse | null;
  readonly evidenceState: ComposerAgentEvidenceState | null;
  readonly authorBusy: boolean;
  readonly authorProgress: readonly CapabilityAuthorProgress[];
  readonly authorError: string | null;
  readonly validationState: "not-checked" | "passed" | "needs-attention";
  readonly judgeStatus: ComposerJudgeStatus;
  readonly judgeHistory: readonly ComposerJudgeHistoryEntry[];
  readonly callsRemaining: number;
  readonly revisionsRemaining: number;
  readonly onOpenDefine: () => void;
  readonly onOpenValidation: () => void;
}

function authorOutcomeCopy(
  proposal: CapabilityAuthorSuccessResponse
): Pick<LoopEntry, "title" | "detail" | "state"> {
  const result = proposal.result;
  if (result.outcome === "runnable") {
    return {
      title: "Draft suggestion is ready",
      detail:
        "The helper suggested a supported lab. You can review it before loading it into the editor.",
      state: "passed"
    };
  }
  if (result.outcome === "rejected_for_safety") {
    return {
      title: "Draft suggestion stopped for safety",
      detail: "The current request was not turned into a student simulation.",
      state: "needs-attention"
    };
  }
  if (result.outcome === "unsupported") {
    return {
      title: "Draft suggestion is not supported yet",
      detail: "The available verified lab parts cannot support this request.",
      state: "needs-attention"
    };
  }
  if (result.outcome === "limited") {
    return {
      title: "Draft suggestion stopped within its safe limit",
      detail: "No unverified lab was loaded into the editor.",
      state: "needs-attention"
    };
  }
  return {
    title: "Draft suggestion needs more detail",
    detail:
      "Add the missing teaching details before asking for another suggestion.",
    state: "needs-attention"
  };
}

function judgeHistoryState(
  outcome: ComposerJudgeHistoryEntry["outcome"]
): LoopEntryState {
  return outcome === "review" || outcome === "accepted"
    ? "passed"
    : "needs-attention";
}

function judgeHistoryActor(
  outcome: ComposerJudgeHistoryEntry["outcome"]
): LoopEntry["actor"] {
  return outcome === "accepted" || outcome === "skipped"
    ? "Teacher"
    : "Teaching review";
}

export function buildComposerAgentLoopEntries(
  input: Omit<
    ComposerAgentLoopTabProps,
    | "onOpenDefine"
    | "onOpenValidation"
    | "callsRemaining"
    | "revisionsRemaining"
  >
): readonly LoopEntry[] {
  const entries: LoopEntry[] = [];
  const latestProgress = input.authorProgress.at(-1);

  if (input.authorBusy) {
    entries.push({
      id: "author-working",
      actor: "Draft helper",
      title: "Preparing a draft suggestion",
      detail:
        latestProgress?.message ?? "Starting with the requested learning goal.",
      state: "working"
    });
  } else if (input.authorError) {
    entries.push({
      id: "author-stopped",
      actor: "Draft helper",
      title: "Draft suggestion could not finish",
      detail: input.authorError,
      state: "needs-attention"
    });
  } else if (input.proposal) {
    entries.push({
      id: "author-result",
      actor: "Draft helper",
      ...authorOutcomeCopy(input.proposal)
    });
  } else {
    entries.push({
      id: "author-waiting",
      actor: "Draft helper",
      title: "No draft suggestion yet",
      detail:
        "Describe the lab in Define when you want a suggested starting point.",
      state: "waiting"
    });
  }

  if (input.evidenceState === "loaded") {
    entries.push({
      id: "teacher-loaded",
      actor: "Teacher",
      title: "Teacher loaded the suggestion",
      detail:
        "The editable draft is now in the Composer. You remain in control of every later change.",
      state: "passed"
    });
  } else if (input.evidenceState === "stale") {
    entries.push({
      id: "teacher-edited",
      actor: "Teacher",
      title: "Teacher edited the draft",
      detail: "Earlier automated checks no longer describe the current lab.",
      state: "needs-attention"
    });
  }

  if (input.validationState === "passed") {
    entries.push({
      id: "labbench-passed",
      actor: "LabBench",
      title: "Lab checker passed",
      detail:
        "The current lab is supported for Preview. This deterministic check, not AI advice, decides that.",
      state: "passed"
    });
  } else if (input.validationState === "needs-attention") {
    entries.push({
      id: "labbench-needs-attention",
      actor: "LabBench",
      title: "Lab checker found changes to make",
      detail:
        "Preview stays unavailable until the current lab passes the deterministic check.",
      state: "needs-attention"
    });
  } else {
    entries.push({
      id: "labbench-waiting",
      actor: "LabBench",
      title: "Lab checker has not run on this version",
      detail:
        "Check the lab before requesting teaching feedback or opening Preview.",
      state: "waiting"
    });
  }

  if (input.proposal?.result.traces.length === 5) {
    const passed = input.proposal.result.traces.filter(
      ({ passed }) => passed
    ).length;
    entries.push({
      id: "author-scenarios",
      actor: "LabBench",
      title: `${passed} of 5 student scenarios passed`,
      detail:
        passed === 5
          ? "The proposed lab was exercised through the real student simulation before it was offered for review."
          : "The proposal was not treated as ready because one or more required student scenarios did not pass.",
      state: passed === 5 ? "passed" : "needs-attention"
    });
  }

  if (input.judgeStatus === "running") {
    entries.push({
      id: "judge-working",
      actor: "Teaching review",
      title: "Reviewing the learning experience",
      detail:
        "LabBench is repeating the required student scenarios before returning optional teaching feedback.",
      state: "working"
    });
  }

  entries.push(
    ...input.judgeHistory.map((entry) => ({
      id: `judge-${entry.id}`,
      actor: judgeHistoryActor(entry.outcome),
      title: entry.title,
      detail: entry.detail,
      state: judgeHistoryState(entry.outcome)
    }))
  );

  if (input.judgeHistory.length === 0 && input.judgeStatus !== "running") {
    entries.push({
      id: "judge-waiting",
      actor: "Teaching review",
      title: "No teaching review yet",
      detail:
        "After the LabBench checker passes, you can request optional teaching feedback in Check & preview.",
      state: "waiting"
    });
  } else if (input.judgeStatus === "stale") {
    entries.push({
      id: "judge-stale",
      actor: "Teaching review",
      title: "Teaching feedback is out of date",
      detail:
        "The draft changed after the review. Check the lab and request a fresh review before using its advice.",
      state: "needs-attention"
    });
  } else if (input.judgeStatus === "stopped") {
    entries.push({
      id: "judge-stopped",
      actor: "Teaching review",
      title: "Teaching review stopped",
      detail: "The draft was not changed by the review.",
      state: "needs-attention"
    });
  }

  return entries;
}

export function ComposerAgentLoopTab({
  proposal,
  evidenceState,
  authorBusy,
  authorProgress,
  authorError,
  validationState,
  judgeStatus,
  judgeHistory,
  callsRemaining,
  revisionsRemaining,
  onOpenDefine,
  onOpenValidation
}: ComposerAgentLoopTabProps) {
  const entries = buildComposerAgentLoopEntries({
    proposal,
    evidenceState,
    authorBusy,
    authorProgress,
    authorError,
    validationState,
    judgeStatus,
    judgeHistory
  });

  return (
    <section
      className={styles.agentLoopTab}
      aria-labelledby="agent-loop-heading"
      data-testid="composer-agent-loop-tab"
    >
      <header>
        <p>Teacher view</p>
        <h2 id="agent-loop-heading">See the AI review loop</h2>
        <span>
          Follow the suggested draft, the checks that decide whether it can run,
          and any optional teaching feedback in one place.
        </span>
      </header>

      <section
        className={styles.agentLoopAuthority}
        aria-label="Who decides what"
      >
        <h3>Who decides what</h3>
        <ol>
          <li>
            <strong>Draft helper</strong>
            <span>Suggests a starting structure.</span>
          </li>
          <li>
            <strong>LabBench</strong>
            <span>Checks support and student scenarios before Preview.</span>
          </li>
          <li>
            <strong>Teaching review</strong>
            <span>Offers optional learning-design feedback.</span>
          </li>
          <li>
            <strong>You</strong>
            <span>
              Choose whether to use a suggestion or make your own edits.
            </span>
          </li>
        </ol>
      </section>

      <section aria-labelledby="agent-loop-timeline-heading">
        <div className={styles.agentLoopTimelineHeader}>
          <div>
            <h3 id="agent-loop-timeline-heading">What happened</h3>
            <p>
              The loop is shown in the order the roles act; teaching-review
              decisions remain in page-session order.
            </p>
          </div>
          <span>
            {callsRemaining} review call{callsRemaining === 1 ? "" : "s"} ·{" "}
            {revisionsRemaining} suggested change
            {revisionsRemaining === 1 ? "" : "s"} left
          </span>
        </div>
        <ol className={styles.agentLoopTimeline} aria-live="polite">
          {entries.map((entry) => (
            <li key={entry.id} data-state={entry.state}>
              <span aria-hidden="true">
                {entry.state === "passed"
                  ? "✓"
                  : entry.state === "working"
                    ? "●"
                    : entry.state === "needs-attention"
                      ? "!"
                      : "○"}
              </span>
              <div>
                <small>{entry.actor}</small>
                <strong>{entry.title}</strong>
                <p>{entry.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <footer className={styles.agentLoopActions}>
        <button type="button" onClick={onOpenDefine}>
          Open draft helper
        </button>
        <button type="button" onClick={onOpenValidation}>
          Open checks and teaching review
        </button>
      </footer>
    </section>
  );
}
