import { NextResponse } from "next/server";

import {
  getCheckpointRepository,
  type CheckpointRepository
} from "../../../../lib/persistence/checkpointRepository";
import { checkpointRequestSchema } from "../../../../lib/persistence/contracts";

export function createCheckpointHandler(repository: CheckpointRepository) {
  return async function checkpointHandler(request: Request) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const parsed = checkpointRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid checkpoint request.", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    try {
      const result = await repository.persist(parsed.data);
      return NextResponse.json({ ok: true, ...result });
    } catch {
      return NextResponse.json(
        { error: "Checkpoint unavailable." },
        { status: 503 }
      );
    }
  };
}

export async function POST(request: Request) {
  return createCheckpointHandler(getCheckpointRepository())(request);
}
