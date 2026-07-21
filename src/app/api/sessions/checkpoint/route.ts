import { NextResponse } from "next/server";

import {
  CheckpointOwnershipError,
  getCheckpointRepository,
  type CheckpointOwner,
  type CheckpointRepository
} from "../../../../lib/persistence/checkpointRepository";
import { checkpointRequestSchema } from "../../../../lib/persistence/contracts";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

/**
 * Resolve the authenticated student for a checkpoint write.
 *
 * The repository behind this route holds a service-role client that bypasses
 * RLS, so this is the only place ownership is established. It comes from the
 * request's auth cookie and never from the request body.
 */
async function resolveOwner(): Promise<CheckpointOwner | null> {
  const client = await createServerSupabaseClient();
  const {
    data: { user }
  } = await client.auth.getUser();
  return user ? { userId: user.id } : null;
}

export function createCheckpointHandler(
  repository: CheckpointRepository,
  resolveCheckpointOwner: () => Promise<CheckpointOwner | null> = resolveOwner
) {
  return async function checkpointHandler(request: Request) {
    let owner: CheckpointOwner | null;
    try {
      owner = await resolveCheckpointOwner();
    } catch {
      return NextResponse.json(
        { error: "Checkpoint unavailable." },
        { status: 503 }
      );
    }
    if (!owner) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

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
      const result = await repository.persist(parsed.data, owner);
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      if (error instanceof CheckpointOwnershipError) {
        return NextResponse.json(
          { error: "Session belongs to another user." },
          { status: 403 }
        );
      }
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
