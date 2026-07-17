import { describe, expect, it } from "vitest";

import { parseTranscriptEvent } from "../../src/lib/voice/realtimeTranscription";

describe("Realtime transcript events", () => {
  it("parses deltas and completed transcripts", () => {
    expect(
      parseTranscriptEvent({
        type: "conversation.item.input_audio_transcription.delta",
        delta: "endpoint"
      })
    ).toEqual({ kind: "delta", text: "endpoint" });
    expect(
      parseTranscriptEvent({
        type: "conversation.item.input_audio_transcription.completed",
        transcript: "Why endpoint?"
      })
    ).toEqual({ kind: "complete", text: "Why endpoint?" });
  });
});
