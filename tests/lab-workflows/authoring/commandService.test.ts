import { describe, expect, it } from "vitest";

import {
  LAB_DRAFT_COMMAND_ERROR_CODES,
  applyLabDraftCommand,
  deserializeLabDraft,
  serializeLabDraft,
  type LabDraftCommand
} from "../../../src/lab-workflows/authoring";
import { NATIVE_TITRATION_V2_DRAFT } from "../../../src/lab-workflows/definitions/titration/native-endpoint-control";
import type { LabWorkflowDraftV2 } from "../../../src/lab-workflows/schema/v2";
import { validateLabWorkflowSpecV2 } from "../../../src/lab-workflows/validation";

function apply(
  draft: Readonly<LabWorkflowDraftV2>,
  command: LabDraftCommand
): Readonly<LabWorkflowDraftV2> {
  const result = applyLabDraftCommand(draft, command);
  if (!result.ok)
    throw new Error(`${command.type}: ${JSON.stringify(result.error)}`);
  expect(result).toMatchObject({
    ok: true,
    draft: {
      supportStatus: "draft_unvalidated",
      validation: null,
      judgeCritique: null
    },
    edit: {
      commandType: command.type,
      revisionBefore: draft.revision,
      revisionAfter: draft.revision + 1,
      validationInvalidated: true,
      judgeCritiqueInvalidated: true
    }
  });
  return result.draft;
}

function skeleton(): LabWorkflowDraftV2 {
  const draft = structuredClone(NATIVE_TITRATION_V2_DRAFT);
  return {
    ...draft,
    objectiveIds: [],
    equipment: [],
    materials: [],
    layout: { ...draft.layout, placements: [] },
    permittedActions: [],
    rules: [],
    instructions: [],
    rubric: { ...draft.rubric, criteria: [], totalPoints: 0 }
  };
}

