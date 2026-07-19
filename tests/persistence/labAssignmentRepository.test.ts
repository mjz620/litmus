import { describe, expect, it } from "vitest";

import { SOLUTION_PREPARATION_V2_DRAFT } from "../../src/lab-workflows/definitions/solution-preparation";
import {
  InMemoryLabAssignmentRepository,
  LabAssignmentService
} from "../../src/lib/persistence/labAssignmentRepository";
import {
  InMemoryLabDefinitionRepository,
  LabDefinitionPersistenceService
} from "../../src/lib/persistence/labDefinitionRepository";
import { resolveSessionDefinition } from "../../src/lib/persistence/sessionDefinitionResolver";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TEACHER = "22222222-2222-4222-8222-222222222222";
const CLASS_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DRAFT_ID = "33333333-3333-4333-8333-333333333333";
const SAVE_KEY = "44444444-4444-4444-8444-444444444444";
const APPROVE_KEY = "66666666-6666-4666-8666-666666666666";
const ASSIGN_KEY = "77777777-7777-4777-8777-777777777777";
const NOW = "2026-07-19T17:00:00.000Z";

async function approveVersion() {
  const definitions = new InMemoryLabDefinitionRepository();
  const definitionService = new LabDefinitionPersistenceService(definitions, {
    now: () => NOW
  });
  await definitionService.saveDraft(OWNER_ID, {
    idempotencyKey: SAVE_KEY,
    draftId: DRAFT_ID,
    name: "Solution preparation",
    draft: SOLUTION_PREPARATION_V2_DRAFT
  });
  const version = await definitionService.approveDraft(OWNER_ID, DRAFT_ID, {
    idempotencyKey: APPROVE_KEY
  });
  const assignments = new InMemoryLabAssignmentRepository(definitions);
  assignments.classTeachers.set(CLASS_ID, OWNER_ID);
  const service = new LabAssignmentService(assignments, { now: () => NOW });
  return { definitions, assignments, service, version };
}

describe("LabAssignmentService", () => {
  it("creates an idempotent pinned assignment after assignment eligibility recheck", async () => {
    const { service, version, assignments } = await approveVersion();

    const created = await service.createAssignment(OWNER_ID, {
      idempotencyKey: ASSIGN_KEY,
      classId: CLASS_ID,
      versionId: version.id,
      title: "Week 1 solution prep"
    });
    const repeated = await service.createAssignment(OWNER_ID, {
      idempotencyKey: ASSIGN_KEY,
      classId: CLASS_ID,
      versionId: version.id,
      title: "Week 1 solution prep"
    });

    expect(repeated).toEqual(created);
    expect(assignments.assignments.size).toBe(1);
    expect(created).toMatchObject({
      classId: CLASS_ID,
      labDefinitionVersionId: version.id,
      labDefinitionCanonicalHash: version.canonicalHash,
      assignedBy: OWNER_ID,
      experimentId: "solution_preparation"
    });
  });

  it("rejects unauthorized teachers and missing versions", async () => {
    const { service, version } = await approveVersion();

    await expect(
      service.createAssignment(OTHER_TEACHER, {
        idempotencyKey: ASSIGN_KEY,
        classId: CLASS_ID,
        versionId: version.id,
        title: "Unauthorized"
      })
    ).rejects.toMatchObject({ code: "lab-assignment.unauthorized.v1" });

    await expect(
      service.createAssignment(OWNER_ID, {
        idempotencyKey: "88888888-8888-4888-8888-888888888888",
        classId: CLASS_ID,
        versionId: "99999999-9999-4999-8999-999999999999",
        title: "Missing"
      })
    ).rejects.toMatchObject({ code: "lab-assignment.not_found.v1" });
  });

  it("resolves pinned sessions from the immutable version and legacy rows without pins", async () => {
    const { definitions, service, version } = await approveVersion();
    const assignment = await service.createAssignment(OWNER_ID, {
      idempotencyKey: ASSIGN_KEY,
      classId: CLASS_ID,
      versionId: version.id,
      title: "Pinned lab"
    });

    const pinned = await resolveSessionDefinition({
      definitions,
      assignment
    });
    expect(pinned).toMatchObject({
      kind: "pinned_v2",
      versionId: version.id,
      canonicalHash: version.canonicalHash
    });

    const legacy = await resolveSessionDefinition({
      definitions,
      sessionPin: {
        labDefinitionVersionId: null,
        labDefinitionCanonicalHash: null,
        experimentId: "acid_base_titration",
        experimentVersion: "1.0.0"
      }
    });
    expect(legacy).toEqual({
      kind: "legacy_static",
      experimentId: "acid_base_titration",
      experimentVersion: "1.0.0"
    });
  });
});
