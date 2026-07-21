import { describe, expect, it } from "vitest";

import { buildComposerAgentLoopEntries } from "../../src/components/teacher/lab-composer/ComposerAgentLoopTab";

describe("LC2-704 Composer Agent-loop tab", () => {
  it("shows a safe empty-state explanation without creating an agent action", () => {
    const entries = buildComposerAgentLoopEntries({
      proposal: null,
      evidenceState: null,
      authorBusy: false,
      authorProgress: [],
      authorError: null,
      validationState: "not-checked",
      judgeStatus: "idle",
      judgeHistory: []
    });

    expect(entries).toEqual([
      expect.objectContaining({
        actor: "Draft helper",
        title: "No draft suggestion yet",
        state: "waiting"
      }),
      expect.objectContaining({
        actor: "Litmus",
        title: "Lab checker has not run on this version",
        state: "waiting"
      }),
      expect.objectContaining({
        actor: "Teaching review",
        title: "No teaching review yet",
        state: "waiting"
      })
    ]);
  });

  it("keeps teacher decisions and stale teaching feedback separate from Litmus authority", () => {
    const entries = buildComposerAgentLoopEntries({
      proposal: null,
      evidenceState: "stale",
      authorBusy: false,
      authorProgress: [],
      authorError: null,
      validationState: "needs-attention",
      judgeStatus: "stale",
      judgeHistory: [
        {
          id: "review-1",
          title: "Teaching review 1",
          detail: "One teaching suggestion returned.",
          outcome: "review"
        },
        {
          id: "teacher-1",
          title: "Teacher skipped: Test suggestion",
          detail: "The draft was not changed.",
          outcome: "skipped"
        }
      ]
    });

    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actor: "Teacher",
          title: "Teacher edited the draft"
        }),
        expect.objectContaining({
          actor: "Litmus",
          title: "Lab checker found changes to make"
        }),
        expect.objectContaining({
          actor: "Teaching review",
          title: "Teaching review 1"
        }),
        expect.objectContaining({
          actor: "Teacher",
          title: "Teacher skipped: Test suggestion"
        }),
        expect.objectContaining({
          actor: "Teaching review",
          title: "Teaching feedback is out of date"
        })
      ])
    );
  });
});
