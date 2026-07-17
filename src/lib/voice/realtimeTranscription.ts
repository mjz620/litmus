import type { RealtimeTokenResponse } from "./token";

export type TranscriptEvent =
  | { kind: "delta"; text: string }
  | { kind: "complete"; text: string }
  | { kind: "ignore" };

export function parseTranscriptEvent(value: unknown): TranscriptEvent {
  if (typeof value !== "object" || value === null || !("type" in value))
    return { kind: "ignore" };
  const event = value as Record<string, unknown>;
  if (
    event.type === "conversation.item.input_audio_transcription.delta" &&
    typeof event.delta === "string"
  ) {
    return { kind: "delta", text: event.delta };
  }
  if (
    event.type === "conversation.item.input_audio_transcription.completed" &&
    typeof event.transcript === "string"
  ) {
    return { kind: "complete", text: event.transcript };
  }
  return { kind: "ignore" };
}

export class RealtimeTranscriptionSession {
  private connection: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private stream: MediaStream | null = null;

  async start(
    token: RealtimeTokenResponse,
    onTranscript: (event: TranscriptEvent) => void
  ): Promise<void> {
    if (token.mock) throw new Error("mock_token");
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const connection = new RTCPeerConnection();
    this.connection = connection;
    for (const track of this.stream.getTracks())
      connection.addTrack(track, this.stream);
    const channel = connection.createDataChannel("oai-events");
    this.channel = channel;
    channel.addEventListener("message", (message) => {
      try {
        onTranscript(parseTranscriptEvent(JSON.parse(String(message.data))));
      } catch {
        onTranscript({ kind: "ignore" });
      }
    });
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${token.value}`,
        "Content-Type": "application/sdp"
      }
    });
    if (!response.ok)
      throw new Error(`Realtime connection failed (${response.status}).`);
    await connection.setRemoteDescription({
      type: "answer",
      sdp: await response.text()
    });
  }

  stop(): void {
    if (this.channel?.readyState === "open") {
      this.channel.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    }
    for (const track of this.stream?.getTracks() ?? []) track.stop();
  }

  close(): void {
    this.stop();
    this.channel?.close();
    this.connection?.close();
    this.channel = null;
    this.connection = null;
    this.stream = null;
  }
}
