"use client";

import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";

import {
  RealtimeTranscriptionSession,
  type TranscriptEvent
} from "../../lib/voice/realtimeTranscription";
import type { RealtimeTokenResponse } from "../../lib/voice/token";

interface VoiceInputProps {
  sessionId: string | null;
  onTranscript: (transcript: string) => void;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
      }) => void)
    | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

export function VoiceInput({ sessionId, onTranscript }: VoiceInputProps) {
  const [status, setStatus] = useState<
    "idle" | "connecting" | "recording" | "transcribing" | "error"
  >("idle");
  const [message, setMessage] = useState("Hold to ask by voice");
  const realtime = useRef<RealtimeTranscriptionSession | null>(null);
  const recognition = useRef<BrowserSpeechRecognition | null>(null);
  const transcript = useRef("");

  async function start() {
    if (!sessionId || status !== "idle") return;
    setStatus("connecting");
    setMessage("Requesting microphone access…");
    try {
      const response = await fetch("/api/realtime-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });
      if (!response.ok) throw new Error("Voice token unavailable.");
      const token = (await response.json()) as RealtimeTokenResponse;
      if (token.mock) {
        startBrowserFallback();
        return;
      }
      const session = new RealtimeTranscriptionSession();
      realtime.current = session;
      await session.start(token, handleTranscriptEvent);
      setStatus("recording");
      setMessage("Recording… release to transcribe");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error && error.name === "NotAllowedError"
          ? "Microphone denied. Type your question instead."
          : "Voice unavailable. Type your question instead."
      );
    }
  }

  function stop() {
    if (status !== "recording" && status !== "connecting") return;
    setStatus("transcribing");
    setMessage("Finishing transcript…");
    recognition.current?.stop();
    realtime.current?.stop();
  }

  function startBrowserFallback() {
    const constructor =
      (
        window as typeof window & {
          SpeechRecognition?: SpeechRecognitionConstructor;
          webkitSpeechRecognition?: SpeechRecognitionConstructor;
        }
      ).SpeechRecognition ??
      (
        window as typeof window & {
          webkitSpeechRecognition?: SpeechRecognitionConstructor;
        }
      ).webkitSpeechRecognition;
    if (!constructor) throw new Error("Speech transcription is unsupported.");
    const instance = new constructor();
    recognition.current = instance;
    instance.continuous = true;
    instance.interimResults = true;
    instance.onresult = (event) => {
      let value = "";
      for (let index = 0; index < event.results.length; index += 1)
        value += event.results[index]?.[0]?.transcript ?? "";
      transcript.current = value.trim();
      onTranscript(transcript.current);
    };
    instance.onerror = () => {
      setStatus("error");
      setMessage(
        "Microphone denied or unavailable. Type your question instead."
      );
    };
    instance.onend = () => {
      recognition.current = null;
      setStatus("idle");
      setMessage(
        transcript.current
          ? "Transcript ready — edit or send it below"
          : "No transcript captured. Type your question instead."
      );
    };
    instance.start();
    setStatus("recording");
    setMessage("Recording… release to finish");
  }

  function handleTranscriptEvent(event: TranscriptEvent) {
    if (event.kind === "delta") {
      transcript.current += event.text;
      onTranscript(transcript.current);
    } else if (event.kind === "complete") {
      transcript.current = event.text;
      onTranscript(event.text);
      realtime.current?.close();
      setStatus("idle");
      setMessage("Transcript ready — edit or send it below");
    }
  }

  function pointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    stop();
  }

  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === " " && !event.repeat) {
      event.preventDefault();
      void start();
    }
  }

  function keyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === " ") {
      event.preventDefault();
      stop();
    }
  }

  return (
    <div>
      <button
        type="button"
        aria-pressed={status === "recording"}
        disabled={!sessionId || status === "transcribing"}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          void start();
        }}
        onPointerUp={pointerUp}
        onPointerCancel={stop}
        onKeyDown={keyDown}
        onKeyUp={keyUp}
      >
        {status === "recording" ? "Release to finish" : "Hold to Ask"}
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {status === "error" && (
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setMessage("Hold to ask by voice");
          }}
        >
          Dismiss voice error
        </button>
      )}
    </div>
  );
}
