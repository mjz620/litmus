import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  labWorkflowDraftV2Schema,
  labWorkflowSpecV2Schema,
  validationResultV2Schema,
  validatedLabWorkflowSpecV2Schema,
  type LabWorkflowDraftV2,
  type LabWorkflowSpecV2,
  type ValidatedLabWorkflowSpecV2
} from "../../lab-workflows/schema/v2";
import {
  evaluateLabWorkflowEligibilityV2,
  validateLabWorkflowSpecV2
} from "../../lab-workflows/validation";

const uuidSchema = z.string().uuid();
const storageRevisionSchema = z.number().int().min(1).max(2_147_483_647);

export const labDefinitionDraftSaveRequestSchema = z.strictObject({
  idempotencyKey: uuidSchema,
  draftId: uuidSchema.optional(),
  expectedStorageRevision: storageRevisionSchema.optional(),
  name: z.string().trim().min(1).max(120),
  draft: labWorkflowSpecV2Schema
});

export const labDefinitionApprovalRequestSchema = z.strictObject({
  idempotencyKey: uuidSchema,
  expectedStorageRevision: storageRevisionSchema.optional(),
  expectedCanonicalHash: z
    .string()
    .regex(/^sha256:[a-f0-9]{64}$/)
    .optional()
});

export type LabDefinitionDraftSaveRequest = z.infer<
  typeof labDefinitionDraftSaveRequestSchema
>;
export type LabDefinitionApprovalRequest = z.infer<
  typeof labDefinitionApprovalRequestSchema
>;

