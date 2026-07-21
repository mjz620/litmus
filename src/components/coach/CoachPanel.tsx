"use client";

import { type FormEvent, useState } from "react";

import type { AnyCoachResponse } from "../../lib/agent/schemas";
import type { CoachMessage, CoachStatus } from "../../stores/labStore";
import { useLabStore } from "../../stores/labStore";
import { VoiceInput } from "./VoiceInput";

import styles from "./CoachPanel.module.css";

export function coachGuidanceLabel(
  response: AnyCoachResponse | undefined
): string | null {
  if (!response || !("contractVersion" in response) || !response.guidance)
    return null;
  /*
   * Never call authored lab guidance "AI guidance".
   *
   * The coach falls back to the workflow's own authored instruction whenever
   * the model is unavailable or its output fails the grounding guards — which
   * happens routinely, because the model is deliberately never given the
   * numbers a question like "what is the molarity?" would need. Labelling that
   * fallback as AI output told the student a model had answered them when none
   * had, which is exactly the assertion-over-evidence this product refuses
   * everywhere else. The response already reports its own provenance.
   */
  if (response.metadata?.mode === "deterministic_fallback") {
    return "From the lab steps";
  }
  switch (response.guidance.kind) {
    case "mandatory_procedure":
      return "Required procedure";
    case "safety":
      return "Safety";
    case "optional_context":
      return "Optional context";
    case "ai_guidance":
      return "AI guidance";
  }
}

export interface CoachPanelViewProps {
  readonly messages: readonly CoachMessage[];
  readonly status: CoachStatus;
  readonly error: string | null;
  readonly sessionId: string | null;
  readonly askCoach: (question: string) => Promise<void>;
}

/** Presentation-only Lab coach surface, shared by the legacy store-backed
 * experiment shell and any workspace that keeps its own coach state. */
export function CoachPanelView({
  messages,
  status,
  error,
  sessionId,
  askCoach
}: CoachPanelViewProps) {
  const [question, setQuestion] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitted = question.trim();
    if (!submitted) return;
    setQuestion("");
    await askCoach(submitted);
  }

  return (
    <section className={styles.panel} aria-labelledby="coach-heading">
      <header className={styles.header}>
        <p>Your bench buddy</p>
        <h2 id="coach-heading">Lab coach</h2>
      </header>

      {messages.length === 0 ? (
        <p className={styles.empty}>
          I’ll stay quiet while things are going smoothly. Ask me a lab question
          anytime.
        </p>
      ) : (
        <ol className={styles.messages} aria-live="polite">
          {messages.map((message) => {
            const label = coachGuidanceLabel(message.response);
            return (
              <li
                className={`${styles.message} ${message.role === "student" ? styles.student : ""}`}
                key={message.id}
              >
                {label && <span className={styles.guidanceKind}>{label}</span>}
                <span>
                  <strong>
                    {message.role === "student" ? "You" : "Coach"}:
                  </strong>{" "}
                  {message.text}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <VoiceInput sessionId={sessionId} onTranscript={setQuestion} />
        <label htmlFor="coach-question">Ask about this lab</label>
        <textarea
          id="coach-question"
          value={question}
          maxLength={600}
          onChange={(event) => setQuestion(event.currentTarget.value)}
          placeholder="Why should I slow down near the endpoint?"
        />
        <button
          type="submit"
          disabled={!question.trim() || status === "loading"}
        >
          {status === "loading" ? "Thinking…" : "Ask coach"}
        </button>
      </form>

      {error && (
        <p className={styles.error} role="alert">
          {error} Your lab remains fully interactive.
        </p>
      )}
    </section>
  );
}

export function CoachPanel() {
  const messages = useLabStore((store) => store.coachMessages);
  const status = useLabStore((store) => store.coachStatus);
  const error = useLabStore((store) => store.coachError);
  const askCoach = useLabStore((store) => store.askCoach);
  const sessionId = useLabStore((store) => store.sessionId);

  return (
    <CoachPanelView
      messages={messages}
      status={status}
      error={error}
      sessionId={sessionId}
      askCoach={askCoach}
    />
  );
}
