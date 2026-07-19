import { describe, expect, it } from "vitest";

import {
  LAB_DRAFT_COMMAND_ERROR_CODES,
  applyLabDraftCommand,
  applyLabDraftTransaction,
  inspectLabDraftRemoval,
  type LabDraftRemovalImpact,
  type LabDraftRemovalResolution
} from "../../../src/lab-workflows/authoring";
import {
  NATIVE_TITRATION_V2_DRAFT,
  validateNativeTitrationV2
} from "../../../src/lab-workflows/definitions/titration/native-endpoint-control";
import { hashLabWorkflowSpec } from "../../../src/lab-workflows/hash";
import { labWorkflowDraftV2Schema } from "../../../src/lab-workflows/schema/v2";

function impactFor(
  draft: unknown,
  target: LabDraftRemovalImpact["target"]
): Readonly<LabDraftRemovalImpact> {
  const result = inspectLabDraftRemoval(draft, target);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.impact;
}

function applyImpact(
  draft: typeof NATIVE_TITRATION_V2_DRAFT,
  impact: Readonly<LabDraftRemovalImpact>,
  resolution: LabDraftRemovalResolution,
  confirmations = { compatibility: true, dependents: true }
) {
  return applyLabDraftCommand(draft, {
    type: "apply_removal",
    plan: {
      sourceRevision: impact.sourceRevision,
      sourceDraftHash: impact.sourceDraftHash,
      target: impact.target
    },
    resolution,
    confirmCompatibilityEffects: confirmations.compatibility,
    confirmDependentContentRemoval: confirmations.dependents
  });
}

describe("Lab Composer atomic transactions", () => {
  it("applies all commands once with one revision and one authority invalidation", () => {
    const validated = validateNativeTitrationV2("2026-07-18T12:00:00.000Z");
    const before = structuredClone(validated);
    const result = applyLabDraftTransaction(
      validated,
      [
        {
          type: "update_metadata",
          metadata: {
            ...validated.metadata,
            title: "Atomic endpoint practice"
          }
        },
        { type: "add_objective", objectiveId: "significant_figures" }
      ],
      validated.revision
    );

    expect(result).toMatchObject({
      ok: true,
      draft: {
        revision: validated.revision + 1,
        supportStatus: "draft_unvalidated",
        validation: null,
        judgeCritique: null,
        metadata: { title: "Atomic endpoint practice" }
      },
      edit: {
        commandTypes: ["update_metadata", "add_objective"],
        commandCount: 2,
        revisionBefore: validated.revision,
        revisionAfter: validated.revision + 1,
        validationInvalidated: true,
        judgeCritiqueInvalidated: true
      }
    });
    expect(result.ok && result.draft.objectiveIds).toContain(
      "significant_figures"
    );
    expect(validated).toEqual(before);
    expect(result.ok && Object.isFrozen(result.draft.rules)).toBe(true);
  });

  it("rolls back atomically and reports the failing command index", () => {
    const before = structuredClone(NATIVE_TITRATION_V2_DRAFT);
    const result = applyLabDraftTransaction(
      NATIVE_TITRATION_V2_DRAFT,
      [
        {
          type: "update_metadata",
          metadata: {
            ...NATIVE_TITRATION_V2_DRAFT.metadata,
            title: "This must roll back"
          }
        },
        { type: "add_objective", objectiveId: "endpoint_control" }
      ],
      NATIVE_TITRATION_V2_DRAFT.revision
    );

    expect(result).toMatchObject({
      ok: false,
      failingCommandIndex: 1,
      error: { code: LAB_DRAFT_COMMAND_ERROR_CODES.duplicateId }
    });
    expect(NATIVE_TITRATION_V2_DRAFT).toEqual(before);
  });

  it("rejects stale expected revisions before applying commands", () => {
    const result = applyLabDraftTransaction(
      NATIVE_TITRATION_V2_DRAFT,
      [{ type: "add_objective", objectiveId: "significant_figures" }],
      NATIVE_TITRATION_V2_DRAFT.revision - 1
    );
    expect(result).toMatchObject({
      ok: false,
      failingCommandIndex: null,
      error: { code: LAB_DRAFT_COMMAND_ERROR_CODES.revisionConflict }
    });
  });
});

