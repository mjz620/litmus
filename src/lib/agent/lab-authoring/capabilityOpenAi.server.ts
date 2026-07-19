import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInputItem } from "openai/resources/responses/responses";

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
  capabilityAuthorPlanSchema
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
    message:
      typeof value.message === "string"
        ? value.message.slice(0, 500)
        : "Unknown provider error"
  };
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

export function createOpenAiCapabilityAuthorPlanner(): CapabilityAuthorPlanner {
  const model =
    process.env.OPENAI_LAB_CAPABILITY_AUTHOR_MODEL ??
    CAPABILITY_AUTHOR_DEFAULT_MODEL;
  const client = new OpenAI({
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

      for (
        let round = 0;
        round < Math.min(5, context.modelCallsRemaining);
        round += 1
      ) {
        const response = await client.responses
          .parse(
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
                format: zodTextFormat(
                  capabilityAuthorPlanSchema,
                  "capability_author_plan"
                )
              }
            },
            { signal: context.signal }
          )
          .catch((error: unknown) => {
            console.error(
              "Capability author provider request failed.",
              providerErrorSummary(error)
            );
            throw error;
          });
        modelCalls += 1;
        inputTokens += response.usage?.input_tokens ?? 0;
        outputTokens += response.usage?.output_tokens ?? 0;
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
          if (!response.output_parsed) {
            throw new CapabilityAuthoringError(
              "authoring.output_invalid.v2",
              "The capability author returned no bounded plan.",
              502,
              true
            );
          }
          return {
            plan: response.output_parsed,
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
            input.push({
              ...item,
              content: item.content.map((content) => {
                if (content.type !== "output_text") return content;
                const { parsed: ignoredParsed, ...wireContent } = content;
                void ignoredParsed;
                return wireContent;
              })
            });
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
