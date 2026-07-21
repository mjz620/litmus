import { describe, expect, it } from "vitest";

import {
  createAuthoredCoachWorkflowContext,
  generateAuthoredCoachResponse
} from "../../src/lib/agent/authoredCoach";
import {
  AUTHORED_COACH_CONTRACT_VERSION,
  type AuthoredCoachModelOutput,
  type AuthoredCoachRequest,
  type AuthoredCoachWorkflowContext
} from "../../src/lib/agent/authoredCoachSchemas";
import {
  AUTHORED_COACH_SYSTEM_PROMPT,
  authoredCoachPromptInput
} from "../../src/lib/agent/authoredCoachPrompt";
import {
  createSolutionPreparationTracePlan,
  SOLUTION_PREPARATION_V2_DRAFT,
  SOLUTION_PREPARATION_V2_EXPECTED_HASH,
  validateSolutionPreparationV2
} from "../../src/lab-workflows/definitions/solution-preparation";
import {
  TITRATION_V2_EXPECTED_HASH,
  validateStrictMigratedTitrationV2
} from "../../src/lab-workflows/definitions/titration";
import { validateLabWorkflowSpecV2 } from "../../src/lab-workflows/validation";
import {
  STRICT_TITRATION_SETUP_SELECTION,
  createSetupDrivenNativeSession,
  createSetupDrivenTitrationSession,
  normalizeSetupDrivenTitrationAction
} from "../../src/stores/setupDrivenLabSession";

const CHECKED_AT = "2026-07-18T15:00:00.000Z";
const solutionDefinition = validateSolutionPreparationV2(CHECKED_AT);

function solutionSession(
  definition = solutionDefinition,
  sessionId = "coach-solution"
) {
  return createSetupDrivenNativeSession({
    sessionId,
    sessionSeed: `${sessionId}-seed`,
    selection: {
      workflowId: definition.id,
      workflowHash: definition.validation.canonicalSpecHash
    },
    workflow: definition
  });
}

function request(
  workflowContext: Readonly<AuthoredCoachWorkflowContext>,
  overrides: Partial<AuthoredCoachRequest> = {}
): AuthoredCoachRequest {
  return {
    contractVersion: AUTHORED_COACH_CONTRACT_VERSION,
    sessionId: workflowContext.runtime.sessionId,
    experimentId: "solution_preparation",
    workflowContext,
    studentQuestion: "What should I pay attention to next?",
    triggerPolicy: {
      source: "question",
      reasons: ["student_question"],
      maxHintLevel: 3
    },
    ...overrides
  };
}

function eventRequest(
  workflowContext: Readonly<AuthoredCoachWorkflowContext>
): AuthoredCoachRequest {
  const diagnosisReasons = workflowContext.diagnoses
    .filter(({ status }) => status === "violated")
    .map(({ ruleId }) => `diagnosis:${ruleId}`);
  const reasons =
    diagnosisReasons.length > 0
      ? diagnosisReasons
      : [
          ...new Set(
            workflowContext.evidence.flatMap(({ payload }) => payload.flags)
          )
        ];
  return request(workflowContext, {
    studentQuestion: undefined,
    triggerPolicy: { source: "event", reasons, maxHintLevel: 2 }
  });
}

function mutableContext(
  context: Readonly<AuthoredCoachWorkflowContext>
): AuthoredCoachWorkflowContext {
  return structuredClone(context) as AuthoredCoachWorkflowContext;
}

function modelOutputFromResponse(
  response: Awaited<ReturnType<typeof generateAuthoredCoachResponse>>
): AuthoredCoachModelOutput {
  return {
    shouldRespond: response.shouldRespond,
    interventionType: response.interventionType,
    hintLevel: response.hintLevel,
    message: response.message,
    guidance: response.guidance,
    safety: response.safety
  };
}

