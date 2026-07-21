import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import {
  type EvaluateRequest,
  type RubricResponse,
  rubricResponseSchema
} from "./evaluatorSchemas";

export const EVALUATOR_PROMPT_VERSION = "evaluator-v1";
export const RUBRIC_VERSION = "rubric-v1";
export const EVALUATOR_SYSTEM_PROMPT = `You are Litmus's formative report evaluator. Score only against the supplied rubric dimensions and cite supplied semantic event types. Deterministic engine state is ground truth: never invent measurements, calculate hidden chemistry, or fabricate event counts. Do not expose hidden reasoning. Recommend only endpoint_control or burette_conditioning retries when the evidence supports one.`;

export function createMockRubric(request: EvaluateRequest): RubricResponse {
  const eventTypes = Array.from(
    new Set(request.events.map(({ type }) => type))
  );
  const flags = new Set(request.events.flatMap(({ flags }) => flags));
  const procedureScore =
    flags.has("burette_not_conditioned") || flags.has("endpoint_overshoot")
      ? 1
      : 3;
  const conceptScore =
    request.studentText.conceptExplanation.length >= 40 ? 3 : 2;
  const analysisScore = request.studentText.dataAnalysis.length >= 30 ? 3 : 2;
  const sigFigsScore = flags.has("result_out_of_tolerance") ? 1 : 2;
  const retry =
    flags.has("endpoint_overshoot") || flags.has("flow_rate_high_near_endpoint")
      ? {
          skillId: "endpoint_control" as const,
          reason:
            "Event evidence shows that a short near-endpoint control retry would be useful."
        }
      : flags.has("burette_not_conditioned")
        ? {
            skillId: "burette_conditioning" as const,
            reason:
              "Conditioning evidence shows that a focused preparation retry would be useful."
          }
        : undefined;

  return {
    concept_understanding: criterion(
      conceptScore,
      "Connect the endpoint observation to the underlying concept more explicitly.",
      eventTypes
    ),
    procedure: criterion(
      procedureScore,
      procedureScore === 3
        ? "The event record supports a controlled procedure."
        : "Use the flagged procedure evidence to explain the correction.",
      eventTypes
    ),
    data_analysis: criterion(
      analysisScore,
      "Tie each conclusion to an observed or recorded value from the lab.",
      eventTypes
    ),
    sig_figs: criterion(
      sigFigsScore,
      "State how burette precision limits the reported result.",
      eventTypes
    ),
    overall_summary:
      "This feedback is grounded in the submitted explanation and deterministic semantic-event record.",
    recommended_retry: retry
  };
}

export async function evaluateReport(
  request: EvaluateRequest
): Promise<RubricResponse> {
  if (
    process.env.OPENAI_MOCK_MODE === "1" ||
    process.env.NODE_ENV === "test" ||
    !process.env.OPENAI_API_KEY
  ) {
    return createMockRubric(request);
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: process.env.OPENAI_EVALUATOR_MODEL ?? "gpt-5.6-luna",
    input: [
      { role: "system", content: EVALUATOR_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          promptVersion: EVALUATOR_PROMPT_VERSION,
          rubricVersion: RUBRIC_VERSION,
          ...request
        })
      }
    ],
    text: { format: zodTextFormat(rubricResponseSchema, "report_rubric") }
  });
  if (!response.output_parsed)
    throw new Error("Evaluator did not return a structured rubric.");
  return rubricResponseSchema.parse(response.output_parsed);
}

function criterion(
  score: 0 | 1 | 2 | 3,
  feedback: string,
  evidenceEventTypes: string[]
) {
  return { score, feedback, evidenceEventTypes };
}
