import { describe, expect, it } from "vitest";

import {
  SOLUTION_PREPARATION_V2_DRAFT,
  SOLUTION_PREPARATION_V2_EXPECTED_HASH,
  validateSolutionPreparationV2
} from "../../src/lab-workflows/definitions/solution-preparation";
import { hashLabWorkflowSpec } from "../../src/lab-workflows/hash";
import {
  InMemoryLabDefinitionRepository,
  LabDefinitionPersistenceService
} from "../../src/lib/persistence/labDefinitionRepository";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_OWNER_ID = "22222222-2222-4222-8222-222222222222";
const DRAFT_ID = "33333333-3333-4333-8333-333333333333";
const SAVE_REQUEST_ID = "44444444-4444-4444-8444-444444444444";
const UPDATE_REQUEST_ID = "55555555-5555-4555-8555-555555555555";
const APPROVE_REQUEST_ID = "66666666-6666-4666-8666-666666666666";
const NOW = "2026-07-19T16:00:00.000Z";

function createHarness() {
  const repository = new InMemoryLabDefinitionRepository();
  const service = new LabDefinitionPersistenceService(repository, {
    now: () => NOW
  });
  return { repository, service };
}

async function saveRunnableDraft(
  service: LabDefinitionPersistenceService,
  requestId = SAVE_REQUEST_ID
) {
  return service.saveDraft(OWNER_ID, {
    idempotencyKey: requestId,
    draftId: DRAFT_ID,
    name: "Sodium chloride preparation",
    draft: SOLUTION_PREPARATION_V2_DRAFT
  });
}

function expectPersistenceError(code: string) {
  return expect.objectContaining({ code });
}

