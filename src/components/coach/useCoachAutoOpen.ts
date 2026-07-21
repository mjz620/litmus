"use client";

import { useEffect, useRef } from "react";

import type { CoachMessage } from "../../stores/labStore";

/**
 * The newest coach-authored message id, or null when the coach has not spoken.
 *
 * Student messages are skipped: the student typing into the panel already has
 * it open, and treating their own question as a reason to open it would make
 * the panel reopen itself after they closed it.
 */
export function latestCoachMessageId(
  messages: readonly CoachMessage[]
): string | null {
  return messages.findLast((message) => message.role === "coach")?.id ?? null;
}

/**
 * Opens the coach dock whenever the coach says something the student has not
 * seen — which, given the deterministic trigger policy, means whenever they
 * made a mistake the engine flagged.
 *
 * Both lab surfaces keep `coachOpen` in their own local state. The legacy
 * titration scene grew this behaviour inline and the native bench never did, so
 * on the current surface a mistake produced a coach message that sat behind a
 * closed dock with only a small count badge changing. Sharing the rule keeps
 * the two from drifting apart again.
 *
 * Deliberately does not move focus. The dock is non-modal and its message list
 * is already `aria-live="polite"`, so assistive tech announces the guidance
 * without it; pulling focus out of the bench mid-action would break the
 * keyboard path that every lab action is required to have.
 *
 * `setOpen` must be stable — pass the `useState` setter directly.
 */
export function useCoachAutoOpen(
  messages: readonly CoachMessage[],
  setOpen: (open: true) => void
): void {
  const seenMessageId = useRef<string | null>(null);

  useEffect(() => {
    const latest = latestCoachMessageId(messages);
    if (latest === null || seenMessageId.current === latest) return;

    seenMessageId.current = latest;
    setOpen(true);
  }, [messages, setOpen]);
}
