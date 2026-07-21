import { currentApiPath } from "../demo/demoEnvironment";
import type { CheckpointTransport } from "./checkpointQueue";
import type { CheckpointRequest } from "./contracts";

export class HttpCheckpointTransport implements CheckpointTransport {
  async send(checkpoint: CheckpointRequest): Promise<void> {
    const response = await fetch(currentApiPath("/api/sessions/checkpoint"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(checkpoint),
      // The route authenticates the student from the auth cookie.
      credentials: "same-origin",
      keepalive: true
    });

    if (
      response.status === 401 &&
      (checkpoint.mode === "practice" || checkpoint.mode === "demo")
    ) {
      // Practice and demo sessions are intentionally usable without an
      // account. Their in-memory session remains authoritative when the
      // authenticated checkpoint route reports that no student is signed in.
      return;
    }

    if (!response.ok) {
      throw new Error(`Checkpoint failed (${response.status}).`);
    }
  }
}
