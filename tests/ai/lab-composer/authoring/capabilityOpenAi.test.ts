import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createOpenAiCapabilityAuthorPlanner,
  type CapabilityAuthorOpenAiClient
} from "../../../../src/lib/agent/lab-authoring/capabilityOpenAi.server";
import {
  capabilityAuthorPlanShellStrictJsonSchema,
  capabilityAuthorPlanStrictJsonSchema,
  type CapabilityAuthorRequest
} from "../../../../src/lib/agent/lab-authoring/capabilityAuthorSchemas";
import {
  runCapabilityAuthoringWithDeterministicFallback,
  type CapabilityAuthorPlannerContext
} from "../../../../src/lib/agent/lab-authoring/capabilityAuthor";
import { GENERIC_LAB_RUNTIME_SCHEMA_VERSION } from "../../../../src/lab-workflows/runtime";

const REQUEST: CapabilityAuthorRequest = {
  contractVersion: "2.0.0",
  teacherRequest: "Create a sodium chloride dilution lab.",
  deviceProfileId: "device.chromebook_core.v1"
};

function completedResponse(plan: unknown) {
  return {
    status: "completed",
    output: [],
    output_text: JSON.stringify(plan),
    usage: { input_tokens: 11, output_tokens: 13 }
  };
}

function plannerContext(): CapabilityAuthorPlannerContext {
  return {
    request: REQUEST,
    attempt: 1,
    diagnostics: [],
    draftSummary: {
      schemaVersion: "2.0.0",
      id: "workflow.test.v2",
      revision: 1,
      draftHash: "test-hash",
      supportStatus: "draft_unvalidated"
    },
    modelCallsRemaining: 5,
    executeTool: () => ({ ok: true }),
    signal: new AbortController().signal
  };
}

function plannerWithResponses(...responses: readonly unknown[]) {
  const create = vi.fn();
  for (const response of responses) {
    create.mockResolvedValueOnce(response);
  }
  const client = {
    responses: { create }
  } as unknown as CapabilityAuthorOpenAiClient;
  return {
    create,
    planner: createOpenAiCapabilityAuthorPlanner({
      client,
      model: "capability-author-test-model"
    })
  };
}

function visitSchema(
  node: unknown,
  visit: (object: Record<string, unknown>) => void
): void {
  if (Array.isArray(node)) {
    node.forEach((item) => visitSchema(item, visit));
    return;
  }
  if (!node || typeof node !== "object") return;
  const object = node as Record<string, unknown>;
  visit(object);
  Object.values(object).forEach((value) => visitSchema(value, visit));
}