describe("LabDefinitionPersistenceService", () => {
  it("strictly parses mutable drafts and invalidates caller-supplied validation authority", async () => {
    const { repository, service } = createHarness();
    const validated = validateSolutionPreparationV2(NOW);
    const before = structuredClone(validated);

    const saved = await service.saveDraft(OWNER_ID, {
      idempotencyKey: SAVE_REQUEST_ID,
      draftId: DRAFT_ID,
      name: "Validated input must become a draft",
      draft: validated
    });

    expect(saved).toMatchObject({
      id: DRAFT_ID,
      ownerId: OWNER_ID,
      name: "Validated input must become a draft",
      storageRevision: 1,
      draft: {
        supportStatus: "draft_unvalidated",
        validation: null,
        judgeCritique: null
      }
    });
    expect(validated).toEqual(before);
    expect(repository.drafts.size).toBe(1);

    const listed = await service.listDrafts(OWNER_ID);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toEqual(saved);

    await expect(
      service.saveDraft(OWNER_ID, {
        idempotencyKey: UPDATE_REQUEST_ID,
        draftId: DRAFT_ID,
        expectedStorageRevision: saved.storageRevision,
        name: "Invalid structural input",
        draft: {}
      } as never)
    ).rejects.toMatchObject(
      expectPersistenceError("definition-persistence.invalid_spec.v1")
    );
    expect(repository.drafts.size).toBe(1);
  });

  it("revalidates on the server and rejects a non-runnable draft despite a caller-supplied runnable artifact", async () => {
    const { repository, service } = createHarness();
    const misleading = structuredClone(validateSolutionPreparationV2(NOW));
    misleading.permittedActions[0]!.actionId = "action.not_registered.v1";

    const saved = await service.saveDraft(OWNER_ID, {
      idempotencyKey: SAVE_REQUEST_ID,
      draftId: DRAFT_ID,
      name: "Misleading client validation",
      draft: misleading
    });

    expect(saved.draft).toMatchObject({
      supportStatus: "draft_unvalidated",
      validation: null,
      judgeCritique: null
    });
    await expect(
      service.approveDraft(OWNER_ID, DRAFT_ID, {
        idempotencyKey: APPROVE_REQUEST_ID,
        expectedStorageRevision: saved.storageRevision,
        expectedCanonicalHash: hashLabWorkflowSpec(saved.draft)
      })
    ).rejects.toMatchObject(
      expectPersistenceError("definition-persistence.not_runnable.v1")
    );
    expect(repository.versions.size).toBe(0);
  });

  it("rejects stale draft revisions and stale expected hashes without creating a version", async () => {
    const { repository, service } = createHarness();
    const first = await saveRunnableDraft(service);
    const edited = structuredClone(first.draft);
    edited.metadata.title = "A current edited title";
    const current = await service.saveDraft(OWNER_ID, {
      idempotencyKey: UPDATE_REQUEST_ID,
      draftId: DRAFT_ID,
      expectedStorageRevision: first.storageRevision,
      name: first.name,
      draft: edited
    });
    expect(current.storageRevision).toBe(first.storageRevision + 1);

    await expect(
      service.saveDraft(OWNER_ID, {
        idempotencyKey: "77777777-7777-4777-8777-777777777777",
        draftId: DRAFT_ID,
        expectedStorageRevision: first.storageRevision,
        name: "Stale update",
        draft: first.draft
      })
    ).rejects.toMatchObject(
      expectPersistenceError("definition-persistence.revision_conflict.v1")
    );
    await expect(
      service.approveDraft(OWNER_ID, DRAFT_ID, {
        idempotencyKey: APPROVE_REQUEST_ID,
        expectedStorageRevision: first.storageRevision,
        expectedCanonicalHash: hashLabWorkflowSpec(first.draft)
      })
    ).rejects.toMatchObject(
      expectPersistenceError("definition-persistence.revision_conflict.v1")
    );
    await expect(
      service.approveDraft(OWNER_ID, DRAFT_ID, {
        idempotencyKey: "88888888-8888-4888-8888-888888888888",
        expectedStorageRevision: current.storageRevision,
        expectedCanonicalHash: SOLUTION_PREPARATION_V2_EXPECTED_HASH
      })
    ).rejects.toMatchObject(
      expectPersistenceError("definition-persistence.revision_conflict.v1")
    );
    expect(repository.versions.size).toBe(0);
  });

  it("creates one immutable approved version and makes repeated approval idempotent", async () => {
    const { repository, service } = createHarness();
    const saved = await saveRunnableDraft(service);
    const request = {
      idempotencyKey: APPROVE_REQUEST_ID,
      expectedStorageRevision: saved.storageRevision,
      expectedCanonicalHash: hashLabWorkflowSpec(saved.draft)
    };

    const approved = await service.approveDraft(OWNER_ID, DRAFT_ID, request);
    const repeated = await service.approveDraft(OWNER_ID, DRAFT_ID, request);

    expect(repeated).toEqual(approved);
    expect(repository.versions.size).toBe(1);
    expect(approved).toMatchObject({
      draftId: DRAFT_ID,
      ownerId: OWNER_ID,
      approverId: OWNER_ID,
      approvedAt: NOW,
      canonicalHash: SOLUTION_PREPARATION_V2_EXPECTED_HASH,
      spec: {
        supportStatus: "runnable",
        validation: {
          runnable: true,
          previewEligible: true,
          assignmentEligible: true,
          canonicalSpecHash: SOLUTION_PREPARATION_V2_EXPECTED_HASH,
          checkedAt: NOW
        }
      }
    });
    expect(Object.isFrozen(approved)).toBe(true);
    expect(Object.isFrozen(approved.spec)).toBe(true);

    const persisted = [...repository.versions.values()][0];
    expect(persisted).toEqual(approved);
    expect(Object.isFrozen(persisted)).toBe(true);
  });

  it("hides another teacher's drafts and rejects cross-owner mutation or approval as not found", async () => {
    const { repository, service } = createHarness();
    const saved = await saveRunnableDraft(service);

    expect(await service.listDrafts(OTHER_OWNER_ID)).toEqual([]);
    await expect(
      service.saveDraft(OTHER_OWNER_ID, {
        idempotencyKey: UPDATE_REQUEST_ID,
        draftId: DRAFT_ID,
        expectedStorageRevision: saved.storageRevision,
        name: "Cross-owner overwrite",
        draft: saved.draft
      })
    ).rejects.toMatchObject(
      expectPersistenceError("definition-persistence.not_found.v1")
    );
    await expect(
      service.approveDraft(OTHER_OWNER_ID, DRAFT_ID, {
        idempotencyKey: APPROVE_REQUEST_ID,
        expectedStorageRevision: saved.storageRevision,
        expectedCanonicalHash: hashLabWorkflowSpec(saved.draft)
      })
    ).rejects.toMatchObject(
      expectPersistenceError("definition-persistence.not_found.v1")
    );

    expect(repository.drafts.size).toBe(1);
    expect(repository.versions.size).toBe(0);
  });
});
