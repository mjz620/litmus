import { describe, expect, it, vi } from "vitest";

import {
  CHECKPOINT_SCHEMA_VERSION,
  CheckpointQueue,
  type CheckpointRequest,
  type CheckpointTransport
} from "../../src/lib/persistence";

const request: CheckpointRequest = {
  schemaVersion: CHECKPOINT_SCHEMA_VERSION,
  sessionId: "session-1",
  experimentId: "acid_base_titration",
  experimentVersion: "1.0.0",
  mode: "practice"
};

describe("CheckpointQueue", () => {
  it("saves queued checkpoints asynchronously", async () => {
    const transport: CheckpointTransport = { send: vi.fn(async () => {}) };
    const queue = new CheckpointQueue(transport);

    queue.enqueue(request);
    expect(queue.getSnapshot().status).toBe("pending");
    await queue.whenIdle();

    expect(transport.send).toHaveBeenCalledWith(request);
    expect(queue.getSnapshot()).toMatchObject({
      status: "saved",
      pendingCount: 0
    });
  });

  it("keeps a failed checkpoint and retries it without blocking callers", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    const queue = new CheckpointQueue({ send });

    queue.enqueue(request);
    await queue.whenIdle();
    expect(queue.getSnapshot()).toMatchObject({
      status: "error",
      pendingCount: 1
    });

    queue.retry();
    await queue.whenIdle();
    expect(send).toHaveBeenCalledTimes(2);
    expect(queue.getSnapshot().status).toBe("saved");
  });
});
