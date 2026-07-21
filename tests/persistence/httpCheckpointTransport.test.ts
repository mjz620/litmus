import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CHECKPOINT_SCHEMA_VERSION,
  HttpCheckpointTransport,
  type CheckpointRequest
} from "../../src/lib/persistence";

function checkpoint(mode: CheckpointRequest["mode"]): CheckpointRequest {
  return {
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    sessionId: "00000000-0000-4000-8000-000000000001",
    experimentId: "acid_base_titration",
    experimentVersion: "1.0.0",
    mode
  };
}

describe("HttpCheckpointTransport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(["practice", "demo"] as const)(
    "keeps anonymous %s sessions local when the authenticated route returns 401",
    async (mode) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: false, status: 401 }))
      );

      await expect(
        new HttpCheckpointTransport().send(checkpoint(mode))
      ).resolves.toBeUndefined();
    }
  );

  it("does not hide an assignment authentication failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401 }))
    );

    await expect(
      new HttpCheckpointTransport().send(checkpoint("assignment"))
    ).rejects.toThrow("Checkpoint failed (401).");
  });

  it("still surfaces non-authentication failures for practice sessions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503 }))
    );

    await expect(
      new HttpCheckpointTransport().send(checkpoint("practice"))
    ).rejects.toThrow("Checkpoint failed (503).");
  });
});
