import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import type { AuthoredEvaluatorModel } from "./authoredEvaluator";
import {
  AUTHORED_EVALUATOR_PROMPT_VERSION,
  AUTHORED_EVALUATOR_SYSTEM_PROMPT,
  authoredEvaluatorPromptInput
} from "./authoredEvaluatorPrompt";
import { authoredEvaluatorModelOutputSchema } from "./evaluatorSchemas";
import type { AuthoredEvaluateRequest } from "./evaluatorSchemas";

export const AUTHORED_EVALUATOR_MODEL_TIMEOUT_MS = 15_000;
export const AUTHORED_EVALUATOR_MAX_OUTPUT_TOKENS = 4_000;

export function createOpenAiAuthoredEvaluatorModel(): AuthoredEvaluatorModel {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new TypeError("OPENAI_API_KEY is not configured.");
  const model = process.env.OPENAI_EVALUATOR_V2_MODEL ?? "gpt-5.4-mini";
  const client = new OpenAI({ apiKey });
  return Object.freeze({
    model,
    async evaluate(request: Readonly<AuthoredEvaluateRequest>) {
      const response = await client.responses.parse(
        {
          model,
          max_output_tokens: AUTHORED_EVALUATOR_MAX_OUTPUT_TOKENS,
          input: [
            { role: "system", content: AUTHORED_EVALUATOR_SYSTEM_PROMPT },
            {
              role: "user",
              content: JSON.stringify({
                promptVersion: AUTHORED_EVALUATOR_PROMPT_VERSION,
                evidence: authoredEvaluatorPromptInput(request)
              })
            }
          ],
          text: {
            format: zodTextFormat(
              authoredEvaluatorModelOutputSchema,
              "authored_performance_evaluation"
            )
          }
        },
        { signal: AbortSignal.timeout(AUTHORED_EVALUATOR_MODEL_TIMEOUT_MS) }
      );
      if (!response.output_parsed)
        throw new TypeError("Evaluator returned no structured output.");
      return response.output_parsed;
    }
  });
}
