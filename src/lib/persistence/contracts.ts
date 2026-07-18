import { z } from "zod";

import type { SemanticEvent, SkillEstimate } from "../../experiments/shared";
import {
  labWorkflowConsumerContextSchema,
  type LabWorkflowConsumerContext
} from "../../lab-workflows/consumers";
import {
  genericLabActionTraceSchema,
  type GenericLabActionTrace
} from "../../lab-workflows/replay";

export const CHECKPOINT_SCHEMA_VERSION = "1";
export type SaveStatus = "idle" | "pending" | "saved" | "error";
export type SessionMode = "practice" | "assignment" | "demo" | "preview";

export interface CheckpointEvent {
  clientEventId: string;
  seq: number;
  payload: SemanticEvent;
}

export interface CheckpointSkillEstimate extends SkillEstimate {
  skillId: string;
  confidence?: number;
}

/**
 * Versioned persistence envelope. Optional workflow provenance is reserved for
 * an immutable, validator-approved Lab Composer assignment; static labs omit it.
 */
export interface CheckpointRequest {
  schemaVersion: typeof CHECKPOINT_SCHEMA_VERSION;
  sessionId: string;
  experimentId: string;
  experimentVersion: string;
  mode: SessionMode;
  sessionSeed?: string;
  parentSessionId?: string;
  workflowVersionId?: string;
  events?: CheckpointEvent[];
  skillEstimates?: CheckpointSkillEstimate[];
  /** Local v2 provenance; immutable database version storage lands in Phase 8. */
  labWorkflowContext?: LabWorkflowConsumerContext;
  /** Complete normalized action prefix for deterministic local replay. */
  normalizedActionTrace?: GenericLabActionTrace;
  finalState?: unknown;
  completedAt?: string;
}

const scalarSchema = z.union([z.string(), z.number(), z.boolean()]);
const semanticEventSchema = z.object({
  type: z.string().min(1).max(128),
  tSim: z.number().finite().nonnegative(),
  observation: z.record(z.string(), scalarSchema),
  flags: z.array(z.string().min(1).max(128)).max(64),
  evidence: z.array(
    z.object({
      skillId: z.string().min(1).max(128),
      delta: z.number().finite().min(-1).max(1),
      reason: z.string().min(1).max(128),
      detail: z.record(z.string(), scalarSchema).optional()
    })
  )
});

export const checkpointRequestSchema = z.object({
  schemaVersion: z.literal(CHECKPOINT_SCHEMA_VERSION),
  sessionId: z.string().uuid(),
  experimentId: z.string().min(1).max(128),
  experimentVersion: z.string().min(1).max(64),
  mode: z.enum(["practice", "assignment", "demo", "preview"]),
  sessionSeed: z.string().max(256).optional(),
  parentSessionId: z.string().uuid().optional(),
  workflowVersionId: z.string().max(160).optional(),
  events: z
    .array(
      z.object({
        clientEventId: z.string().min(1).max(256),
        seq: z.number().int().nonnegative(),
        payload: semanticEventSchema
      })
    )
    .max(500)
    .optional(),
  skillEstimates: z
    .array(
      z.object({
        skillId: z.string().min(1).max(128),
        mastery: z.number().min(0).max(1),
        confidence: z.number().min(0).max(1).optional(),
        evidenceCount: z.number().int().nonnegative(),
        lastReason: z.string().max(128).optional()
      })
    )
    .max(200)
    .optional(),
  labWorkflowContext: labWorkflowConsumerContextSchema.optional(),
  normalizedActionTrace: genericLabActionTraceSchema.optional(),
  finalState: z.unknown().optional(),
  completedAt: z.string().datetime().optional()
});
