import type { SupabaseClient } from "@supabase/supabase-js";

import { hasServerSupabaseEnvironment } from "../env";
import { createServiceRoleSupabaseClient } from "../supabase/service";
import type { CheckpointRequest } from "./contracts";

export interface CheckpointWriteResult {
  acceptedEvents: number;
}

export interface CheckpointRepository {
  persist(checkpoint: CheckpointRequest): Promise<CheckpointWriteResult>;
}

export class InMemoryCheckpointRepository implements CheckpointRepository {
  readonly sessions = new Map<string, CheckpointRequest>();
  readonly events = new Map<
    string,
    NonNullable<CheckpointRequest["events"]>[number]
  >();

  async persist(checkpoint: CheckpointRequest): Promise<CheckpointWriteResult> {
    const previous = this.sessions.get(checkpoint.sessionId);
    this.sessions.set(checkpoint.sessionId, {
      ...previous,
      ...checkpoint,
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

  async persist(checkpoint: CheckpointRequest): Promise<CheckpointWriteResult> {
    const { error: sessionError } = await this.client.from("sessions").upsert({
      id: checkpoint.sessionId,
      experiment_id: checkpoint.experimentId,
      experiment_version: checkpoint.experimentVersion,
      workflow_version_id: checkpoint.workflowVersionId ?? null,
      mode: checkpoint.mode,
      session_seed: checkpoint.sessionSeed ?? null,
      parent_session_id: checkpoint.parentSessionId ?? null,
      is_demo: checkpoint.mode === "demo",
      final_state: checkpoint.finalState ?? null,
      completed_at: checkpoint.completedAt ?? null
    });
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
  return hasServerSupabaseEnvironment()
    ? new SupabaseCheckpointRepository(createServiceRoleSupabaseClient())
    : fallbackRepository;
}
