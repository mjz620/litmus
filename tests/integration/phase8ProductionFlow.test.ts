import { describe, expect, it } from "vitest";

import {
  SOLUTION_PREPARATION_V2_DRAFT,
  SOLUTION_PREPARATION_V2_EXPECTED_HASH,
  validateSolutionPreparationV2
} from "../../src/lab-workflows/definitions/solution-preparation";
import { validateStrictMigratedTitrationV2 } from "../../src/lab-workflows/definitions/titration";
import { evaluateLabWorkflowEligibilityV2 } from "../../src/lab-workflows/validation";
import {
  InMemoryLabAssignmentRepository,
  LabAssignmentService
} from "../../src/lib/persistence/labAssignmentRepository";
import {
  InMemoryLabDefinitionRepository,
  LabDefinitionPersistenceService
} from "../../src/lib/persistence/labDefinitionRepository";
import { resolveSessionDefinition } from "../../src/lib/persistence/sessionDefinitionResolver";
import { resolveLabSessionRuntimeMode } from "../../src/stores/setupDrivenLabSession";
import { createLabStore } from "../../src/stores/labStore";
import { STRICT_TITRATION_SETUP_SELECTION } from "../../src/stores/setupDrivenLabSession";
import { EXAMPLE_STRONG } from "../../src/experiments/titration/titration";
import { localCoachFallback } from "../../src/stores/labStore";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const CLASS_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = "2026-07-19T18:00:00.000Z";

async function approveAndAssign(draft: typeof SOLUTION_PREPARATION_V2_DRAFT) {
  const definitions = new InMemoryLabDefinitionRepository();
  const definitionService = new LabDefinitionPersistenceService(definitions, {
    now: () => NOW
  });
  const draftId = crypto.randomUUID();
  await definitionService.saveDraft(OWNER_ID, {
    idempotencyKey: crypto.randomUUID(),
    draftId,
    name: draft.metadata.title,
    draft
  });
  const version = await definitionService.approveDraft(OWNER_ID, draftId, {
    idempotencyKey: crypto.randomUUID()
  });
  const assignments = new InMemoryLabAssignmentRepository(definitions);
  assignments.classTeachers.set(CLASS_ID, OWNER_ID);
  const assignmentService = new LabAssignmentService(assignments, {
    now: () => NOW
  });
  const assignment = await assignmentService.createAssignment(OWNER_ID, {
    idempotencyKey: crypto.randomUUID(),
    classId: CLASS_ID,
    versionId: version.id,
    title: draft.metadata.title
  });
  return { definitions, version, assignment };
}

