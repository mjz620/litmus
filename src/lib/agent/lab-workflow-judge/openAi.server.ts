import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import {
  WORKFLOW_JUDGE_DEFAULT_MODEL,
  WORKFLOW_JUDGE_PROMPT_VERSION,
  WORKFLOW_JUDGE_SYSTEM_PROMPT,
  workflowJudgePromptInput
} from "./prompt";
import type { WorkflowJudgeModel, WorkflowJudgeModelResult } from "./judge";
import {
  WORKFLOW_JUDGE_LIMITS,
  workflowJudgeModelOutputSchema,
  type WorkflowJudgeRequest
} from "./schemas";

export function createOpenAiWorkflowJudgeModel(): WorkflowJudgeModel {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new TypeError("OPENAI_API_KEY is not configured.");
  const model =
    process.env.OPENAI_LAB_WORKFLOW_JUDGE_MODEL ?? WORKFLOW_JUDGE_DEFAULT_MODEL;
  const client = new OpenAI({
    apiKey,
    maxRetries: 0,
    timeout: WORKFLOW_JUDGE_LIMITS.timeoutMs
  });
  return Object.freeze({
    model,
    async judge(
      request: Readonly<WorkflowJudgeRequest>
    ): Promise<WorkflowJudgeModelResult> {
      const response = await client.responses.parse(
        {
          model,
          store: false,
          max_output_tokens: WORKFLOW_JUDGE_LIMITS.maxOutputTokens,
          input: [
            { role: "system", content: WORKFLOW_JUDGE_SYSTEM_PROMPT },
            {
              role: "user",
              content: JSON.stringify({
                promptVersion: WORKFLOW_JUDGE_PROMPT_VERSION,
                reviewEvidence: workflowJudgePromptInput(request)
              })
            }
          ],
          text: {
            format: zodTextFormat(
              workflowJudgeModelOutputSchema,
              "lab_workflow_judge_critique"
            )
          }
        },
        { signal: AbortSignal.timeout(WORKFLOW_JUDGE_LIMITS.timeoutMs) }
      );
      if (!response.output_parsed)
        throw new TypeError("Workflow Judge returned no structured output.");
      return {
        output: response.output_parsed,
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0
      };
    }
  });
}