describe("live capability author structured-output boundary", () => {
  it("sends a strict schema without provider-forbidden validation keywords", () => {
    const schema = capabilityAuthorPlanStrictJsonSchema();
    const forbidden = new Set([
      "minLength",
      "maxLength",
      "minItems",
      "maxItems",
      "pattern",
      "format",
      "minimum",
      "maximum",
      "exclusiveMinimum",
      "exclusiveMaximum",
      "multipleOf",
      "$schema",
      "default"
    ]);

    visitSchema(schema, (node) => {
      for (const key of Object.keys(node)) {
        expect(forbidden.has(key)).toBe(false);
        expect(key).not.toBe("oneOf");
      }
    });
  });

  it("retains strict object requirements after stripping provider-forbidden bounds", () => {
    const schema = capabilityAuthorPlanStrictJsonSchema();

    visitSchema(schema, (node) => {
      const properties = node.properties;
      if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
        return;
      }
      expect(node.additionalProperties).toBe(false);
      expect(Array.isArray(node.required)).toBe(true);
      expect(new Set(node.required as string[])).toEqual(
        new Set(Object.keys(properties as Record<string, unknown>))
      );
    });
  });

  it("re-prompts once with Zod issues when the strict transport shape misses plan refinements", async () => {
    const invalidCandidate = {
      disposition: "candidate",
      objective: "Prepare a dilution.",
      assumptions: [],
      questions: [],
      limitations: [],
      traceCases: []
    };
    const validClarification = {
      disposition: "needs_clarification",
      objective: "Choose a measurable dilution objective.",
      assumptions: [],
      questions: ["Which concentration range should students use?"],
      limitations: ["The request needs one bounded concentration target."],
      traceCases: []
    };
    const { create, planner } = plannerWithResponses(
      completedResponse(invalidCandidate),
      completedResponse(validClarification)
    );
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      const result = await planner.runRound(plannerContext());
      expect(result.plan).toEqual(validClarification);
    } finally {
      warning.mockRestore();
    }

    expect(create).toHaveBeenCalledTimes(2);
    const firstRequest = create.mock.calls[0]?.[0] as {
      text: { format: { strict: boolean; schema: unknown } };
    };
    expect(firstRequest.text.format.strict).toBe(true);
    /*
     * Trace cases are requested concurrently after this call, so the plan call
     * transmits the shell shape. The full bounded schema still validates the
     * merged plan, which is what the repair below is reacting to.
     */
    expect(firstRequest.text.format.schema).toEqual(
      capabilityAuthorPlanShellStrictJsonSchema()
    );
    const secondRequest = create.mock.calls[1]?.[0] as { input: unknown };
    expect(JSON.stringify(secondRequest.input)).toContain(
      "Candidate plans require exactly one case of every trace kind"
    );
  });

  it("reports incomplete provider output as truncation rather than malformed JSON", async () => {
    const { create, planner } = plannerWithResponses({
      status: "incomplete",
      output: [],
      output_text: "",
      usage: { input_tokens: 11, output_tokens: 12 },
      incomplete_details: { reason: "max_output_tokens" }
    });

    await expect(planner.runRound(plannerContext())).rejects.toMatchObject({
      code: "authoring.output_truncated.v2",
      retryable: true
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("maps a 400 provider error to a non-retryable failure without local fallback", async () => {
    const apiError = new OpenAI.APIError(
      400,
      { error: { code: "invalid_json_schema" } },
      "Invalid schema",
      new Headers()
    );
    const create = vi.fn().mockRejectedValue(apiError);
    const client = {
      responses: { create }
    } as unknown as CapabilityAuthorOpenAiClient;
    const planner = createOpenAiCapabilityAuthorPlanner({
      client,
      model: "capability-author-test-model"
    });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      await expect(
        runCapabilityAuthoringWithDeterministicFallback(REQUEST, {
          planner,
          checkedAt: "2026-07-20T00:00:00.000Z"
        })
      ).rejects.toMatchObject({
        code: "authoring.provider_configuration.v2",
        retryable: false
      });
    } finally {
      errorLog.mockRestore();
    }

    expect(create).toHaveBeenCalledTimes(1);
  });
});

/*
 * Authoring latency is dominated by output volume (~60-70 output tokens per
 * second), and the five trace cases are most of a candidate plan. Emitting
 * them in one response is inherently serial; requesting one per call lets them
 * overlap. These tests pin the contract that makes that safe.
 */
describe("parallel trace-case generation", () => {
  const shell = {
    disposition: "candidate",
    objective: "Prepare a 0.0100 M sodium chloride dilution.",
    assumptions: [],
    questions: [],
    limitations: []
  };
  const traceFor = (kind: string) => ({
    kind,
    actions: [
      {
        schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
        permissionId: "permission.s1.a1",
        actionId: "action.transfer_liquid.v1",
        sourceEquipmentInstanceId: "stock_pipette",
        targetEquipmentInstanceIds: ["volumetric_flask"],
        parameters: []
      }
    ]
  });

  it("requests every trace kind concurrently and merges them into one plan", async () => {
    const kinds = [
      "valid",
      "alternate_valid",
      "recoverable_mistake",
      "terminal_mistake",
      "tolerance_boundary"
    ];
    const { create, planner } = plannerWithResponses(
      completedResponse(shell),
      ...kinds.map((kind) => completedResponse(traceFor(kind)))
    );

    const result = await planner.runRound(plannerContext());

    // One plan call plus one call per trace kind.
    expect(create).toHaveBeenCalledTimes(1 + kinds.length);
    const plan = result.plan as { traceCases: { kind: string }[] };
    expect(plan.traceCases.map(({ kind }) => kind).sort()).toEqual(
      [...kinds].sort()
    );
    // Usage must account for the fan-out, not just the plan call.
    expect(result.usage.modelCalls).toBe(1 + kinds.length);
  });

  it("asks each trace call for exactly one named kind", async () => {
    const kinds = [
      "valid",
      "alternate_valid",
      "recoverable_mistake",
      "terminal_mistake",
      "tolerance_boundary"
    ];
    const { create, planner } = plannerWithResponses(
      completedResponse(shell),
      ...kinds.map((kind) => completedResponse(traceFor(kind)))
    );

    await planner.runRound(plannerContext());

    const requested = create.mock.calls.slice(1).map((call) => {
      const input = (call[0] as { input: { content?: unknown }[] }).input;
      return JSON.parse(String(input[input.length - 1]?.content)) as {
        kind: string;
      };
    });
    expect(requested.map(({ kind }) => kind).sort()).toEqual([...kinds].sort());
  });

  it("emits no trace calls when the plan is not a candidate", async () => {
    const { create, planner } = plannerWithResponses(
      completedResponse({
        ...shell,
        disposition: "needs_clarification",
        questions: ["Which concentration should students target?"]
      })
    );

    const result = await planner.runRound(plannerContext());

    expect(create).toHaveBeenCalledTimes(1);
    expect((result.plan as { traceCases: unknown[] }).traceCases).toEqual([]);
  });

  it("pins the requested kind so a mislabelled response cannot collapse two kinds", async () => {
    // Every trace call answers "valid"; the merge must still yield five kinds.
    const { planner } = plannerWithResponses(
      completedResponse(shell),
      ...Array.from({ length: 5 }, () => completedResponse(traceFor("valid")))
    );

    const result = await planner.runRound(plannerContext());

    const plan = result.plan as { traceCases: { kind: string }[] };
    expect(new Set(plan.traceCases.map(({ kind }) => kind)).size).toBe(5);
  });
});