describe("LC2-802 production flow seams", () => {
  it("approves and assigns solution preparation, then resolves the exact pin", async () => {
    const validated = validateSolutionPreparationV2(NOW);
    expect(
      evaluateLabWorkflowEligibilityV2(validated, "assignment").eligible
    ).toBe(true);

    const { definitions, version, assignment } = await approveAndAssign(
      SOLUTION_PREPARATION_V2_DRAFT
    );
    expect(assignment.labDefinitionCanonicalHash).toBe(
      SOLUTION_PREPARATION_V2_EXPECTED_HASH
    );
    expect(assignment.labDefinitionVersionId).toBe(version.id);

    const resolved = await resolveSessionDefinition({
      definitions,
      assignment
    });
    expect(resolved).toMatchObject({
      kind: "pinned_v2",
      versionId: version.id,
      canonicalHash: version.canonicalHash
    });
    if (resolved.kind !== "pinned_v2") throw new Error("expected pin");
    expect(resolved.spec.validation.canonicalSpecHash).toBe(
      version.canonicalHash
    );
  });

  it("approves and assigns migrated titration with assignment eligibility", async () => {
    const titration = validateStrictMigratedTitrationV2(NOW);
    expect(
      evaluateLabWorkflowEligibilityV2(titration, "assignment").eligible
    ).toBe(true);
    expect(titration.validation.assignmentEligible).toBe(true);

    const definitions = new InMemoryLabDefinitionRepository();
    const definitionService = new LabDefinitionPersistenceService(definitions, {
      now: () => NOW
    });
    const draftId = crypto.randomUUID();
    await definitionService.saveDraft(OWNER_ID, {
      idempotencyKey: crypto.randomUUID(),
      draftId,
      name: titration.metadata.title,
      draft: titration
    });
    const version = await definitionService.approveDraft(OWNER_ID, draftId, {
      idempotencyKey: crypto.randomUUID()
    });
    const assignments = new InMemoryLabAssignmentRepository(definitions);
    assignments.classTeachers.set(CLASS_ID, OWNER_ID);
    const assignment = await new LabAssignmentService(assignments, {
      now: () => NOW
    }).createAssignment(OWNER_ID, {
      idempotencyKey: crypto.randomUUID(),
      classId: CLASS_ID,
      versionId: version.id,
      title: "Titration assignment"
    });
    expect(assignment.experimentId).toBe("acid_base_titration");
    expect(assignment.labDefinitionCanonicalHash).toBe(version.canonicalHash);
  });

  it("keeps stale edited drafts from changing an already pinned assignment", async () => {
    const { definitions, version, assignment } = await approveAndAssign(
      SOLUTION_PREPARATION_V2_DRAFT
    );
    const definitionService = new LabDefinitionPersistenceService(definitions, {
      now: () => "2026-07-19T18:05:00.000Z"
    });
    const edited = {
      ...structuredClone(SOLUTION_PREPARATION_V2_DRAFT),
      metadata: {
        ...SOLUTION_PREPARATION_V2_DRAFT.metadata,
        title: "Edited after assign"
      }
    };
    await definitionService.saveDraft(OWNER_ID, {
      idempotencyKey: crypto.randomUUID(),
      draftId: version.draftId,
      expectedStorageRevision: 1,
      name: "Edited after assign",
      draft: edited
    });

    const resolved = await resolveSessionDefinition({
      definitions,
      assignment
    });
    expect(resolved).toMatchObject({
      kind: "pinned_v2",
      canonicalHash: version.canonicalHash
    });
    if (resolved.kind !== "pinned_v2") throw new Error("expected pin");
    expect(resolved.spec.metadata.title).not.toBe("Edited after assign");
  });

  it("fails closed on hash mismatch and keeps legacy static sessions readable", async () => {
    const { definitions, assignment } = await approveAndAssign(
      SOLUTION_PREPARATION_V2_DRAFT
    );
    await expect(
      resolveSessionDefinition({
        definitions,
        assignment: {
          ...assignment,
          labDefinitionCanonicalHash:
            "sha256:0000000000000000000000000000000000000000000000000000000000000000"
        }
      })
    ).rejects.toMatchObject({
      code: "session-definition.hash_mismatch.v1"
    });

    await expect(
      resolveSessionDefinition({
        definitions,
        sessionPin: {
          labDefinitionVersionId: null,
          labDefinitionCanonicalHash: null,
          experimentId: "acid_base_titration",
          experimentVersion: "1.0.0"
        }
      })
    ).resolves.toEqual({
      kind: "legacy_static",
      experimentId: "acid_base_titration",
      experimentVersion: "1.0.0"
    });
  });

  it("defaults student titration to setup-driven and keeps coach offline fallback usable", async () => {
    expect(resolveLabSessionRuntimeMode("acid_base_titration", undefined)).toBe(
      "setup_driven_v2"
    );
    const store = createLabStore({
      coachClient: {
        async request() {
          throw new Error("Coach offline");
        }
      }
    });
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "802-setup-default",
      config: EXAMPLE_STRONG,
      runtimeMode: "setup_driven_v2",
      setupDrivenSelection: STRICT_TITRATION_SETUP_SELECTION
    });
    await store.getState().askCoach("What should I do first?");
    expect(store.getState().coachMessages.at(-1)?.text).toContain(
      "next available lab step"
    );
    expect(localCoachFallback("question").shouldRespond).toBe(true);
    expect(store.getState().status).toBe("ready");
  });
});
