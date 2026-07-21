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
  capabilityAuthorPlanShellSchema,
  capabilityAuthorPlanShellStrictJsonSchema,
  capabilityAuthorPlanStrictJsonSchema,
  capabilityAuthorTraceCaseStrictJsonSchema,
  capabilityAuthorTraceKindSchema
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

const CAPABILITY_AUTHOR_REASONING_EFFORTS = Object.freeze([
  "none",
  "low",
  "medium",
  "high",
  "xhigh"
] as const);

type CapabilityAuthorReasoningEffort =
  (typeof CAPABILITY_AUTHOR_REASONING_EFFORTS)[number];

/** Override with OPENAI_LAB_CAPABILITY_AUTHOR_EFFORT to trade latency for depth. */
const CAPABILITY_AUTHOR_REASONING_EFFORT: CapabilityAuthorReasoningEffort =
  (CAPABILITY_AUTHOR_REASONING_EFFORTS as readonly string[]).includes(
    process.env.OPENAI_LAB_CAPABILITY_AUTHOR_EFFORT ?? ""
  )
    ? (process.env
        .OPENAI_LAB_CAPABILITY_AUTHOR_EFFORT as CapabilityAuthorReasoningEffort)
    : "low";

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

/** Set OPENAI_LAB_CAPABILITY_AUTHOR_PARALLEL_TRACES=0 to fall back to one call. */
const parallelTraces =
  process.env.OPENAI_LAB_CAPABILITY_AUTHOR_PARALLEL_TRACES !== "0";

const TRACE_KIND_BRIEFS: Readonly<Record<string, string>> = Object.freeze({
  valid:
    "The canonical successful run: every required step performed correctly, in order, reaching completion.",
  alternate_valid:
    "A different but equally correct run — a legitimate reordering or an alternate permitted choice — that also reaches completion.",
  recoverable_mistake:
    "A realistic student error the workflow lets them detect and correct, continuing to completion afterwards.",
  terminal_mistake:
    "A realistic error that the workflow treats as unrecoverable, ending the run without completion.",
  tolerance_boundary:
    "A run that lands exactly on an authored tolerance edge, exercising the boundary rather than the comfortable middle."
});

/**
 * Fill a plan shell's trace cases with one concurrent request per trace kind.
 *
 * The tool loop has already built the draft, so each trace is an independent
 * reading of the same finished workflow; nothing about them is sequential
 * except the transport. Running them together turns the slowest phase of
 * authoring from the sum of five generations into roughly the longest one.
 *
 * Each request replays the accumulated conversation so the model still sees
 * the draft and tool results it built. That repeats input tokens per trace —
 * a deliberate trade of cost for latency, and input tokens are the cheap half.
 */
async function completePlanWithParallelTraces(
  shell: unknown,
  options: {
    readonly client: CapabilityAuthorOpenAiClient;
    readonly model: string;
    readonly input: readonly ResponseInputItem[];
    readonly signal: AbortSignal;
    readonly onUsage: (
      calls: number,
      inputTokens: number,
      outputTokens: number
    ) => void;
  }
): Promise<unknown> {
  const parsedShell = capabilityAuthorPlanShellSchema.safeParse(shell);
  if (!parsedShell.success) return shell;
  if (parsedShell.data.disposition !== "candidate") {
    return { ...parsedShell.data, traceCases: [] };
  }

  const kinds = capabilityAuthorTraceKindSchema.options;
  const traceCases = await Promise.all(
    kinds.map(async (kind) => {
      const response = await options.client.responses.create(
        {
          model: options.model,
          input: [
            ...options.input,
            {
              role: "user",
              content: JSON.stringify({
                instruction:
                  "Return exactly one executable trace case for the draft you just authored. Emit only this trace kind.",
                kind,
                meaning: TRACE_KIND_BRIEFS[kind],
                rules: [
                  "Use only permission ids and equipment instance ids present in the draft.",
                  "Order actions exactly as a student would perform them.",
                  "Do not restate the plan, the objective, or any other trace kind."
                ]
              })
            }
          ],
          max_output_tokens: CAPABILITY_AUTHOR_LIMITS.maxOutputTokensPerCall,
          store: false,
          reasoning: { effort: CAPABILITY_AUTHOR_REASONING_EFFORT },
          text: {
            verbosity: "low",
            format: {
              type: "json_schema",
              name: "capability_author_trace_case",
              strict: true,
              schema: capabilityAuthorTraceCaseStrictJsonSchema()
            }
          }
        },
        { signal: options.signal }
      );
      options.onUsage(
        1,
        response.usage?.input_tokens ?? 0,
        response.usage?.output_tokens ?? 0
      );
      if (response.status === "incomplete") {
        throw new CapabilityAuthoringError(
          "authoring.output_truncated.v2",
          `The ${kind} trace case was incomplete before it finished.`,
          502,
          true
        );
      }
      // Pin the kind so a mislabelled response cannot collapse two kinds into
      // one and trip the "exactly one of every kind" rule downstream.
      return {
        ...(JSON.parse(response.output_text) as Record<string, unknown>),
        kind
      };
    })
  );

  return { ...parsedShell.data, traceCases };
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
              /*
               * Authoring latency is dominated by output volume, not thinking:
               * measured throughput is ~60 output tokens/second, and a plan
               * carrying five trace cases runs to thousands of tokens. Reasoning
               * effort is a smaller lever but a free one — measured 11.0s at
               * "low" against 15.5s unset and 17.7s at "medium" on an identical
               * request. The task is heavily constrained by a strict schema and
               * typed tools, so deep reasoning buys little here.
               *
               * Note "minimal" is rejected by gpt-5.6; the accepted values are
               * none, low, medium, high, and xhigh.
               */
              reasoning: { effort: CAPABILITY_AUTHOR_REASONING_EFFORT },
              text: {
                // Shortens prose fields (assumptions, limitations, purposes)
                // without touching schema-constrained structure.
                verbosity: "low",
                format: {
                  type: "json_schema",
                  name: "capability_author_plan",
                  strict: true,
                  /*
                   * With parallel traces on, this call returns judgement and
                   * prose only; the traces follow concurrently. That keeps the
                   * serial phase small, which is where the latency lives.
                   */
                  schema: parallelTraces
                    ? capabilityAuthorPlanShellStrictJsonSchema()
                    : capabilityAuthorPlanStrictJsonSchema()
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
            const shell = JSON.parse(response.output_text) as unknown;
            const completed = parallelTraces
              ? await completePlanWithParallelTraces(shell, {
                  client,
                  model,
                  input,
                  signal: context.signal,
                  onUsage: (calls, inTok, outTok) => {
                    modelCalls += calls;
                    inputTokens += inTok;
                    outputTokens += outTok;
                  }
                })
              : shell;
            parsedPlan = capabilityAuthorPlanSchema.parse(completed);
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