describe("Lab Composer draft command service", () => {
  it("constructs the native titration setup, constraints, and rubric deterministically", () => {
    const source = NATIVE_TITRATION_V2_DRAFT;
    const commands: LabDraftCommand[] = [
      ...source.objectiveIds.map(
        (objectiveId): LabDraftCommand => ({
          type: "add_objective",
          objectiveId
        })
      ),
      ...source.equipment.map(
        (equipment): LabDraftCommand => ({ type: "add_equipment", equipment })
      ),
      ...source.materials.map(
        (binding): LabDraftCommand => ({ type: "bind_material", binding })
      ),
      { type: "set_layout", layout: source.layout },
      ...source.rules.map(
        (rule): LabDraftCommand => ({ type: "add_rule", rule })
      ),
      ...source.permittedActions.map(
        (action): LabDraftCommand => ({ type: "permit_action", action })
      ),
      ...source.instructions.map(
        (instruction): LabDraftCommand => ({
          type: "add_instruction",
          instruction
        })
      ),
      ...source.rubric.criteria.map(
        (criterion): LabDraftCommand => ({
          type: "add_rubric_criterion",
          criterion
        })
      )
    ];
    const initial = skeleton();
    const first = commands.reduce(apply, initial);
    const second = commands.reduce(apply, skeleton());

    expect(first).toEqual(second);
    expect(first).toEqual({
      ...source,
      revision: initial.revision + commands.length
    });
    const validation = validateLabWorkflowSpecV2(first, {
      checkedAt: "2026-07-18T06:00:00.000Z"
    });
    expect(validation.schemaValid).toBe(true);
    expect(validation.validation).toMatchObject({
      status: "runnable",
      runnable: true
    });
  });

  it("supports configuration, condition, ordering, instruction, rubric, and explicit removals", () => {
    let draft: Readonly<LabWorkflowDraftV2> = NATIVE_TITRATION_V2_DRAFT;
    draft = apply(draft, {
      type: "add_equipment",
      equipment: {
        instanceId: "wash_source",
        equipmentDefinitionId: "component.reagent_bottle.v1",
        configurationPresetId:
          "component_config.reagent_bottle.titrant_source.v1",
        label: "Wash source",
        required: false
      }
    });
    draft = apply(draft, {
      type: "configure_equipment",
      instanceId: "wash_source",
      configurationPresetId: "component_config.reagent_bottle.titrant_source.v1"
    });
    draft = apply(draft, {
      type: "add_equipment",
      equipment: {
        instanceId: "temporary_source",
        equipmentDefinitionId: "component.reagent_bottle.v1",
        configurationPresetId:
          "component_config.reagent_bottle.titrant_source.v1",
        label: "Temporary source",
        required: false
      }
    });
    draft = apply(draft, {
      type: "remove_equipment",
      instanceId: "temporary_source"
    });
    draft = apply(draft, {
      type: "bind_material",
      binding: {
        instanceId: "wash_water",
        materialProfileId: "reagent.distilled_water.v1",
        containerInstanceId: "wash_source",
        quantityPresetId: "quantity-preset.distilled_water_50ml.v1"
      }
    });
    draft = apply(draft, {
      type: "permit_action",
      action: {
        id: "permission.rinse",
        actionId: "action.rinse.v1",
        sourceEquipmentInstanceId: "wash_source",
        targetEquipmentInstanceIds: ["titrant_burette"],
        availability: { allSatisfiedRuleIds: [], allUnsatisfiedRuleIds: [] }
      }
    });
    draft = apply(draft, {
      type: "add_rule",
      rule: {
        id: "rule.extra.observation",
        kind: "best_practice",
        condition: {
          kind: "semantic_event_observed",
          eventTypeId: "event.read_meniscus.v1"
        },
        severity: "best-practice",
        recoverable: true,
        terminal: false,
        objectiveIds: ["meniscus_reading"]
      }
    });
    draft = apply(draft, {
      type: "add_condition",
      ruleId: "rule.extra.observation",
      condition: {
        kind: "action_observed",
        actionId: "action.read_volume.v1",
        sourceEquipmentInstanceId: "titrant_burette",
        targetEquipmentInstanceIds: []
      }
    });
    draft = apply(draft, {
      type: "add_ordering_dependency",
      ruleId: "rule.extra.ordering",
      predecessorRuleId: "migration.rule.s1.completion",
      successorRuleId: "migration.rule.s2.completion",
      severity: "procedural",
      recoverable: true,
      objectiveIds: ["endpoint_control"]
    });
    draft = apply(draft, {
      type: "remove_ordering_dependency",
      ruleId: "rule.extra.ordering"
    });
    draft = apply(draft, {
      type: "add_instruction",
      instruction: {
        id: "instruction.extra",
        title: "Record evidence",
        guidance: "Record the visible meniscus evidence.",
        relatedRuleIds: ["rule.extra.observation"]
      }
    });
    draft = apply(draft, {
      type: "remove_instruction",
      instructionId: "instruction.extra"
    });
    draft = apply(draft, {
      type: "add_rubric_criterion",
      criterion: {
        id: "criterion.extra",
        objectiveIds: ["meniscus_reading"],
        ruleIds: ["rule.extra.observation"],
        description: "Records additional meniscus evidence.",
        maxPoints: 1,
        assessmentModeId: "assessment.event_plus_entry.v1",
        evidenceMappings: [
          {
            kind: "semantic_event",
            eventTypeId: "event.read_meniscus.v1",
            required: true
          }
        ],
        scoringGuide: ["0: missing", "1: recorded"]
      }
    });
    draft = apply(draft, {
      type: "remove_rubric_criterion",
      criterionId: "criterion.extra"
    });
    draft = apply(draft, {
      type: "remove_condition",
      ruleId: "rule.extra.observation"
    });
    draft = apply(draft, {
      type: "add_rule",
      rule: {
        id: "rule.direct.remove",
        kind: "best_practice",
        condition: {
          kind: "semantic_event_observed",
          eventTypeId: "event.read_meniscus.v1"
        },
        severity: "best-practice",
        recoverable: true,
        terminal: false,
        objectiveIds: ["meniscus_reading"]
      }
    });
    draft = apply(draft, {
      type: "remove_rule",
      ruleId: "rule.direct.remove"
    });
    draft = apply(draft, {
      type: "add_objective",
      objectiveId: "significant_figures"
    });
    draft = apply(draft, {
      type: "remove_objective",
      objectiveId: "significant_figures"
    });

    expect(draft.rubric.totalPoints).toBe(
      NATIVE_TITRATION_V2_DRAFT.rubric.totalPoints
    );
    expect(draft.rules).not.toContainEqual(
      expect.objectContaining({ id: "rule.extra.observation" })
    );
    expect(draft.permittedActions).toContainEqual(
      expect.objectContaining({ id: "permission.rinse" })
    );
  });

  it("invalidates current validation and Judge artifacts without mutating input", () => {
    const validation = validateLabWorkflowSpecV2(NATIVE_TITRATION_V2_DRAFT, {
      checkedAt: "2026-07-18T06:00:00.000Z"
    });
    if (!validation.schemaValid) throw new Error("Expected valid fixture");
    const validatedHash = validation.spec.validation.canonicalSpecHash;
    const validated = {
      ...structuredClone(validation.spec),
      judgeCritique: {
        critiqueVersion: "1.0.0",
        specHash: validatedHash,
        scores: Object.fromEntries(
          [
            "skill_alignment",
            "pedagogical_quality",
            "student_clarity",
            "rubric_alignment",
            "coach_trigger_relevance",
            "safety_appropriateness",
            "teacher_usability",
            "under_resourced_school_suitability"
          ].map((dimension) => [
            dimension,
            { score: 4 as const, rationale: "Deterministic test critique." }
          ])
        ),
        issues: [],
        strengths: ["Flexible workflow."],
        summary: "The workflow is suitable for deterministic testing.",
        recommendation: "approve" as const
      }
    };
    const before = structuredClone(validated);
    const result = applyLabDraftCommand(validated, {
      type: "add_objective",
      objectiveId: "significant_figures"
    });
    if (!result.ok) throw new Error(JSON.stringify(result.error));

    expect(result).toMatchObject({
      ok: true,
      draft: {
        revision: validated.revision + 1,
        supportStatus: "draft_unvalidated",
        validation: null,
        judgeCritique: null
      },
      edit: {
        commandType: "add_objective",
        revisionBefore: validated.revision,
        revisionAfter: validated.revision + 1,
        validationInvalidated: true,
        judgeCritiqueInvalidated: true
      }
    });
    expect(validated).toEqual(before);
  });

  it("returns stable exact-ID, compatibility, duplicate, dependency, cycle, and bounds errors", () => {
    const unknown = applyLabDraftCommand(NATIVE_TITRATION_V2_DRAFT, {
      type: "add_equipment",
      equipment: {
        instanceId: "mystery",
        equipmentDefinitionId: "component.unknown.v1",
        configurationPresetId: "component_config.burette.50ml.v1",
        label: "Mystery",
        required: true
      }
    });
    expect(unknown).toMatchObject({
      ok: false,
      error: {
        code: LAB_DRAFT_COMMAND_ERROR_CODES.registryUnknown,
        path: "command.equipment.equipmentDefinitionId"
      }
    });

    const incompatible = applyLabDraftCommand(NATIVE_TITRATION_V2_DRAFT, {
      type: "permit_action",
      action: {
        id: "permission.bad_read",
        actionId: "action.read_volume.v1",
        sourceEquipmentInstanceId: "analyte_flask",
        targetEquipmentInstanceIds: [],
        availability: { allSatisfiedRuleIds: [], allUnsatisfiedRuleIds: [] }
      }
    });
    expect(incompatible).toMatchObject({
      ok: false,
      error: { code: LAB_DRAFT_COMMAND_ERROR_CODES.incompatible }
    });

    const duplicate = applyLabDraftCommand(NATIVE_TITRATION_V2_DRAFT, {
      type: "add_objective",
      objectiveId: "endpoint_control"
    });
    expect(duplicate).toMatchObject({
      ok: false,
      error: { code: LAB_DRAFT_COMMAND_ERROR_CODES.duplicateId }
    });

    const dependency = applyLabDraftCommand(NATIVE_TITRATION_V2_DRAFT, {
      type: "remove_equipment",
      instanceId: "titrant_burette"
    });
    expect(dependency).toMatchObject({
      ok: false,
      error: {
        code: LAB_DRAFT_COMMAND_ERROR_CODES.dependencyExists,
        dependencyPaths: expect.arrayContaining([
          "layout.placements[0].equipmentInstanceId",
          "materials[0].containerInstanceId"
        ])
      }
    });

    const cycle = applyLabDraftCommand(NATIVE_TITRATION_V2_DRAFT, {
      type: "add_ordering_dependency",
      ruleId: "rule.self_cycle",
      predecessorRuleId: "migration.rule.s1.completion",
      successorRuleId: "migration.rule.s1.completion",
      severity: "procedural",
      recoverable: true,
      objectiveIds: ["endpoint_control"]
    });
    expect(cycle).toMatchObject({
      ok: false,
      error: { code: LAB_DRAFT_COMMAND_ERROR_CODES.orderingCycle }
    });

    const atLimit = {
      ...NATIVE_TITRATION_V2_DRAFT,
      revision: 1_000_000
    };
    const bounds = applyLabDraftCommand(atLimit, {
      type: "add_objective",
      objectiveId: "significant_figures"
    });
    expect(bounds).toMatchObject({
      ok: false,
      error: { code: LAB_DRAFT_COMMAND_ERROR_CODES.boundsExceeded }
    });
  });

  it("parses commands strictly and round-trips only strict local draft envelopes", () => {
    const invalid = applyLabDraftCommand(NATIVE_TITRATION_V2_DRAFT, {
      type: "add_objective",
      objectiveId: "significant_figures",
      invented: true
    });
    expect(invalid).toMatchObject({
      ok: false,
      error: { code: LAB_DRAFT_COMMAND_ERROR_CODES.commandInvalid }
    });

    const edited = apply(NATIVE_TITRATION_V2_DRAFT, {
      type: "add_objective",
      objectiveId: "significant_figures"
    });
    const serialized = serializeLabDraft(edited);
    expect(deserializeLabDraft(serialized)).toEqual(edited);
    expect(() =>
      deserializeLabDraft(
        JSON.stringify({ schemaVersion: "1.0.0", draft: edited, extra: true })
      )
    ).toThrow("envelope is invalid");
    expect(Object.isFrozen(deserializeLabDraft(serialized).rules)).toBe(true);
  });
});
