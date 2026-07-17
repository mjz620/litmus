import type { CheckpointRequest, SaveStatus } from "./contracts";

export interface CheckpointTransport {
  send(checkpoint: CheckpointRequest): Promise<void>;
}

export interface CheckpointQueueSnapshot {
  status: SaveStatus;
  pendingCount: number;
  lastError: string | null;
}

export type CheckpointQueueListener = (
  snapshot: CheckpointQueueSnapshot
) => void;

export class NoopCheckpointTransport implements CheckpointTransport {
  async send(): Promise<void> {
    await Promise.resolve();
  }
}

/** Serial async queue: enqueuing never awaits network or blocks engine steps. */
export class CheckpointQueue {
  private pending: CheckpointRequest[] = [];
  private failed: CheckpointRequest | null = null;
  private draining: Promise<void> | null = null;
  private listeners = new Set<CheckpointQueueListener>();
  private snapshot: CheckpointQueueSnapshot = {
    status: "idle",
    pendingCount: 0,
    lastError: null
  };

  constructor(private readonly transport: CheckpointTransport) {}

  getSnapshot(): CheckpointQueueSnapshot {
    return this.snapshot;
  }

  subscribe(listener: CheckpointQueueListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  enqueue(checkpoint: CheckpointRequest): void {
    this.pending.push(checkpoint);
    this.publish(
      this.failed ? "error" : "pending",
      this.failed ? this.snapshot.lastError : null
    );
    void this.drain();
  }

  retry(): void {
    if (this.failed) {
      this.pending.unshift(this.failed);
      this.failed = null;
    }
    if (this.pending.length > 0) {
      this.publish("pending", null);
      void this.drain();
    }
  }

  async whenIdle(): Promise<void> {
    while (this.draining) await this.draining;
  }

  private async drain(): Promise<void> {
    if (this.draining || this.failed) return;

    this.draining = (async () => {
      while (this.pending.length > 0) {
        const checkpoint = this.pending.shift()!;
        this.publish("pending", null);

        try {
          await this.transport.send(checkpoint);
        } catch (error) {
          this.failed = checkpoint;
          this.publish("error", getErrorMessage(error));
          return;
        }
      }

      this.publish("saved", null);
    })().finally(() => {
      this.draining = null;
      if (this.pending.length > 0 && !this.failed) void this.drain();
    });

    await this.draining;
  }

  private publish(status: SaveStatus, lastError: string | null): void {
    this.snapshot = {
      status,
      pendingCount: this.pending.length + (this.failed ? 1 : 0),
      lastError
    };
    for (const listener of this.listeners) listener(this.snapshot);
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Checkpoint failed.";
}