export interface PersistedLabDefinitionDraft {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly storageRevision: number;
  readonly schemaVersion: string;
  readonly draft: Readonly<LabWorkflowDraftV2>;
  readonly lastSaveRequestId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PersistedLabDefinitionVersion {
  readonly id: string;
  readonly draftId: string;
  readonly ownerId: string;
  readonly sourceDraftRevision: number;
  readonly schemaVersion: string;
  readonly canonicalHash: string;
  readonly spec: Readonly<ValidatedLabWorkflowSpecV2>;
  readonly validationArtifact: Readonly<
    ValidatedLabWorkflowSpecV2["validation"]
  >;
  readonly registrySnapshotIds: Readonly<Record<string, string>>;
  readonly resolvedAdapters: ValidatedLabWorkflowSpecV2["validation"]["resolvedAdapters"];
  readonly resolvedChemistryModels: ValidatedLabWorkflowSpecV2["validation"]["resolvedChemistryModels"];
  readonly migrationProvenance: ValidatedLabWorkflowSpecV2["provenance"] | null;
  readonly supportStatus: "runnable";
  readonly creatorId: string;
  readonly approverId: string;
  readonly approvalRequestId: string;
  readonly approvedAt: string;
  readonly advisoryCritique: ValidatedLabWorkflowSpecV2["judgeCritique"];
  readonly createdAt: string;
}

export interface SaveDraftRepositoryInput {
  readonly ownerId: string;
  readonly requestId: string;
  readonly draftId?: string;
  readonly expectedStorageRevision?: number;
  readonly name: string;
  readonly draft: Readonly<LabWorkflowDraftV2>;
  readonly savedAt: string;
}

export interface ApproveDefinitionRepositoryInput {
  readonly ownerId: string;
  readonly requestId: string;
  readonly draft: Readonly<PersistedLabDefinitionDraft>;
  readonly spec: Readonly<ValidatedLabWorkflowSpecV2>;
  readonly approvedAt: string;
}

export interface LabDefinitionRepository {
  listDrafts(ownerId: string): Promise<readonly PersistedLabDefinitionDraft[]>;
  getDraft(
    ownerId: string,
    draftId: string
  ): Promise<Readonly<PersistedLabDefinitionDraft> | null>;
  getVersionById(
    versionId: string
  ): Promise<Readonly<PersistedLabDefinitionVersion> | null>;
  listVersionsForOwner(
    ownerId: string
  ): Promise<readonly PersistedLabDefinitionVersion[]>;
  saveDraft(
    input: Readonly<SaveDraftRepositoryInput>
  ): Promise<Readonly<PersistedLabDefinitionDraft>>;
  approveDefinition(
    input: Readonly<ApproveDefinitionRepositoryInput>
  ): Promise<Readonly<PersistedLabDefinitionVersion>>;
}

export const LAB_DEFINITION_PERSISTENCE_ERROR_CODES = Object.freeze({
  invalidSpec: "definition-persistence.invalid_spec.v1",
  notFound: "definition-persistence.not_found.v1",
  revisionConflict: "definition-persistence.revision_conflict.v1",
  notRunnable: "definition-persistence.not_runnable.v1",
  persistenceUnavailable: "definition-persistence.unavailable.v1"
} as const);

export type LabDefinitionPersistenceErrorCode =
  (typeof LAB_DEFINITION_PERSISTENCE_ERROR_CODES)[keyof typeof LAB_DEFINITION_PERSISTENCE_ERROR_CODES];

export class LabDefinitionPersistenceError extends Error {
  constructor(
    readonly code: LabDefinitionPersistenceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "LabDefinitionPersistenceError";
  }
}

function persistenceError(
  code: LabDefinitionPersistenceErrorCode,
  message: string
): never {
  throw new LabDefinitionPersistenceError(code, message);
}

function invalidateDraft(input: LabWorkflowSpecV2): LabWorkflowDraftV2 {
  const { supportStatus, validation, judgeCritique, ...authored } = input;
  void supportStatus;
  void validation;
  void judgeCritique;
  return labWorkflowDraftV2Schema.parse({
    ...authored,
    supportStatus: "draft_unvalidated",
    validation: null,
    judgeCritique: null
  });
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function immutableClone<T>(value: T): T {
  return deepFreeze(clone(value));
}

function generatedUuid(): string {
  return crypto.randomUUID();
}

export class InMemoryLabDefinitionRepository implements LabDefinitionRepository {
  readonly drafts = new Map<string, PersistedLabDefinitionDraft>();
  readonly versions = new Map<string, PersistedLabDefinitionVersion>();

  async listDrafts(
    ownerId: string
  ): Promise<readonly PersistedLabDefinitionDraft[]> {
    return [...this.drafts.values()]
      .filter((draft) => draft.ownerId === ownerId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((draft) => immutableClone(draft));
  }

  async getDraft(
    ownerId: string,
    draftId: string
  ): Promise<Readonly<PersistedLabDefinitionDraft> | null> {
    const draft = this.drafts.get(draftId);
    return draft?.ownerId === ownerId ? immutableClone(draft) : null;
  }

  async getVersionById(
    versionId: string
  ): Promise<Readonly<PersistedLabDefinitionVersion> | null> {
    const version = this.versions.get(versionId);
    return version ? immutableClone(version) : null;
  }

  async listVersionsForOwner(
    ownerId: string
  ): Promise<readonly PersistedLabDefinitionVersion[]> {
    return [...this.versions.values()]
      .filter((version) => version.ownerId === ownerId)
      .sort((left, right) => right.approvedAt.localeCompare(left.approvedAt))
      .map((version) => immutableClone(version));
  }

  async saveDraft(
    input: Readonly<SaveDraftRepositoryInput>
  ): Promise<Readonly<PersistedLabDefinitionDraft>> {
    if (input.draftId) {
      const current = this.drafts.get(input.draftId);
      if (!current && input.expectedStorageRevision === undefined) {
        const created = this.createDraft(input, input.draftId);
        this.drafts.set(created.id, created);
        return immutableClone(created);
      }
      if (!current || current.ownerId !== input.ownerId) {
        persistenceError(
          LAB_DEFINITION_PERSISTENCE_ERROR_CODES.notFound,
          "The requested lab draft was not found."
        );
      }
      if (current.lastSaveRequestId === input.requestId)
        return immutableClone(current);
      if (
        input.expectedStorageRevision === undefined ||
        input.expectedStorageRevision !== current.storageRevision
      ) {
        persistenceError(
          LAB_DEFINITION_PERSISTENCE_ERROR_CODES.revisionConflict,
          "The lab draft changed after it was loaded."
        );
      }
      const updated: PersistedLabDefinitionDraft = {
        ...current,
        name: input.name,
        schemaVersion: input.draft.schemaVersion,
        draft: immutableClone(input.draft),
        storageRevision: current.storageRevision + 1,
        lastSaveRequestId: input.requestId,
        updatedAt: input.savedAt
      };
      const immutableUpdated = deepFreeze(updated);
      this.drafts.set(updated.id, immutableUpdated);
      return immutableClone(immutableUpdated);
    }

    const repeated = [...this.drafts.values()].find(
      (draft) =>
        draft.ownerId === input.ownerId &&
        draft.lastSaveRequestId === input.requestId
    );
    if (repeated) return immutableClone(repeated);
    const created = this.createDraft(input, generatedUuid());
    this.drafts.set(created.id, created);
    return immutableClone(created);
  }

  private createDraft(
    input: Readonly<SaveDraftRepositoryInput>,
    id: string
  ): PersistedLabDefinitionDraft {
    return deepFreeze({
      id,
      ownerId: input.ownerId,
      name: input.name,
      storageRevision: 1,
      schemaVersion: input.draft.schemaVersion,
      draft: immutableClone(input.draft),
      lastSaveRequestId: input.requestId,
      createdAt: input.savedAt,
      updatedAt: input.savedAt
    });
  }

  async approveDefinition(
    input: Readonly<ApproveDefinitionRepositoryInput>
  ): Promise<Readonly<PersistedLabDefinitionVersion>> {
    const repeated = [...this.versions.values()].find(
      (version) =>
        version.ownerId === input.ownerId &&
        version.approvalRequestId === input.requestId
    );
    if (repeated) return immutableClone(repeated);
    const validation = input.spec.validation;
    const created: PersistedLabDefinitionVersion = deepFreeze({
      id: generatedUuid(),
      draftId: input.draft.id,
      ownerId: input.ownerId,
      sourceDraftRevision: input.draft.storageRevision,
      schemaVersion: input.spec.schemaVersion,
      canonicalHash: validation.canonicalSpecHash,
      spec: immutableClone(input.spec),
      validationArtifact: immutableClone(validation),
      registrySnapshotIds: immutableClone(validation.registrySnapshotIds),
      resolvedAdapters: immutableClone(validation.resolvedAdapters),
      resolvedChemistryModels: immutableClone(
        validation.resolvedChemistryModels
      ),
      migrationProvenance: immutableClone(input.spec.provenance ?? null),
      supportStatus: "runnable",
      creatorId: input.draft.ownerId,
      approverId: input.ownerId,
      approvalRequestId: input.requestId,
      approvedAt: input.approvedAt,
      advisoryCritique: immutableClone(input.spec.judgeCritique),
      createdAt: input.approvedAt
    });
    this.versions.set(created.id, created);
    return immutableClone(created);
  }
}

interface DraftRow {
  readonly id: string;
  readonly owner_id: string;
  readonly name: string;
  readonly storage_revision: number;
  readonly schema_version: string;
  readonly draft_spec: unknown;
  readonly last_save_request_id: string;
  readonly created_at: string;
  readonly updated_at: string;
}

interface VersionRow {
  readonly id: string;
  readonly draft_id: string;
  readonly owner_id: string;
  readonly source_draft_revision: number;
  readonly schema_version: string;
  readonly canonical_hash: string;
  readonly spec: unknown;
  readonly validation_artifact: unknown;
  readonly registry_snapshot_ids: unknown;
  readonly resolved_adapters: unknown;
  readonly resolved_chemistry_models: unknown;
  readonly migration_provenance: unknown;
  readonly support_status: string;
  readonly creator_id: string;
  readonly approver_id: string;
  readonly approval_request_id: string;
  readonly approved_at: string;
  readonly advisory_critique: unknown;
  readonly created_at: string;
}

function parseDraftRow(row: DraftRow): PersistedLabDefinitionDraft {
  return {
    id: uuidSchema.parse(row.id),
    ownerId: uuidSchema.parse(row.owner_id),
    name: z.string().min(1).max(120).parse(row.name),
    storageRevision: storageRevisionSchema.parse(row.storage_revision),
    schemaVersion: z.string().min(1).parse(row.schema_version),
    draft: labWorkflowDraftV2Schema.parse(row.draft_spec),
    lastSaveRequestId: uuidSchema.parse(row.last_save_request_id),
    createdAt: z.string().datetime({ offset: true }).parse(row.created_at),
    updatedAt: z.string().datetime({ offset: true }).parse(row.updated_at)
  };
}

function parseVersionRow(row: VersionRow): PersistedLabDefinitionVersion {
  const spec = validatedLabWorkflowSpecV2Schema.parse(row.spec);
  const validationArtifact = validationResultV2Schema.parse(
    row.validation_artifact
  );
  if (
    row.support_status !== "runnable" ||
    row.canonical_hash !== spec.validation.canonicalSpecHash ||
    JSON.stringify(validationArtifact) !== JSON.stringify(spec.validation)
  ) {
    persistenceError(
      LAB_DEFINITION_PERSISTENCE_ERROR_CODES.persistenceUnavailable,
      "Stored lab definition authority is inconsistent."
    );
  }
  return {
    id: uuidSchema.parse(row.id),
    draftId: uuidSchema.parse(row.draft_id),
    ownerId: uuidSchema.parse(row.owner_id),
    sourceDraftRevision: storageRevisionSchema.parse(row.source_draft_revision),
    schemaVersion: z.string().min(1).parse(row.schema_version),
    canonicalHash: z
      .string()
      .regex(/^sha256:[a-f0-9]{64}$/)
      .parse(row.canonical_hash),
    spec,
    validationArtifact,
    registrySnapshotIds: z
      .record(z.string(), z.string())
      .parse(row.registry_snapshot_ids),
    resolvedAdapters: spec.validation.resolvedAdapters,
    resolvedChemistryModels: spec.validation.resolvedChemistryModels,
    migrationProvenance: spec.provenance ?? null,
    supportStatus: "runnable",
    creatorId: uuidSchema.parse(row.creator_id),
    approverId: uuidSchema.parse(row.approver_id),
    approvalRequestId: uuidSchema.parse(row.approval_request_id),
    approvedAt: z.string().datetime({ offset: true }).parse(row.approved_at),
    advisoryCritique: spec.judgeCritique,
    createdAt: z.string().datetime({ offset: true }).parse(row.created_at)
  };
}

export class SupabaseLabDefinitionRepository implements LabDefinitionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listDrafts(
    ownerId: string
  ): Promise<readonly PersistedLabDefinitionDraft[]> {
    const { data, error } = await this.client
      .from("lab_definition_drafts")
      .select("*")
      .eq("owner_id", ownerId)
      .order("updated_at", { ascending: false });
    if (error) this.fail(error.message);
    return ((data ?? []) as DraftRow[]).map(parseDraftRow);
  }

  async getDraft(
    ownerId: string,
    draftId: string
  ): Promise<Readonly<PersistedLabDefinitionDraft> | null> {
    const { data, error } = await this.client
      .from("lab_definition_drafts")
      .select("*")
      .eq("id", draftId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) this.fail(error.message);
    return data ? parseDraftRow(data as DraftRow) : null;
  }

  async getVersionById(
    versionId: string
  ): Promise<Readonly<PersistedLabDefinitionVersion> | null> {
    const { data, error } = await this.client
      .from("lab_definition_versions")
      .select("*")
      .eq("id", versionId)
      .maybeSingle();
    if (error) this.fail(error.message);
    return data ? parseVersionRow(data as VersionRow) : null;
  }

  async listVersionsForOwner(
    ownerId: string
  ): Promise<readonly PersistedLabDefinitionVersion[]> {
    const { data, error } = await this.client
      .from("lab_definition_versions")
      .select("*")
      .eq("owner_id", ownerId)
      .order("approved_at", { ascending: false });
    if (error) this.fail(error.message);
    return ((data ?? []) as VersionRow[]).map(parseVersionRow);
  }

  async saveDraft(
    input: Readonly<SaveDraftRepositoryInput>
  ): Promise<Readonly<PersistedLabDefinitionDraft>> {
    const { data, error } = await this.client.rpc("save_lab_definition_draft", {
      requested_owner_id: input.ownerId,
      request_id: input.requestId,
      requested_draft_id: input.draftId ?? null,
      expected_storage_revision: input.expectedStorageRevision ?? null,
      requested_name: input.name,
      requested_schema_version: input.draft.schemaVersion,
      requested_draft_spec: input.draft,
      requested_saved_at: input.savedAt
    });
    if (error) this.fail(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) this.fail("Draft persistence returned no record.");
    return parseDraftRow(row as DraftRow);
  }

  async approveDefinition(
    input: Readonly<ApproveDefinitionRepositoryInput>
  ): Promise<Readonly<PersistedLabDefinitionVersion>> {
    const validation = input.spec.validation;
    const { data, error } = await this.client.rpc(
      "approve_lab_definition_version",
      {
        requested_owner_id: input.ownerId,
        request_id: input.requestId,
        requested_draft_id: input.draft.id,
        expected_storage_revision: input.draft.storageRevision,
        requested_schema_version: input.spec.schemaVersion,
        requested_canonical_hash: validation.canonicalSpecHash,
        requested_spec: input.spec,
        requested_validation_artifact: validation,
        requested_registry_snapshot_ids: validation.registrySnapshotIds,
        requested_resolved_adapters: validation.resolvedAdapters,
        requested_resolved_chemistry_models: validation.resolvedChemistryModels,
        requested_migration_provenance: input.spec.provenance ?? null,
        requested_advisory_critique: input.spec.judgeCritique,
        requested_approved_at: input.approvedAt
      }
    );
    if (error) this.fail(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) this.fail("Definition approval returned no record.");
    return parseVersionRow(row as VersionRow);
  }

  private fail(message: string): never {
    if (message.includes("lab_definition_revision_conflict")) {
      persistenceError(
        LAB_DEFINITION_PERSISTENCE_ERROR_CODES.revisionConflict,
        "The lab draft changed after it was loaded."
      );
    }
    if (message.includes("lab_definition_not_found")) {
      persistenceError(
        LAB_DEFINITION_PERSISTENCE_ERROR_CODES.notFound,
        "The requested lab draft was not found."
      );
    }
    persistenceError(
      LAB_DEFINITION_PERSISTENCE_ERROR_CODES.persistenceUnavailable,
      "Lab definition persistence is unavailable."
    );
  }
}

export interface LabDefinitionPersistenceServiceOptions {
  readonly now: () => string;
}

export class LabDefinitionPersistenceService {
  constructor(
    private readonly repository: LabDefinitionRepository,
    private readonly options: LabDefinitionPersistenceServiceOptions = {
      now: () => new Date().toISOString()
    }
  ) {}

  listDrafts(ownerId: string): Promise<readonly PersistedLabDefinitionDraft[]> {
    return this.repository.listDrafts(uuidSchema.parse(ownerId));
  }

  listVersions(
    ownerId: string
  ): Promise<readonly PersistedLabDefinitionVersion[]> {
    return this.repository.listVersionsForOwner(uuidSchema.parse(ownerId));
  }

  getVersion(
    versionId: string
  ): Promise<Readonly<PersistedLabDefinitionVersion> | null> {
    return this.repository.getVersionById(uuidSchema.parse(versionId));
  }

  async saveDraft(
    ownerId: string,
    request: LabDefinitionDraftSaveRequest
  ): Promise<Readonly<PersistedLabDefinitionDraft>> {
    const parsedOwnerId = uuidSchema.parse(ownerId);
    const parsed = labDefinitionDraftSaveRequestSchema.safeParse(request);
    if (!parsed.success) {
      persistenceError(
        LAB_DEFINITION_PERSISTENCE_ERROR_CODES.invalidSpec,
        "The lab draft request is invalid."
      );
    }
    const draft = invalidateDraft(parsed.data.draft);
    return this.repository.saveDraft({
      ownerId: parsedOwnerId,
      requestId: parsed.data.idempotencyKey,
      draftId: parsed.data.draftId,
      expectedStorageRevision: parsed.data.expectedStorageRevision,
      name: parsed.data.name,
      draft,
      savedAt: this.options.now()
    });
  }

  async approveDraft(
    ownerId: string,
    draftId: string,
    request: LabDefinitionApprovalRequest
  ): Promise<Readonly<PersistedLabDefinitionVersion>> {
    const parsedOwnerId = uuidSchema.parse(ownerId);
    const parsedDraftId = uuidSchema.parse(draftId);
    const parsed = labDefinitionApprovalRequestSchema.safeParse(request);
    if (!parsed.success) {
      persistenceError(
        LAB_DEFINITION_PERSISTENCE_ERROR_CODES.invalidSpec,
        "The lab approval request is invalid."
      );
    }
    const draft = await this.repository.getDraft(parsedOwnerId, parsedDraftId);
    if (!draft) {
      persistenceError(
        LAB_DEFINITION_PERSISTENCE_ERROR_CODES.notFound,
        "The requested lab draft was not found."
      );
    }
    if (
      parsed.data.expectedStorageRevision !== undefined &&
      draft.storageRevision !== parsed.data.expectedStorageRevision
    ) {
      persistenceError(
        LAB_DEFINITION_PERSISTENCE_ERROR_CODES.revisionConflict,
        "The lab draft changed after it was loaded."
      );
    }

    const checkedAt = this.options.now();
    const outcome = validateLabWorkflowSpecV2(draft.draft, { checkedAt });
    if (!outcome.schemaValid) {
      persistenceError(
        LAB_DEFINITION_PERSISTENCE_ERROR_CODES.invalidSpec,
        "The stored lab draft no longer passes strict schema validation."
      );
    }
    const eligibility = evaluateLabWorkflowEligibilityV2(
      outcome.spec,
      "preview"
    );
    if (
      outcome.spec.supportStatus !== "runnable" ||
      !outcome.validation.runnable ||
      !eligibility.eligible
    ) {
      persistenceError(
        LAB_DEFINITION_PERSISTENCE_ERROR_CODES.notRunnable,
        "Only a current, runnable, preview-eligible lab can be approved."
      );
    }
    if (
      parsed.data.expectedCanonicalHash &&
      parsed.data.expectedCanonicalHash !== outcome.validation.canonicalSpecHash
    ) {
      persistenceError(
        LAB_DEFINITION_PERSISTENCE_ERROR_CODES.revisionConflict,
        "The validated lab content does not match the expected hash."
      );
    }
    return this.repository.approveDefinition({
      ownerId: parsedOwnerId,
      requestId: parsed.data.idempotencyKey,
      draft,
      spec: outcome.spec,
      approvedAt: checkedAt
    });
  }
}
