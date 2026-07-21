import { currentApiPath } from "../demo/demoEnvironment";
import type { CheckpointTransport } from "./checkpointQueue";
import type { CheckpointRequest } from "./contracts";

export class HttpCheckpointTransport implements CheckpointTransport {
  /*
   * A guest practice session has no owner to save to, and the route says so
   * with a 401 on every checkpoint — roughly one per lab action. The first
   * rejection is enough to stop asking: the in-memory session is already
   * authoritative for practice and demo. Signing in reloads the page and so
   * builds a fresh transport, which asks again.
   */
  #ownerlessSession = false;

  async send(checkpoint: CheckpointRequest): Promise<void> {
    const savesWithoutOwner =
      checkpoint.mode === "practice" || checkpoint.mode === "demo";
    if (this.#ownerlessSession && savesWithoutOwner) return;

    /*
     * Deliberately not a keepalive request. Chrome caps the total in-flight
     * keepalive body budget at 64 KiB; once checkpoints grow past a few
     * kilobytes the budget intermittently overflows and fetch itself rejects
     * with `TypeError: Failed to fetch`, which surfaced as a permanent
     * "Save failed" banner mid-lab. Nothing here needs keepalive: checkpoints
     * are queued during the session, and no unload-time flush exists.
     */
    const response = await fetch(currentApiPath("/api/sessions/checkpoint"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(checkpoint),
      // The route authenticates the student from the auth cookie.
      credentials: "same-origin"
    });

    if (response.status === 401 && savesWithoutOwner) {
      // Practice and demo sessions are intentionally usable without an
      // account. Their in-memory session remains authoritative when the
      // authenticated checkpoint route reports that no student is signed in.
      this.#ownerlessSession = true;
      return;
    }

    if (!response.ok) {
      throw new Error(`Checkpoint failed (${response.status}).`);
    }
  }
}
