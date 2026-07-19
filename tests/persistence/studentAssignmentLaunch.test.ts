import { describe, expect, it } from "vitest";

import { validateStrictMigratedTitrationV2 } from "../../src/lab-workflows/definitions/titration";
import { TITRATION_V2_EXPECTED_HASH } from "../../src/lab-workflows/definitions/titration";
import {
  InMemoryLabAssignmentRepository,
  LabAssignmentService
} from "../../src/lib/persistence/labAssignmentRepository";
import {
  InMemoryLabDefinitionRepository,
  LabDefinitionPersistenceService
} from "../../src/lib/persistence/labDefinitionRepository";
import { resolveStudentAssignmentLaunch } from "../../src/lib/persistence/studentAssignmentLaunch";

const TEACHER_ID = "11111111-1111-4111-8111-111111111111";
const CLASS_ID = "22222222-2222-4222-8222-222222222222";
const NOW = "2026-07-19T03:00:00.000Z";

describe("resolveStudentAssignmentLaunch", () => {
  it("loads the exact pinned setup-driven definition for student entry", async () => {
    const definitions = new InMemoryLabDefinitionRepository();
    const definitionService = new LabDefinitionPersistenceService(definitions, {
      now: () => NOW
    });
    const draftId = crypto.randomUUID();
    const validated = validateStrictMigratedTitrationV2(NOW);
    await definitionService.saveDraft(TEACHER_ID, {
      idempotencyKey: crypto.randomUUID(),
      draftId,
      name: "Endpoint control",
      draft: structuredClone(validated)
    });
    const approved = await definitionService.approveDraft(TEACHER_ID, draftId, {
      idempotencyKey: crypto.randomUUID()
    });

    const assignments = new InMemoryLabAssignmentRepository(definitions);
    assignments.classTeachers.set(CLASS_ID, TEACHER_ID);
    const assignmentService = new LabAssignmentService(assignments, {
      now: () => NOW
    });
    const assignment = await assignmentService.createAssignment(TEACHER_ID, {
      idempotencyKey: crypto.randomUUID(),
      classId: CLASS_ID,
      versionId: approved.id,
      title: "Pinned endpoint control"
    });

    const launch = await resolveStudentAssignmentLaunch({
      assignmentId: assignment.id,
      assignments: assignmentService,
      definitions
    });

    expect(launch.kind).toBe("setup_driven_v2");
    if (launch.kind !== "setup_driven_v2") return;
    expect(launch.experimentId).toBe("acid_base_titration");
    expect(launch.resolution.versionId).toBe(approved.id);
    expect(launch.resolution.canonicalHash).toBe(TITRATION_V2_EXPECTED_HASH);
    expect(launch.resolution.spec.validation.canonicalSpecHash).toBe(
      TITRATION_V2_EXPECTED_HASH
    );
  });

  it("keeps null-pin legacy assignments on the static experiment path", async () => {
    const definitions = new InMemoryLabDefinitionRepository();
    const assignments = new InMemoryLabAssignmentRepository(definitions);
    const assignmentId = "66666666-6666-4666-8666-666666666666";
    assignments.assignments.set(assignmentId, {
      id: assignmentId,
      classId: CLASS_ID,
      experimentId: "acid_base_titration",
      experimentVersion: "1.0.0",
      title: "Legacy titration",
      dueAt: null,
      createdAt: NOW,
      labDefinitionVersionId: null,
      labDefinitionCanonicalHash: null,
      approvalRequestId: null,
      assignedBy: TEACHER_ID,
      assignedAt: NOW,
      assignIdempotencyKey: null
    });

    const launch = await resolveStudentAssignmentLaunch({
      assignmentId,
      assignments,
      definitions
    });

    expect(launch).toMatchObject({
      kind: "legacy_static",
      experimentId: "acid_base_titration",
      resolution: {
        kind: "legacy_static",
        experimentId: "acid_base_titration",
        experimentVersion: "1.0.0"
      }
    });
  });

  it("allows a class member to open the assignment", async () => {
    const definitions = new InMemoryLabDefinitionRepository();
    const assignments = new InMemoryLabAssignmentRepository(definitions);
    const assignmentId = "77777777-7777-4777-8777-777777777777";
    assignments.assignments.set(assignmentId, {
      id: assignmentId,
      classId: CLASS_ID,
      experimentId: "acid_base_titration",
      experimentVersion: "1.0.0",
      title: "Member titration",
      dueAt: null,
      createdAt: NOW,
      labDefinitionVersionId: null,
      labDefinitionCanonicalHash: null,
      approvalRequestId: null,
      assignedBy: TEACHER_ID,
      assignedAt: NOW,
      assignIdempotencyKey: null
    });

    const launch = await resolveStudentAssignmentLaunch({
      assignmentId,
      assignments,
      definitions,
      membership: {
        studentId: "33333333-3333-4333-8333-333333333333",
        assertClassMember: async (classId) => classId === CLASS_ID
      }
    });

    expect(launch.kind).toBe("legacy_static");
  });

  it("rejects a non-member before resolving the definition", async () => {
    const definitions = new InMemoryLabDefinitionRepository();
    const assignments = new InMemoryLabAssignmentRepository(definitions);
    const assignmentId = "88888888-8888-4888-8888-888888888888";
    assignments.assignments.set(assignmentId, {
      id: assignmentId,
      classId: CLASS_ID,
      experimentId: "acid_base_titration",
      experimentVersion: "1.0.0",
      title: "Forbidden titration",
      dueAt: null,
      createdAt: NOW,
      labDefinitionVersionId: null,
      labDefinitionCanonicalHash: null,
      approvalRequestId: null,
      assignedBy: TEACHER_ID,
      assignedAt: NOW,
      assignIdempotencyKey: null
    });

    await expect(
      resolveStudentAssignmentLaunch({
        assignmentId,
        assignments,
        definitions,
        membership: {
          studentId: "33333333-3333-4333-8333-333333333333",
          assertClassMember: async () => false
        }
      })
    ).rejects.toMatchObject({
      code: "assignment.forbidden.v1"
    });
  });

  it("opens pinned solution-preparation assignments on the native setup-driven path", async () => {
    const { validateSolutionPreparationV2 } = await import(
      "../../src/lab-workflows/definitions/solution-preparation"
    );
    const definitions = new InMemoryLabDefinitionRepository();
    const definitionService = new LabDefinitionPersistenceService(definitions, {
      now: () => NOW
    });
    const draftId = crypto.randomUUID();
    const validated = validateSolutionPreparationV2(NOW);
    await definitionService.saveDraft(TEACHER_ID, {
      idempotencyKey: crypto.randomUUID(),
      draftId,
      name: "NaCl dilution",
      draft: structuredClone(validated)
    });
    const approved = await definitionService.approveDraft(TEACHER_ID, draftId, {
      idempotencyKey: crypto.randomUUID()
    });

    const assignments = new InMemoryLabAssignmentRepository(definitions);
    assignments.classTeachers.set(CLASS_ID, TEACHER_ID);
    const assignmentService = new LabAssignmentService(assignments, {
      now: () => NOW
    });
    const assignment = await assignmentService.createAssignment(TEACHER_ID, {
      idempotencyKey: crypto.randomUUID(),
      classId: CLASS_ID,
      versionId: approved.id,
      title: "Pinned dilution"
    });

    const launch = await resolveStudentAssignmentLaunch({
      assignmentId: assignment.id,
      assignments: assignmentService,
      definitions,
      membership: {
        studentId: "33333333-3333-4333-8333-333333333333",
        assertClassMember: async () => true
      }
    });

    expect(launch.kind).toBe("setup_driven_native_v2");
    if (launch.kind !== "setup_driven_native_v2") return;
    expect(launch.experimentId).toBe("solution_preparation");
    expect(launch.resolution.versionId).toBe(approved.id);
  });
});