describe("Lab Composer dependency-aware removals", () => {
  it("reassigns every objective reference without caller-authored paths", () => {
    const impact = impactFor(NATIVE_TITRATION_V2_DRAFT, {
      kind: "objective",
      objectiveId: "meniscus_reading"
    });
    expect(impact.sourceDraftHash).toBe(
      hashLabWorkflowSpec(NATIVE_TITRATION_V2_DRAFT)
    );
    expect(impact.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "workflow_rule" }),
        expect.objectContaining({ kind: "rubric_criterion", id: "meniscus" })
      ])
    );
    expect(impact.allowedResolutions).toContain("reassign");

    const result = applyImpact(NATIVE_TITRATION_V2_DRAFT, impact, {
      kind: "reassign",
      replacementObjectiveId: "endpoint_control"
    });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.draft.objectiveIds).toEqual(["endpoint_control"]);
    expect(
      result.draft.rules.every(
        (rule) =>
          !rule.objectiveIds.includes("meniscus_reading") &&
          rule.objectiveIds.length > 0
      )
    ).toBe(true);
    expect(
      result.draft.rubric.criteria.every(
        (criterion) =>
          !criterion.objectiveIds.includes("meniscus_reading") &&
          criterion.objectiveIds.length > 0
      )
    ).toBe(true);
    expect(labWorkflowDraftV2Schema.safeParse(result.draft).success).toBe(true);
  });

  it("removes objective-dependent content through an explicit destructive resolution", () => {
    const impact = impactFor(NATIVE_TITRATION_V2_DRAFT, {
      kind: "objective",
      objectiveId: "meniscus_reading"
    });
    const unconfirmed = applyImpact(
      NATIVE_TITRATION_V2_DRAFT,
      impact,
      { kind: "remove_dependents" },
      { compatibility: false, dependents: false }
    );
    expect(unconfirmed).toMatchObject({
      ok: false,
      error: {
        code: LAB_DRAFT_COMMAND_ERROR_CODES.removalConfirmationRequired
      }
    });

    const result = applyImpact(NATIVE_TITRATION_V2_DRAFT, impact, {
      kind: "remove_dependents"
    });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.draft.objectiveIds).not.toContain("meniscus_reading");
    expect(
      result.draft.rules.some(({ id }) => id === "migration.rule.s1.o1")
    ).toBe(false);
    expect(
      result.draft.rubric.criteria.some(({ id }) => id === "meniscus")
    ).toBe(false);
    expect(labWorkflowDraftV2Schema.safeParse(result.draft).success).toBe(true);
  });

  it("removes optional equipment directly and compatibility equipment only after confirmation", () => {
    const added = applyLabDraftCommand(NATIVE_TITRATION_V2_DRAFT, {
      type: "add_equipment",
      equipment: {
        instanceId: "optional_source",
        equipmentDefinitionId: "component.reagent_bottle.v1",
        configurationPresetId:
          "component_config.reagent_bottle.titrant_source.v1",
        label: "Optional source",
        required: false
      }
    });
    if (!added.ok) throw new Error(JSON.stringify(added.error));
    const optionalImpact = impactFor(added.draft, {
      kind: "equipment",
      instanceId: "optional_source"
    });
    expect(optionalImpact.allowedResolutions).toContain("remove_only");
    const optionalRemoved = applyImpact(
      added.draft,
      optionalImpact,
      { kind: "remove_only" },
      { compatibility: false, dependents: false }
    );
    expect(optionalRemoved).toMatchObject({ ok: true });

    const coreImpact = impactFor(NATIVE_TITRATION_V2_DRAFT, {
      kind: "equipment",
      instanceId: "titrant_burette"
    });
    expect(coreImpact.compatibilityEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "equipment_role_removed" }),
        expect.objectContaining({ kind: "runtime_compatibility_incomplete" })
      ])
    );
    const notConfirmed = applyImpact(
      NATIVE_TITRATION_V2_DRAFT,
      coreImpact,
      { kind: "cascade" },
      { compatibility: false, dependents: true }
    );
    expect(notConfirmed).toMatchObject({
      ok: false,
      error: {
        code: LAB_DRAFT_COMMAND_ERROR_CODES.removalConfirmationRequired
      }
    });
    const removed = applyImpact(NATIVE_TITRATION_V2_DRAFT, coreImpact, {
      kind: "cascade"
    });
    if (!removed.ok) throw new Error(JSON.stringify(removed.error));
    expect(removed.draft.equipment).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ instanceId: "titrant_burette" })
      ])
    );
    expect(removed.draft).toMatchObject({
      supportStatus: "draft_unvalidated",
      validation: null,
      judgeCritique: null
    });
    expect(labWorkflowDraftV2Schema.safeParse(removed.draft).success).toBe(
      true
    );
  });

  it("cleans exact rule dependencies while strict direct removal still rejects them", () => {
    const direct = applyLabDraftCommand(NATIVE_TITRATION_V2_DRAFT, {
      type: "remove_rule",
      ruleId: "migration.rule.s1.completion"
    });
    expect(direct).toMatchObject({
      ok: false,
      error: { code: LAB_DRAFT_COMMAND_ERROR_CODES.dependencyExists }
    });

    const impact = impactFor(NATIVE_TITRATION_V2_DRAFT, {
      kind: "rule",
      ruleId: "migration.rule.s1.completion"
    });
    const result = applyImpact(NATIVE_TITRATION_V2_DRAFT, impact, {
      kind: "cascade"
    });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(
      result.draft.rules.some(({ id }) => id === "migration.rule.s1.completion")
    ).toBe(false);
    expect(
      result.draft.rules.some(
        ({ condition }) =>
          condition.kind === "rule_satisfied_before" &&
          (condition.predecessorRuleId === "migration.rule.s1.completion" ||
            condition.successorRuleId === "migration.rule.s1.completion")
      )
    ).toBe(false);
    expect(
      result.draft.permittedActions.every(
        ({ availability }) =>
          !availability.allSatisfiedRuleIds.includes(
            "migration.rule.s1.completion"
          ) &&
          !availability.allUnsatisfiedRuleIds.includes(
            "migration.rule.s1.completion"
          )
      )
    ).toBe(true);
  });

  it("cascades registered material, action, instruction, and criterion dependencies", () => {
    const material = NATIVE_TITRATION_V2_DRAFT.materials[0]!;
    const materialImpact = impactFor(NATIVE_TITRATION_V2_DRAFT, {
      kind: "material",
      instanceId: material.instanceId
    });
    const materialRemoved = applyImpact(
      NATIVE_TITRATION_V2_DRAFT,
      materialImpact,
      { kind: "cascade" }
    );
    if (!materialRemoved.ok)
      throw new Error(JSON.stringify(materialRemoved.error));
    expect(
      materialRemoved.draft.materials.some(
        ({ instanceId }) => instanceId === material.instanceId
      )
    ).toBe(false);
    expect(
      materialRemoved.draft.safetyBindings.every(
        ({ materialInstanceIds }) =>
          !materialInstanceIds.includes(material.instanceId)
      )
    ).toBe(true);
    expect(
      materialRemoved.draft.compatibility?.materialRoleBindings.every(
        ({ materialInstanceId }) => materialInstanceId !== material.instanceId
      )
    ).toBe(true);

    const permission = NATIVE_TITRATION_V2_DRAFT.permittedActions[0]!;
    const actionRuleId = "test.rule.permission_dependency";
    const withActionRule = applyLabDraftCommand(NATIVE_TITRATION_V2_DRAFT, {
      type: "add_rule",
      rule: {
        id: actionRuleId,
        kind: "required",
        condition: {
          kind: "action_observed",
          actionId: permission.actionId,
          ...(permission.sourceEquipmentInstanceId
            ? {
                sourceEquipmentInstanceId: permission.sourceEquipmentInstanceId
              }
            : {}),
          targetEquipmentInstanceIds: permission.targetEquipmentInstanceIds
        },
        severity: "procedural",
        recoverable: true,
        terminal: false,
        objectiveIds: [NATIVE_TITRATION_V2_DRAFT.objectiveIds[0]!]
      }
    });
    if (!withActionRule.ok)
      throw new Error(JSON.stringify(withActionRule.error));
    const actionImpact = impactFor(withActionRule.draft, {
      kind: "permitted_action",
      permissionId: permission.id
    });
    const actionRemoved = applyImpact(withActionRule.draft, actionImpact, {
      kind: "cascade"
    });
    if (!actionRemoved.ok) throw new Error(JSON.stringify(actionRemoved.error));
    expect(
      actionRemoved.draft.permittedActions.some(
        ({ id }) => id === permission.id
      )
    ).toBe(false);
    expect(
      actionRemoved.draft.rules.some(({ id }) => id === actionRuleId)
    ).toBe(false);

    const instruction = NATIVE_TITRATION_V2_DRAFT.instructions[0]!;
    const instructionImpact = impactFor(NATIVE_TITRATION_V2_DRAFT, {
      kind: "instruction",
      instructionId: instruction.id
    });
    const instructionRemoved = applyImpact(
      NATIVE_TITRATION_V2_DRAFT,
      instructionImpact,
      instructionImpact.allowedResolutions.includes("cascade")
        ? { kind: "cascade" }
        : { kind: "remove_only" }
    );
    if (!instructionRemoved.ok)
      throw new Error(JSON.stringify(instructionRemoved.error));
    expect(
      instructionRemoved.draft.instructions.some(
        ({ id }) => id === instruction.id
      )
    ).toBe(false);
    expect(
      instructionRemoved.draft.presentation.instructionGuidance.some(
        ({ instructionId }) => instructionId === instruction.id
      )
    ).toBe(false);

    const criterion = NATIVE_TITRATION_V2_DRAFT.rubric.criteria[0]!;
    const criterionImpact = impactFor(NATIVE_TITRATION_V2_DRAFT, {
      kind: "rubric_criterion",
      criterionId: criterion.id
    });
    const criterionRemoved = applyImpact(
      NATIVE_TITRATION_V2_DRAFT,
      criterionImpact,
      { kind: "remove_only" }
    );
    if (!criterionRemoved.ok)
      throw new Error(JSON.stringify(criterionRemoved.error));
    expect(criterionRemoved.draft.rubric.totalPoints).toBe(
      NATIVE_TITRATION_V2_DRAFT.rubric.totalPoints - criterion.maxPoints
    );
  });

  it("rejects a stale hash-pinned removal plan after any edit", () => {
    const impact = impactFor(NATIVE_TITRATION_V2_DRAFT, {
      kind: "rubric_criterion",
      criterionId: "meniscus"
    });
    const edited = applyLabDraftCommand(NATIVE_TITRATION_V2_DRAFT, {
      type: "update_metadata",
      metadata: {
        ...NATIVE_TITRATION_V2_DRAFT.metadata,
        title: "A newer draft"
      }
    });
    if (!edited.ok) throw new Error(JSON.stringify(edited.error));
    const result = applyImpact(edited.draft, impact, { kind: "remove_only" });
    expect(result).toMatchObject({
      ok: false,
      error: { code: LAB_DRAFT_COMMAND_ERROR_CODES.removalPlanStale }
    });
  });

  it("supports strict metadata and replacement commands", () => {
    const rule = NATIVE_TITRATION_V2_DRAFT.rules[0]!;
    const instruction = NATIVE_TITRATION_V2_DRAFT.instructions[0]!;
    const criterion = NATIVE_TITRATION_V2_DRAFT.rubric.criteria[0]!;
    const result = applyLabDraftTransaction(
      NATIVE_TITRATION_V2_DRAFT,
      [
        {
          type: "replace_rule",
          ruleId: rule.id,
          rule: { ...rule, severity: "info" }
        },
        {
          type: "replace_instruction",
          instructionId: instruction.id,
          instruction: { ...instruction, title: "Read the exact meniscus" }
        },
        {
          type: "replace_rubric_criterion",
          criterionId: criterion.id,
          criterion: { ...criterion, maxPoints: criterion.maxPoints + 1 }
        }
      ],
      NATIVE_TITRATION_V2_DRAFT.revision
    );
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.draft.revision).toBe(NATIVE_TITRATION_V2_DRAFT.revision + 1);
    expect(result.draft.rules[0]?.severity).toBe("info");
    expect(result.draft.instructions[0]?.title).toBe("Read the exact meniscus");
    expect(result.draft.rubric.totalPoints).toBe(
      NATIVE_TITRATION_V2_DRAFT.rubric.totalPoints + 1
    );
  });
});
