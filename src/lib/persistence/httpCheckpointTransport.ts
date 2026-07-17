import type { CheckpointTransport } from "./checkpointQueue";
import type { CheckpointRequest } from "./contracts";

export class HttpCheckpointTransport implements CheckpointTransport {
  async send(checkpoint: CheckpointRequest): Promise<void> {
    const response = await fetch("/api/sessions/checkpoint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(checkpoint),
      keepalive: true
    });

    if (!response.ok) {
      throw new Error(`Checkpoint failed (${response.status}).`);
    }
  }
}
