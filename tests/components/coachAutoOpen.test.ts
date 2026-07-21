import { describe, expect, it } from "vitest";

import { latestCoachMessageId } from "../../src/components/coach/useCoachAutoOpen";
import type { CoachMessage } from "../../src/stores/labStore";

const message = (
  id: string,
  role: CoachMessage["role"],
  text = "…"
): CoachMessage => ({ id, role, text });

describe("latestCoachMessageId", () => {
  it("reports nothing before the coach has spoken", () => {
    expect(latestCoachMessageId([])).toBeNull();
  });

  it("reports the newest coach message", () => {
    expect(
      latestCoachMessageId([
        message("a", "coach"),
        message("b", "student"),
        message("c", "coach")
      ])
    ).toBe("c");
  });

  /*
   * The student typing a question already has the dock open. Treating their
   * own message as a reason to open it would reopen the panel they had just
   * closed, so a trailing student message must not advance the marker.
   */
  it("ignores student messages", () => {
    expect(latestCoachMessageId([message("a", "student")])).toBeNull();
    expect(
      latestCoachMessageId([message("a", "coach"), message("b", "student")])
    ).toBe("a");
  });

  /*
   * The id is the identity the auto-open effect dedupes on. If it changed when
   * unrelated state did, the dock would reopen on every re-render; if it did
   * not change on a genuinely new message, the mistake would go unshown.
   */
  it("is stable across re-reads and advances only on a new coach message", () => {
    const messages = [message("a", "coach")];
    expect(latestCoachMessageId(messages)).toBe(
      latestCoachMessageId([...messages])
    );
    expect(latestCoachMessageId([...messages, message("b", "coach")])).toBe("b");
  });
});