describe("LC2-703 diagnosis-aware authored Coach", () => {
  it("builds exact versioned context and answers direct questions for both labs", async () => {
    const solution = solutionSession();
    const solutionContext = createAuthoredCoachWorkflowContext(
      solution.getWorkflow(),
      solution.getGenericState()
    );
    const solutionResponse = await generateAuthoredCoachResponse(
      request(solutionContext)
    );

    const titration = createSetupDrivenTitrationSession({
      experimentId: "acid_base_titration",
      sessionId: "coach-titration",
      sessionSeed: "coach-titration-seed",
      selection: STRICT_TITRATION_SETUP_SELECTION
    });
    const titrationContext = createAuthoredCoachWorkflowContext(
      titration.getWorkflow(),
      titration.getGenericState()
    );
    const titrationResponse = await generateAuthoredCoachResponse(
      request(titrationContext, { experimentId: "acid_base_titration" })
    );

    expect(solutionContext).toMatchObject({
      schemaVersion: "2.0.0",
      definitionHash: SOLUTION_PREPARATION_V2_EXPECTED_HASH,
      runtime: { workflowHash: SOLUTION_PREPARATION_V2_EXPECTED_HASH }
    });
    expect(titrationContext.definitionHash).toBe(TITRATION_V2_EXPECTED_HASH);
    for (const response of [solutionResponse, titrationResponse]) {
      expect(response).toMatchObject({
        ok: true,
        shouldRespond: true,
        guidance: { kind: "ai_guidance" },
        authority: {
          kind: "advisory",
          simulationStateChanged: false,
          canResetCheckpoint: false,
          canChangeWorkflowRules: false
        }
      });
      expect(response.hintLevel).toBeLessThanOrEqual(3);
    }
  });

  it("explains a real recoverable conceptual diagnosis using authored guidance", async () => {
    const runtime = solutionSession(solutionDefinition, "coach-conceptual");
    const valid = createSolutionPreparationTracePlan().find(
      ({ kind }) => kind === "valid"
    );
    if (!valid) throw new Error("Missing valid trace plan.");
    const conceptualMiss = valid.actions.slice(0, 4).map((action) => ({
      ...action,
      targetEquipmentInstanceIds: [...action.targetEquipmentInstanceIds],
      parameters: action.parameters.map((parameter) =>
        parameter.key === "volumeML" && parameter.valueType === "number"
          ? { ...parameter, value: 9.98 }
          : { ...parameter }
      )
    }));
    for (const action of conceptualMiss) {
      const volume = action.parameters.find(({ key }) => key === "volumeML");
      if (volume?.valueType === "number") volume.value = 9.98;
      runtime.dispatch(action);
    }
    const context = createAuthoredCoachWorkflowContext(
      runtime.getWorkflow(),
      runtime.getGenericState()
    );
    expect(context.diagnoses).toContainEqual(
      expect.objectContaining({
        status: "violated",
        severity: "conceptual",
        recoverable: true
      })
    );

    const response = await generateAuthoredCoachResponse(eventRequest(context));

    expect(response).toMatchObject({
      shouldRespond: true,
      guidance: {
        kind: "ai_guidance",
        ruleIds: ["rule.final_concentration_tolerance"]
      }
    });
    expect(response.message).toContain(
      "displayed final volume and concentration evidence"
    );
    expect(response.hintLevel).toBeLessThanOrEqual(2);
  });

  it("labels a real violated safety rule as safety", async () => {
    const safetyDraft = structuredClone(SOLUTION_PREPARATION_V2_DRAFT);
    const safetyRule = safetyDraft.rules.find(
      ({ id }) => id === "rule.final_volume_tolerance"
    );
    if (!safetyRule) throw new Error("Missing safety test rule.");
    safetyRule.severity = "safety";
    const outcome = validateLabWorkflowSpecV2(safetyDraft, {
      checkedAt: CHECKED_AT
    });
    if (!outcome.schemaValid || !outcome.validation.previewEligible) {
      throw new Error("Safety test definition must remain preview eligible.");
    }
    const runtime = solutionSession(outcome.spec, "coach-safety");
    const recoverable = createSolutionPreparationTracePlan().find(
      ({ kind }) => kind === "recoverable_mistake"
    );
    if (!recoverable) throw new Error("Missing recoverable trace plan.");
    for (const action of recoverable.actions.slice(0, 4)) {
      runtime.dispatch(action);
    }
    const context = createAuthoredCoachWorkflowContext(
      runtime.getWorkflow(),
      runtime.getGenericState()
    );

    const response = await generateAuthoredCoachResponse(eventRequest(context));

    expect(response).toMatchObject({
      interventionType: "warning",
      guidance: {
        kind: "safety",
        ruleIds: ["rule.final_volume_tolerance"]
      }
    });
    expect(response.message).toMatch(/^Pause for this safety check:/);
  });

  it("distinguishes optional authored best practice from required procedure", async () => {
    const runtime = solutionSession(solutionDefinition, "coach-optional");
    const context = createAuthoredCoachWorkflowContext(
      runtime.getWorkflow(),
      runtime.getGenericState()
    );

    const response = await generateAuthoredCoachResponse(
      request(context, {
        studentQuestion: "Do I have to mix the flask ten times?"
      })
    );

    expect(response).toMatchObject({
      shouldRespond: true,
      guidance: {
        kind: "optional_context",
        ruleIds: ["rule.mix_count_best_practice"],
        instructionIds: ["instruction.dilute_and_mix"]
      }
    });
    expect(response.message).toMatch(/^This is helpful, but not required:/);
  });

  it("stays silent for routine success and an alternate valid approach without calling a model", async () => {
    const runtime = solutionSession(solutionDefinition, "coach-alternate");
    const alternate = createSolutionPreparationTracePlan().find(
      ({ kind }) => kind === "alternate_valid"
    );
    if (!alternate) throw new Error("Missing alternate-valid trace plan.");
    alternate.actions.forEach((action) => runtime.dispatch(action));
    const context = createAuthoredCoachWorkflowContext(
      runtime.getWorkflow(),
      runtime.getGenericState()
    );
    let modelCalls = 0;

    const response = await generateAuthoredCoachResponse(
      eventRequest(context),
      {
        model: {
          model: "must-not-run",
          async respond() {
            modelCalls += 1;
            throw new Error("Routine success must not invoke a model.");
          }
        }
      }
    );

    expect(context.runtime.workflowStatus).toBe("completed");
    expect(context.diagnoses.some(({ status }) => status === "violated")).toBe(
      false
    );
    expect(response).toMatchObject({
      shouldRespond: false,
      interventionType: "none",
      message: ""
    });
    expect(modelCalls).toBe(0);
  });

  it("rejects stale definitions and unknown rule/action context", async () => {
    const runtime = solutionSession(solutionDefinition, "coach-invalid");
    const baseContext = createAuthoredCoachWorkflowContext(
      runtime.getWorkflow(),
      runtime.getGenericState()
    );
    const stale = mutableContext(baseContext);
    stale.definition.metadata.title = "Changed after validation";
    await expect(
      generateAuthoredCoachResponse(request(stale))
    ).rejects.toMatchObject({
      code: "coach.stale_definition.v2",
      status: 409
    });

    const unknownRule = mutableContext(baseContext);
    unknownRule.rules[0] = { ...unknownRule.rules[0], id: "rule.unknown" };
    await expect(
      generateAuthoredCoachResponse(request(unknownRule))
    ).rejects.toMatchObject({
      code: "coach.context_mismatch.v2"
    });

    const eventRuntime = solutionSession(solutionDefinition, "coach-action");
    eventRuntime.dispatch(createSolutionPreparationTracePlan()[0].actions[0]);
    const unknownAction = mutableContext(
      createAuthoredCoachWorkflowContext(
        eventRuntime.getWorkflow(),
        eventRuntime.getGenericState()
      )
    );
    unknownAction.evidence[0].normalizedAction.actionId = "action.unknown.v1";
    await expect(
      generateAuthoredCoachResponse(request(unknownAction))
    ).rejects.toMatchObject({
      code: "coach.unsupported_reference.v2"
    });
  });

  /*
   * A student asking "what happens if I didn't tare" used to get the next lab
   * step read back at them. One unrecognised id anywhere in the citation arrays
   * discarded the model's whole answer, so a citation problem presented as a
   * comprehension problem. Unknown ids are now stripped and the answer stands.
   */
  it("strips invented references instead of discarding the answer", async () => {
    const runtime = solutionSession(solutionDefinition, "coach-grounding");
    const context = createAuthoredCoachWorkflowContext(
      runtime.getWorkflow(),
      runtime.getGenericState()
    );
    const authoredRequest = request(context);
    const validOutput = modelOutputFromResponse(
      await generateAuthoredCoachResponse(authoredRequest)
    );
    if (!validOutput.guidance) throw new Error("Expected guidance.");

    const knownActionIds = validOutput.guidance.recoveryActionIds;
    const partlyInvented = structuredClone(validOutput);
    partlyInvented.message = "Tare the balance before you record the mass.";
    partlyInvented.guidance!.recoveryActionIds = [
      ...knownActionIds,
      "action.unknown.v1"
    ];

    const result = await generateAuthoredCoachResponse(authoredRequest, {
      model: {
        model: "partly-invented",
        async respond() {
          return partlyInvented;
        }
      }
    });

    // The answer survives, in the model's own words.
    expect(result.metadata.mode).toBe("live");
    expect(result.metadata.fallbackReason).toBeNull();
    expect(result.message).toBe(
      "Tare the balance before you record the mass."
    );
    // Only the unsupported id is gone; supplied ones are untouched.
    expect(result.guidance?.recoveryActionIds).toEqual(knownActionIds);
    expect(result.guidance?.recoveryActionIds).not.toContain(
      "action.unknown.v1"
    );
  });

  /*
   * Repair may only ever remove a claim of support. If stripping could leave a
   * response asserting evidence the engine never supplied, it would be a worse
   * failure than the rejection it replaced.
   */
  it("never lets a repaired answer cite more than the model asked for", async () => {
    const runtime = solutionSession(solutionDefinition, "coach-grounding-sub");
    const context = createAuthoredCoachWorkflowContext(
      runtime.getWorkflow(),
      runtime.getGenericState()
    );
    const authoredRequest = request(context);
    const validOutput = modelOutputFromResponse(
      await generateAuthoredCoachResponse(authoredRequest)
    );
    if (!validOutput.guidance) throw new Error("Expected guidance.");

    const invented = structuredClone(validOutput);
    invented.guidance!.objectiveIds = ["objective.not_supplied.v1"];
    invented.guidance!.ruleIds = ["rule.not_supplied.v1"];
    invented.guidance!.instructionIds = ["instruction.not_supplied.v1"];
    invented.guidance!.evidenceEventIds = ["event-that-never-happened"];

    const result = await generateAuthoredCoachResponse(authoredRequest, {
      model: {
        model: "fully-invented",
        async respond() {
          return invented;
        }
      }
    });

    for (const cited of [
      result.guidance?.objectiveIds ?? [],
      result.guidance?.ruleIds ?? [],
      result.guidance?.instructionIds ?? [],
      result.guidance?.evidenceEventIds ?? []
    ]) {
      expect(cited).toEqual([]);
    }
    // evidenceEventTypes is derived from surviving evidence ids, so a fabricated
    // event cannot reach the student as a cited observation.
    expect(result.evidenceEventTypes).toEqual([]);
  });

  /*
   * The guards that repair must not weaken. An unsolicited intervention has to
   * stay tied to a real violation — stripping the invented rule it cited leaves
   * it tied to nothing, which is a fallback, not a repair.
   */
  it("still falls back when stripping leaves unsolicited coaching untethered", async () => {
    const runtime = solutionSession(solutionDefinition, "coach-grounding-event");
    const context = createAuthoredCoachWorkflowContext(
      runtime.getWorkflow(),
      runtime.getGenericState()
    );
    const eventRequestForRuntime = eventRequest(context);
    const baseline = await generateAuthoredCoachResponse(
      eventRequestForRuntime
    );
    const output = modelOutputFromResponse(baseline);
    if (!output.guidance) return; // Nothing to coach in this state.

    const untethered = structuredClone(output);
    untethered.guidance!.ruleIds = ["rule.not_supplied.v1"];
    untethered.guidance!.evidenceEventIds = [];

    const result = await generateAuthoredCoachResponse(eventRequestForRuntime, {
      model: {
        model: "untethered",
        async respond() {
          return untethered;
        }
      }
    });
    expect(result.metadata.fallbackReason).toBe("model_output_invalid");
  });

  it("falls back for chemistry claims, down models, and slow models", async () => {
    const runtime = solutionSession(solutionDefinition, "coach-model-guard");
    const context = createAuthoredCoachWorkflowContext(
      runtime.getWorkflow(),
      runtime.getGenericState()
    );
    const authoredRequest = request(context);
    const deterministic = await generateAuthoredCoachResponse(authoredRequest);
    const validOutput = modelOutputFromResponse(deterministic);

    const chemistryClaim = structuredClone(validOutput);
    chemistryClaim.message = "The pH is 7.00, so you are finished.";
    const chemistryResult = await generateAuthoredCoachResponse(
      authoredRequest,
      {
        model: {
          model: "chemistry-invention",
          async respond() {
            return chemistryClaim;
          }
        }
      }
    );
    expect(chemistryResult.metadata.fallbackReason).toBe(
      "model_output_invalid"
    );
    expect(chemistryResult.message).not.toContain("pH is 7.00");

    const down = await generateAuthoredCoachResponse(authoredRequest, {
      model: {
        model: "down",
        async respond() {
          throw new Error("offline");
        }
      }
    });
    expect(down.metadata.fallbackReason).toBe("model_unavailable");

    const slow = await generateAuthoredCoachResponse(authoredRequest, {
      model: {
        model: "slow",
        async respond() {
          return new Promise(() => undefined);
        }
      },
      modelTimeoutMs: 5
    });
    expect(slow.metadata.fallbackReason).toBe("model_unavailable");
  });

  it("never mutates definition/runtime input and omits hidden chemistry from the prompt payload", async () => {
    const runtime = solutionSession(solutionDefinition, "coach-immutable");
    const context = createAuthoredCoachWorkflowContext(
      runtime.getWorkflow(),
      runtime.getGenericState()
    );
    const authoredRequest = request(context);
    const before = JSON.stringify(authoredRequest);

    await generateAuthoredCoachResponse(authoredRequest);

    expect(JSON.stringify(authoredRequest)).toBe(before);
    expect(authoredCoachPromptInput(authoredRequest)).not.toHaveProperty(
      "runtimeState"
    );
    expect(AUTHORED_COACH_SYSTEM_PROMPT).toContain(
      "Never mutate simulation state"
    );
    expect(AUTHORED_COACH_SYSTEM_PROMPT).toContain(
      "Never calculate or reconstruct pH"
    );
  });

  it("grounds a compatibility-backed titration trigger in exact evidence", async () => {
    const workflow = validateStrictMigratedTitrationV2(
      "2026-07-18T03:00:00.000Z"
    );
    const runtime = createSetupDrivenTitrationSession({
      experimentId: "acid_base_titration",
      sessionId: "coach-titration-violation",
      sessionSeed: "coach-titration-violation",
      selection: {
        workflowId: workflow.id,
        workflowHash: workflow.validation.canonicalSpecHash
      },
      workflow
    });
    runtime.dispatch(
      normalizeSetupDrivenTitrationAction({
        type: "read_meniscus",
        reportedML: 22
      })
    );
    for (let index = 0; index < 52; index += 1) {
      if (runtime.getGenericState().workflowStatus !== "in_progress") break;
      runtime.dispatch(
        normalizeSetupDrivenTitrationAction({
          type: "add_titrant",
          volumeML: 0.5,
          durationS: 0.1
        })
      );
    }
    const context = createAuthoredCoachWorkflowContext(
      runtime.getWorkflow(),
      runtime.getGenericState()
    );
    expect(context.evidence.at(-1)?.payload.flags).toContain(
      "endpoint_overshoot"
    );

    const response = await generateAuthoredCoachResponse(eventRequest(context));

    expect(response.shouldRespond).toBe(true);
    expect(response.guidance?.kind).toBe("mandatory_procedure");
    expect(response.guidance?.evidenceEventIds.length).toBeGreaterThan(0);
    expect(response.evidenceEventTypes).toContain("add_titrant");
    expect(response.metadata.definitionHash).toBe(TITRATION_V2_EXPECTED_HASH);
  });
});
