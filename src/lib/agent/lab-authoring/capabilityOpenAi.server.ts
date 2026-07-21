import "server-only";

import OpenAI from "openai";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import { z } from "zod";

import {
  CAPABILITY_AUTHOR_DEFAULT_MODEL,
  CAPABILITY_AUTHOR_PROMPT_VERSION,
  CAPABILITY_AUTHOR_SYSTEM_PROMPT,
  CAPABILITY_AUTHOR_TOOL_CONTRACT_VERSION
} from "./capabilityPrompt";
import {
  CapabilityAuthoringError,
  type CapabilityAuthorPlanner,
  type CapabilityAuthorPlannerContext,
  type CapabilityAuthorPlannerRoundResult
} from "./capabilityAuthor";
import {
  CAPABILITY_AUTHOR_LIMITS,
  capabilityAuthorPlanSchema,
  capabilityAuthorPlanStrictJsonSchema
} from "./capabilityAuthorSchemas";
import { CAPABILITY_AUTHOR_TOOLS } from "./capabilityTools.server";

function providerErrorSummary(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: String(error).slice(0, 500) };
  }
  const value = error as Record<string, unknown>;
  return {
    status: typeof value.status === "number" ? value.status : undefined,
    code: typeof value.code === "string" ? value.code : undefined,
    type: typeof value.type === "string" ? value.type : undefined,
    requestId:
      typeof value.requestID === "string" ? value.requestID : undefined,
    param: typeof value.param === "string" ? value.param : undefined,
    message:
      typeof value.message === "string"
        ? value.message.slice(0, 500)
        : "Unknown provider error"
  };
}

function outputValidationIssues(error: z.ZodError): readonly string[] {
  return error.issues.slice(0, 16).map((issue) => {
    const path = issue.path.join(".") || "$";
    return `${path}: ${issue.message}`;
  });
}

function outputValidationRepairPrompt(error: z.ZodError): string {
  return JSON.stringify({
    correction:
      "Your previous final plan did not satisfy the required response contract. Return the complete JSON plan again, with no commentary.",
    issues: outputValidationIssues(error)
  });
}

export interface CapabilityAuthorOpenAiClient {
  readonly responses: Pick<OpenAI["responses"], "create">;
}

export interface CreateOpenAiCapabilityAuthorPlannerOptions {
  readonly client?: CapabilityAuthorOpenAiClient;
  readonly model?: string;
}

function hasRefusal(
  output: readonly { readonly type: string; readonly content?: unknown }[]
): boolean {
  return output.some(
    (item) =>
      item.type === "message" &&
      Array.isArray(item.content) &&
      item.content.some(
        (content) =>
          content &&
          typeof content === "object" &&
          "type" in content &&
          content.type === "refusal"
      )
  );
}

export function createOpenAiCapabilityAuthorPlanner(
  options: CreateOpenAiCapabilityAuthorPlannerOptions = {}
): CapabilityAuthorPlanner {
  const model =
    options.model ??
    process.env.OPENAI_LAB_CAPABILITY_AUTHOR_MODEL ??
    CAPABILITY_AUTHOR_DEFAULT_MODEL;
  const client =
    options.client ??
    new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 0,
      timeout: CAPABILITY_AUTHOR_LIMITS.timeoutMs
    });

  return Object.freeze({
    mode: "live" as const,
    model,
    async runRound(
      context: CapabilityAuthorPlannerContext
    ): Promise<CapabilityAuthorPlannerRoundResult> {
      const input: ResponseInputItem[] = [
        { role: "system", content: CAPABILITY_AUTHOR_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            promptVersion: CAPABILITY_AUTHOR_PROMPT_VERSION,
            toolContractVersion: CAPABILITY_AUTHOR_TOOL_CONTRACT_VERSION,
            attempt: context.attempt,
            request: context.request,
            currentDraft: context.draftSummary,
            deterministicDiagnostics: context.diagnostics
          })
        }
      ];
      let modelCalls = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      let usedOutputValidationRepair = false;

      for (
        let round = 0;
        round < Math.min(5, context.modelCallsRemaining);
        round += 1
      ) {
        const response = await client.responses
          .create(
            {
              model,
              input,
              tools: [...CAPABILITY_AUTHOR_TOOLS],
              tool_choice: "auto",
              parallel_tool_calls: true,
              max_output_tokens:
                CAPABILITY_AUTHOR_LIMITS.maxOutputTokensPerCall,
              store: false,
              text: {
                format: {
                  type: "json_schema",
                  name: "capability_author_plan",
                  strict: true,
                  schema: capabilityAuthorPlanStrictJsonSchema()
                }
              }
            },
            { signal: context.signal }
          )
          .catch((error: unknown) => {
            console.error(
              `Capability author provider request failed: ${JSON.stringify(
                providerErrorSummary(error)
              )}`
            );
            throw error;
          });
        modelCalls += 1;
        inputTokens += response.usage?.input_tokens ?? 0;
        outputTokens += response.usage?.output_tokens ?? 0;
        if (response.status === "incomplete") {
          throw new CapabilityAuthoringError(
            "authoring.output_truncated.v2",
            "The capability author response was incomplete before the plan finished.",
            502,
            true
          );
        }
        if (hasRefusal(response.output)) {
          throw new CapabilityAuthoringError(
            "authoring.model_refused.v2",
            "The capability author refused this request.",
            422,
            false
          );
        }

        const toolCalls = response.output.filter(
          (item) => item.type === "function_call"
        );
        if (toolCalls.length === 0) {
          let parsedPlan: unknown;
          try {
            parsedPlan = capabilityAuthorPlanSchema.parse(
              JSON.parse(response.output_text)
            );
          } catch (error) {
            if (
              error instanceof z.ZodError &&
              !usedOutputValidationRepair &&
              round + 1 < Math.min(5, context.modelCallsRemaining)
            ) {
              usedOutputValidationRepair = true;
              console.warn(
                "Capability author output failed validation; requesting one repair.",
                { issues: outputValidationIssues(error) }
              );
              input.push({
                role: "user",
                content: outputValidationRepairPrompt(error)
              });
              continue;
            }
            throw new CapabilityAuthoringError(
              "authoring.output_invalid.v2",
              "The capability author returned no bounded plan.",
              502,
              true
            );
          }
          return {
            plan: parsedPlan,
            usage: { modelCalls, inputTokens, outputTokens }
          };
        }

        for (const item of response.output) {
          if (item.type === "function_call") {
            input.push({
              type: "function_call",
              call_id: item.call_id,
              name: item.name,
              arguments: item.arguments
            });
          } else if (item.type === "reasoning") {
            input.push(item);
          } else if (item.type === "message") {
            input.push(item);
          }
        }
        for (const toolCall of toolCalls) {
          let args: unknown;
          try {
            args = JSON.parse(toolCall.arguments) as unknown;
          } catch {
            throw new CapabilityAuthoringError(
              "authoring.tool_failure.v2",
              "The capability author supplied invalid tool arguments.",
              502,
              true,
              [`tools.${toolCall.name}`]
            );
          }
          const output = context.executeTool(toolCall.name, args);
          input.push({
            type: "function_call_output",
            call_id: toolCall.call_id,
            output: JSON.stringify(output)
          });
        }
      }

      throw new CapabilityAuthoringError(
        "authoring.output_invalid.v2",
        "The capability author did not finish within the fixed model-round budget.",
        503,
        true
      );
    }
  });
}
