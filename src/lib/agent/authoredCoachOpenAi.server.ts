import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import type { AuthoredCoachModel } from "./authoredCoach";
import {
  AUTHORED_COACH_PROMPT_VERSION,
  AUTHORED_COACH_SYSTEM_PROMPT,
  authoredCoachPromptInput
} from "./authoredCoachPrompt";
import {
  authoredCoachModelOutputSchema,
  type AuthoredCoachRequest
} from "./authoredCoachSchemas";

export const AUTHORED_COACH_OPENAI_TIMEOUT_MS = 9_000;
export const AUTHORED_COACH_MAX_OUTPUT_TOKENS = 1_200;

export function createOpenAiAuthoredCoachModel(): AuthoredCoachModel {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new TypeError("OPENAI_API_KEY is not configured.");
  const model = process.env.OPENAI_COACH_V2_MODEL ?? "gpt-5.6-luna";
  const client = new OpenAI({ apiKey });
  return Object.freeze({
    model,
    async respond(request: Readonly<AuthoredCoachRequest>) {
      const response = await client.responses.parse(
        {
          model,
          max_output_tokens: AUTHORED_COACH_MAX_OUTPUT_TOKENS,
          input: [
            { role: "system", content: AUTHORED_COACH_SYSTEM_PROMPT },
            {
              role: "user",
              content: JSON.stringify({
                promptVersion: AUTHORED_COACH_PROMPT_VERSION,
                context: authoredCoachPromptInput(request)
              })
            }
          ],
          text: {
            format: zodTextFormat(
              authoredCoachModelOutputSchema,
              "diagnosis_aware_coach_response"
            )
          }
        },
        { signal: AbortSignal.timeout(AUTHORED_COACH_OPENAI_TIMEOUT_MS) }
      );
      if (!response.output_parsed)
        throw new TypeError("Coach returned no structured output.");
      return response.output_parsed;
    }
  });
}
