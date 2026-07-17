"use client";

import { type FormEvent, useState } from "react";

import { useLabStore } from "../../stores/labStore";
import { VoiceInput } from "./VoiceInput";

import styles from "./CoachPanel.module.css";

export function CoachPanel() {
  const messages = useLabStore((store) => store.coachMessages);
  const status = useLabStore((store) => store.coachStatus);
  const error = useLabStore((store) => store.coachError);
  const askCoach = useLabStore((store) => store.askCoach);
  const sessionId = useLabStore((store) => store.sessionId);
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
          {messages.map((message) => (
            <li
              className={`${styles.message} ${message.role === "student" ? styles.student : ""}`}
              key={message.id}
            >
              <strong>{message.role === "student" ? "You" : "Coach"}:</strong>{" "}
              {message.text}
            </li>
          ))}
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
