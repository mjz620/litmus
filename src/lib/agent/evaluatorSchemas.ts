import { z } from "zod";

import { labWorkflowConsumerContextSchema } from "../../lab-workflows/consumers";

import { semanticEventSchema, studentModelSchema } from "./schemas";

export const reportTextSchema = z.object({
  procedureSummary: z.string().trim().min(1).max(4000),
  dataAnalysis: z.string().trim().min(1).max(4000),
  conceptExplanation: z.string().trim().min(1).max(4000),
  sourcesOfError: z.string().trim().min(1).max(4000)
});

export const evaluateRequestSchema = z.object({
  sessionId: z.string().min(1).max(160),
  experimentId: z.string().min(1).max(128),
  finalState: z.unknown(),
  events: z.array(semanticEventSchema).max(1000),
  studentModel: studentModelSchema,
  labWorkflowContext: labWorkflowConsumerContextSchema.optional(),
  studentText: reportTextSchema
});

export const rubricCriterionSchema = z.object({
  score: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  feedback: z.string().min(1).max(1200),
  evidenceEventTypes: z.array(z.string().min(1).max(128)).max(64)
});

export const rubricResponseSchema = z.object({
  concept_understanding: rubricCriterionSchema,
  procedure: rubricCriterionSchema,
  data_analysis: rubricCriterionSchema,
  sig_figs: rubricCriterionSchema,
  overall_summary: z.string().min(1).max(1600),
  recommended_retry: z
    .object({
      skillId: z.enum(["endpoint_control", "burette_conditioning"]),
      reason: z.string().min(1).max(600)
    })
    .optional()
});

export type EvaluateRequest = z.infer<typeof evaluateRequestSchema>;
export type RubricResponse = z.infer<typeof rubricResponseSchema>;
export type ReportText = z.infer<typeof reportTextSchema>;
