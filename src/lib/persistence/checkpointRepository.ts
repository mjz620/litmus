import type { SupabaseClient } from "@supabase/supabase-js";

import { hasServerSupabaseEnvironment } from "../env";
import { createServiceRoleSupabaseClient } from "../supabase/service";
import type { CheckpointRequest } from "./contracts";

export interface CheckpointWriteResult {
  acceptedEvents: number;
}

/**
 * The authenticated student a checkpoint is recorded for. Always resolved
 * server-side from the request session, never read from the request body.
 */
export interface CheckpointOwner {
  readonly userId: string;
}

/** Raised when a checkpoint targets a session owned by a different student. */
export class CheckpointOwnershipError extends Error {
  constructor(sessionId: string) {
    super(`Session ${sessionId} belongs to another user.`);
    this.name = "CheckpointOwnershipError";
  }
}

export interface CheckpointRepository {
  persist(
    checkpoint: CheckpointRequest,
    owner: CheckpointOwner
  ): Promise<CheckpointWriteResult>;
}

export class InMemoryCheckpointRepository implements CheckpointRepository {
  readonly sessions = new Map<
    string,
    CheckpointRequest & { readonly userId: string }
  >();
  readonly events = new Map<
    string,
    NonNullable<CheckpointRequest["events"]>[number]
  >();

  async persist(
    checkpoint: CheckpointRequest,
    owner: CheckpointOwner
  ): Promise<CheckpointWriteResult> {
    const previous = this.sessions.get(checkpoint.sessionId);
    if (previous && previous.userId !== owner.userId) {
      throw new CheckpointOwnershipError(checkpoint.sessionId);
    }
    this.sessions.set(checkpoint.sessionId, {
      ...previous,
      ...checkpoint,
      userId: owner.userId,
      events: undefined,
      skillEstimates: checkpoint.skillEstimates ?? previous?.skillEstimates
    });

    let acceptedEvents = 0;
    for (const event of checkpoint.events ?? []) {
      const key = `${checkpoint.sessionId}:${event.clientEventId}`;
      if (!this.events.has(key)) {
        this.events.set(key, event);
        acceptedEvents += 1;
      }
    }
    return { acceptedEvents };
  }
}

export class SupabaseCheckpointRepository implements CheckpointRepository {
  constructor(private readonly client: SupabaseClient) {}

  async persist(
    checkpoint: CheckpointRequest,
    owner: CheckpointOwner
  ): Promise<CheckpointWriteResult> {
    /*
     * This repository holds a service-role client, so RLS does not guard these
     * writes. Ownership is therefore checked here: without it, a caller who
     * knows any session UUID could overwrite another student's final state.
     */
    const { data: existing, error: existingError } = await this.client
      .from("sessions")
      .select("user_id")
      .eq("id", checkpoint.sessionId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing && existing.user_id && existing.user_id !== owner.userId) {
      throw new CheckpointOwnershipError(checkpoint.sessionId);
    }

    /*
     * Attribution. These were previously left unset, so every real session was
     * an orphan row: RLS reads keyed on user_id/class_id matched nothing, and
     * class analytics filtering on class_id always returned zero rows.
     */
    let classId: string | null = null;
    if (checkpoint.assignmentId) {
      const { data: assignment, error: assignmentError } = await this.client
        .from("assignments")
        .select("class_id")
        .eq("id", checkpoint.assignmentId)
        .maybeSingle();
      if (assignmentError) throw new Error(assignmentError.message);
      classId = assignment?.class_id ?? null;
    }

    // Omit LC2-801 pin columns unless set so checkpoints still work against
    // databases that have not applied the assignment-pin migration yet.
    const sessionRow: Record<string, unknown> = {
      id: checkpoint.sessionId,
      user_id: owner.userId,
      assignment_id: checkpoint.assignmentId ?? null,
      class_id: classId,
      experiment_id: checkpoint.experimentId,
      experiment_version: checkpoint.experimentVersion,
      workflow_version_id: checkpoint.workflowVersionId ?? null,
      mode: checkpoint.mode,
      session_seed: checkpoint.sessionSeed ?? null,
      parent_session_id: checkpoint.parentSessionId ?? null,
      is_demo: checkpoint.mode === "demo",
      final_state: checkpoint.finalState ?? null,
      completed_at: checkpoint.completedAt ?? null
    };
    if (checkpoint.labDefinitionVersionId) {
      sessionRow.lab_definition_version_id = checkpoint.labDefinitionVersionId;
    }
    if (checkpoint.labDefinitionCanonicalHash) {
      sessionRow.lab_definition_canonical_hash =
        checkpoint.labDefinitionCanonicalHash;
    }

    const { error: sessionError } = await this.client
      .from("sessions")
      .upsert(sessionRow);
    if (sessionError) throw new Error(sessionError.message);

    const events = (checkpoint.events ?? []).map((event) => ({
      session_id: checkpoint.sessionId,
      client_event_id: event.clientEventId,
      seq: event.seq,
      event_schema_version: checkpoint.schemaVersion,
      payload: event.payload
    }));
    if (events.length > 0) {
      const { error } = await this.client.from("events").upsert(events, {
        onConflict: "session_id,client_event_id",
        ignoreDuplicates: true
      });
      if (error) throw new Error(error.message);
    }

    const skills = (checkpoint.skillEstimates ?? []).map((skill) => ({
      session_id: checkpoint.sessionId,
      experiment_id: checkpoint.experimentId,
      skill_id: skill.skillId,
      mastery: skill.mastery,
      confidence: skill.confidence ?? null,
      latest_reason: skill.lastReason ?? null,
      evidence_count: skill.evidenceCount,
      updated_at: new Date().toISOString()
    }));
    if (skills.length > 0) {
      const { error } = await this.client
        .from("skill_estimates")
        .upsert(skills, { onConflict: "session_id,skill_id" });
      if (error) throw new Error(error.message);
    }

    return { acceptedEvents: events.length };
  }
}

const fallbackRepository = new InMemoryCheckpointRepository();

export function getCheckpointRepository(): CheckpointRepository {
  if (hasServerSupabaseEnvironment()) {
    return new SupabaseCheckpointRepository(createServiceRoleSupabaseClient());
  }
  /*
   * The in-memory repository is a development convenience. Falling back to it
   * in production would silently drop every student's work while the route
   * still answered { ok: true }, so a misconfigured deploy fails loudly here
   * instead of losing sessions quietly.
   */
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Checkpoint persistence is unconfigured: server Supabase environment is missing."
    );
  }
  return fallbackRepository;
}
