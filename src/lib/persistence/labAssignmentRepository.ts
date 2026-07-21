import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { ValidatedLabWorkflowSpecV2 } from "../../lab-workflows/schema/v2";
import { evaluateLabWorkflowEligibilityV2 } from "../../lab-workflows/validation";
import {
  LAB_DEFINITION_PERSISTENCE_ERROR_CODES,
  LabDefinitionPersistenceError,
  type LabDefinitionRepository,
  type PersistedLabDefinitionVersion
} from "./labDefinitionRepository";

const uuidSchema = z.string().uuid();
const hashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const labAssignmentCreateRequestSchema = z.strictObject({
  idempotencyKey: uuidSchema,
  classId: uuidSchema,
  versionId: uuidSchema,
  title: z.string().trim().min(1).max(160),
  dueAt: z.string().datetime({ offset: true }).optional()
});

export type LabAssignmentCreateRequest = z.infer<
  typeof labAssignmentCreateRequestSchema
>;

export interface PersistedLabAssignment {
  readonly id: string;
  readonly classId: string;
  readonly experimentId: string;
  readonly experimentVersion: string;
  readonly title: string;
  readonly dueAt: string | null;
  readonly createdAt: string;
  readonly labDefinitionVersionId: string | null;
  readonly labDefinitionCanonicalHash: string | null;
  readonly approvalRequestId: string | null;
  readonly assignedBy: string | null;
  readonly assignedAt: string | null;
  readonly assignIdempotencyKey: string | null;
}

export const LAB_ASSIGNMENT_ERROR_CODES = Object.freeze({
  invalidRequest: "lab-assignment.invalid_request.v1",
  notFound: "lab-assignment.not_found.v1",
  unauthorized: "lab-assignment.unauthorized.v1",
  notAssignable: "lab-assignment.not_assignable.v1",
  unavailable: "lab-assignment.unavailable.v1"
} as const);

export type LabAssignmentErrorCode =
  (typeof LAB_ASSIGNMENT_ERROR_CODES)[keyof typeof LAB_ASSIGNMENT_ERROR_CODES];

export class LabAssignmentError extends Error {
  constructor(
    readonly code: LabAssignmentErrorCode,
    message: string
  ) {
    super(message);
    this.name = "LabAssignmentError";
  }
}

function assignmentError(code: LabAssignmentErrorCode, message: string): never {
  throw new LabAssignmentError(code, message);
}

function cloneFreeze<T>(value: T): T {
  const cloned = structuredClone(value);
  const freezeDeep = (node: unknown): void => {
    if (typeof node !== "object" || node === null || Object.isFrozen(node))
      return;
    Object.freeze(node);
    for (const child of Object.values(node)) freezeDeep(child);
  };
  freezeDeep(cloned);
  return cloned;
}

/** Denormalized catalog key retained beside the exact definition pin. */
export function experimentCatalogFromDefinition(
  spec: Readonly<ValidatedLabWorkflowSpecV2>
): { readonly experimentId: string; readonly experimentVersion: string } {
  const familyId = spec.catalog?.familyId ?? "";
  const id = `${spec.id} ${familyId}`.toLowerCase();
  const hasTitrationAdapter = spec.validation.resolvedAdapters.some(
    (adapter) => adapter.adapterId.toLowerCase().includes("titration")
  );
  const experimentId =
    hasTitrationAdapter || id.includes("acid_base_titration")
      ? "acid_base_titration"
      : id.includes("solution") ||
          id.includes("dilution") ||
          id.includes("copper_nitrate")
        ? "solution_preparation"
        : spec.id;
  return {
    experimentId,
    experimentVersion: `${spec.schemaVersion}+rev${spec.revision}`
  };
}

interface AssignmentRow {
  readonly id: string;
  readonly class_id: string;
  readonly experiment_id: string;
  readonly experiment_version: string;
  readonly title: string;
  readonly due_at: string | null;
  readonly created_at: string;
  readonly lab_definition_version_id: string | null;
  readonly lab_definition_canonical_hash: string | null;
  readonly approval_request_id: string | null;
  readonly assigned_by: string | null;
  readonly assigned_at: string | null;
  readonly assign_idempotency_key: string | null;
}

function parseAssignmentRow(row: AssignmentRow): PersistedLabAssignment {
  return {
    id: uuidSchema.parse(row.id),
    classId: uuidSchema.parse(row.class_id),
    experimentId: z.string().min(1).parse(row.experiment_id),
    experimentVersion: z.string().min(1).parse(row.experiment_version),
    title: z.string().min(1).max(160).parse(row.title),
    dueAt: row.due_at
      ? z.string().datetime({ offset: true }).parse(row.due_at)
      : null,
    createdAt: z.string().datetime({ offset: true }).parse(row.created_at),
    labDefinitionVersionId: row.lab_definition_version_id
      ? uuidSchema.parse(row.lab_definition_version_id)
      : null,
    labDefinitionCanonicalHash: row.lab_definition_canonical_hash
      ? hashSchema.parse(row.lab_definition_canonical_hash)
      : null,
    approvalRequestId: row.approval_request_id
      ? uuidSchema.parse(row.approval_request_id)
      : null,
    assignedBy: row.assigned_by ? uuidSchema.parse(row.assigned_by) : null,
    assignedAt: row.assigned_at
      ? z.string().datetime({ offset: true }).parse(row.assigned_at)
      : null,
    assignIdempotencyKey: row.assign_idempotency_key
      ? uuidSchema.parse(row.assign_idempotency_key)
      : null
  };
}

export interface LabAssignmentRepository {
  getVersion(
    versionId: string
  ): Promise<Readonly<PersistedLabDefinitionVersion> | null>;
  assertClassTeacher(classId: string, teacherId: string): Promise<void>;
  /**
   * Authorize reading a class's assignments: the owning teacher or an enrolled
   * student. Reads run through a service-role client that bypasses RLS, so
   * without this any authenticated user could enumerate any class by id.
   */
  assertClassAccess(classId: string, userId: string): Promise<void>;
  findByIdempotency(
    classId: string,
    teacherId: string,
    idempotencyKey: string
  ): Promise<Readonly<PersistedLabAssignment> | null>;
  insertPinnedAssignment(input: {
    readonly classId: string;
    readonly teacherId: string;
    readonly version: Readonly<PersistedLabDefinitionVersion>;
    readonly title: string;
    readonly dueAt: string | null;
    readonly idempotencyKey: string;
    readonly assignedAt: string;
  }): Promise<Readonly<PersistedLabAssignment>>;
  listForClass(
    classId: string
  ): Promise<readonly PersistedLabAssignment[]>;
  getAssignment(
    assignmentId: string
  ): Promise<Readonly<PersistedLabAssignment> | null>;
}

export class InMemoryLabAssignmentRepository implements LabAssignmentRepository {
  readonly assignments = new Map<string, PersistedLabAssignment>();
  readonly classTeachers = new Map<string, string>();

  constructor(
    private readonly definitions: LabDefinitionRepository & {
      readonly versions?: Map<string, PersistedLabDefinitionVersion>;
    }
  ) {}

  async getVersion(
    versionId: string
  ): Promise<Readonly<PersistedLabDefinitionVersion> | null> {
    const versions = this.definitions.versions;
    if (!versions) return null;
    const version = versions.get(versionId);
    return version ? cloneFreeze(version) : null;
  }

  readonly classMembers = new Map<string, Set<string>>();

  async assertClassTeacher(classId: string, teacherId: string): Promise<void> {
    if (this.classTeachers.get(classId) !== teacherId) {
      assignmentError(
        LAB_ASSIGNMENT_ERROR_CODES.unauthorized,
        "Only the class teacher can create assignments."
      );
    }
  }

  async assertClassAccess(classId: string, userId: string): Promise<void> {
    if (this.classTeachers.get(classId) === userId) return;
    if (this.classMembers.get(classId)?.has(userId)) return;
    assignmentError(
      LAB_ASSIGNMENT_ERROR_CODES.unauthorized,
      "You do not have access to this class."
    );
  }

  async findByIdempotency(
    classId: string,
    teacherId: string,
    idempotencyKey: string
  ): Promise<Readonly<PersistedLabAssignment> | null> {
    const found = [...this.assignments.values()].find(
      (row) =>
        row.classId === classId &&
        row.assignedBy === teacherId &&
        row.assignIdempotencyKey === idempotencyKey
    );
    return found ? cloneFreeze(found) : null;
  }

  async insertPinnedAssignment(input: {
    readonly classId: string;
    readonly teacherId: string;
    readonly version: Readonly<PersistedLabDefinitionVersion>;
    readonly title: string;
    readonly dueAt: string | null;
    readonly idempotencyKey: string;
    readonly assignedAt: string;
  }): Promise<Readonly<PersistedLabAssignment>> {
    const catalog = experimentCatalogFromDefinition(input.version.spec);
    const created = cloneFreeze({
      id: crypto.randomUUID(),
      classId: input.classId,
      experimentId: catalog.experimentId,
      experimentVersion: catalog.experimentVersion,
      title: input.title,
      dueAt: input.dueAt,
      createdAt: input.assignedAt,
      labDefinitionVersionId: input.version.id,
      labDefinitionCanonicalHash: input.version.canonicalHash,
      approvalRequestId: input.version.approvalRequestId,
      assignedBy: input.teacherId,
      assignedAt: input.assignedAt,
      assignIdempotencyKey: input.idempotencyKey
    });
    this.assignments.set(created.id, created);
    return cloneFreeze(created);
  }

  async listForClass(
    classId: string
  ): Promise<readonly PersistedLabAssignment[]> {
    return [...this.assignments.values()]
      .filter((row) => row.classId === classId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((row) => cloneFreeze(row));
  }

  async getAssignment(
    assignmentId: string
  ): Promise<Readonly<PersistedLabAssignment> | null> {
    const row = this.assignments.get(assignmentId);
    return row ? cloneFreeze(row) : null;
  }
}

export class SupabaseLabAssignmentRepository implements LabAssignmentRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly definitions: LabDefinitionRepository
  ) {}

  async getVersion(
    versionId: string
  ): Promise<Readonly<PersistedLabDefinitionVersion> | null> {
    try {
      return await this.definitions.getVersionById(versionId);
    } catch (error) {
      const mapped = mapDefinitionPersistenceToAssignmentError(error);
      if (mapped) throw mapped;
      assignmentError(
        LAB_ASSIGNMENT_ERROR_CODES.unavailable,
        "Lab definition lookup is unavailable."
      );
    }
  }

  async assertClassTeacher(classId: string, teacherId: string): Promise<void> {
    const { data, error } = await this.client
      .from("classes")
      .select("id")
      .eq("id", classId)
      .eq("teacher_id", teacherId)
      .maybeSingle();
    if (error) {
      assignmentError(
        LAB_ASSIGNMENT_ERROR_CODES.unavailable,
        "Class authorization is unavailable."
      );
    }
    if (!data) {
      assignmentError(
        LAB_ASSIGNMENT_ERROR_CODES.unauthorized,
        "Only the class teacher can create assignments."
      );
    }
  }

  async assertClassAccess(classId: string, userId: string): Promise<void> {
    const [{ data: owned, error: classError }, { data: enrolled, error: memberError }] =
      await Promise.all([
        this.client
          .from("classes")
          .select("id")
          .eq("id", classId)
          .eq("teacher_id", userId)
          .maybeSingle(),
        this.client
          .from("class_members")
          .select("class_id")
          .eq("class_id", classId)
          .eq("student_id", userId)
          .maybeSingle()
      ]);
    if (classError || memberError) {
      assignmentError(
        LAB_ASSIGNMENT_ERROR_CODES.unavailable,
        "Class authorization is unavailable."
      );
    }
    if (!owned && !enrolled) {
      assignmentError(
        LAB_ASSIGNMENT_ERROR_CODES.unauthorized,
        "You do not have access to this class."
      );
    }
  }

  async findByIdempotency(
    classId: string,
    _teacherId: string,
    idempotencyKey: string
  ): Promise<Readonly<PersistedLabAssignment> | null> {
    const { data, error } = await this.client
      .from("assignments")
      .select("*")
      .eq("class_id", classId)
      .eq("assign_idempotency_key", idempotencyKey)
      .maybeSingle();
    if (error) {
      assignmentError(
        LAB_ASSIGNMENT_ERROR_CODES.unavailable,
        "Assignment lookup is unavailable."
      );
    }
    return data ? parseAssignmentRow(data as AssignmentRow) : null;
  }

  async insertPinnedAssignment(input: {
    readonly classId: string;
    readonly teacherId: string;
    readonly version: Readonly<PersistedLabDefinitionVersion>;
    readonly title: string;
    readonly dueAt: string | null;
    readonly idempotencyKey: string;
    readonly assignedAt: string;
  }): Promise<Readonly<PersistedLabAssignment>> {
    const catalog = experimentCatalogFromDefinition(input.version.spec);
    const { data, error } = await this.client
      .from("assignments")
      .insert({
        class_id: input.classId,
        experiment_id: catalog.experimentId,
        experiment_version: catalog.experimentVersion,
        title: input.title,
        due_at: input.dueAt,
        lab_definition_version_id: input.version.id,
        lab_definition_canonical_hash: input.version.canonicalHash,
        approval_request_id: input.version.approvalRequestId,
        assigned_by: input.teacherId,
        assigned_at: input.assignedAt,
        assign_idempotency_key: input.idempotencyKey
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        const repeated = await this.findByIdempotency(
          input.classId,
          input.teacherId,
          input.idempotencyKey
        );
        if (repeated) return repeated;
      }
      assignmentError(
        LAB_ASSIGNMENT_ERROR_CODES.unavailable,
        "Assignment persistence is unavailable."
      );
    }
    return parseAssignmentRow(data as AssignmentRow);
  }

  async listForClass(
    classId: string
  ): Promise<readonly PersistedLabAssignment[]> {
    const { data, error } = await this.client
      .from("assignments")
      .select("*")
      .eq("class_id", classId)
      .order("created_at", { ascending: false });
    if (error) {
      assignmentError(
        LAB_ASSIGNMENT_ERROR_CODES.unavailable,
        "Assignment listing is unavailable."
      );
    }
    return ((data ?? []) as AssignmentRow[]).map(parseAssignmentRow);
  }

  async getAssignment(
    assignmentId: string
  ): Promise<Readonly<PersistedLabAssignment> | null> {
    const { data, error } = await this.client
      .from("assignments")
      .select("*")
      .eq("id", assignmentId)
      .maybeSingle();
    if (error) {
      assignmentError(
        LAB_ASSIGNMENT_ERROR_CODES.unavailable,
        "Assignment lookup is unavailable."
      );
    }
    return data ? parseAssignmentRow(data as AssignmentRow) : null;
  }
}

export interface LabAssignmentServiceOptions {
  readonly now: () => string;
}

export class LabAssignmentService {
  constructor(
    private readonly repository: LabAssignmentRepository,
    private readonly options: LabAssignmentServiceOptions = {
      now: () => new Date().toISOString()
    }
  ) {}

  async createAssignment(
    teacherId: string,
    request: LabAssignmentCreateRequest
  ): Promise<Readonly<PersistedLabAssignment>> {
    const parsedTeacherId = uuidSchema.parse(teacherId);
    const parsed = labAssignmentCreateRequestSchema.safeParse(request);
    if (!parsed.success) {
      assignmentError(
        LAB_ASSIGNMENT_ERROR_CODES.invalidRequest,
        "The assignment request is invalid."
      );
    }

    await this.repository.assertClassTeacher(
      parsed.data.classId,
      parsedTeacherId
    );

    const repeated = await this.repository.findByIdempotency(
      parsed.data.classId,
      parsedTeacherId,
      parsed.data.idempotencyKey
    );
    if (repeated) return repeated;

    const version = await this.repository.getVersion(parsed.data.versionId);
    if (!version || version.ownerId !== parsedTeacherId) {
      assignmentError(
        LAB_ASSIGNMENT_ERROR_CODES.notFound,
        "The approved lab definition version was not found."
      );
    }

    const eligibility = evaluateLabWorkflowEligibilityV2(
      version.spec,
      "assignment"
    );
    if (
      version.supportStatus !== "runnable" ||
      !version.validationArtifact.runnable ||
      !version.validationArtifact.assignmentEligible ||
      !eligibility.eligible ||
      version.canonicalHash !== version.spec.validation.canonicalSpecHash
    ) {
      assignmentError(
        LAB_ASSIGNMENT_ERROR_CODES.notAssignable,
        "Only a current, assignment-eligible approved definition can be assigned."
      );
    }

    return this.repository.insertPinnedAssignment({
      classId: parsed.data.classId,
      teacherId: parsedTeacherId,
      version,
      title: parsed.data.title,
      dueAt: parsed.data.dueAt ?? null,
      idempotencyKey: parsed.data.idempotencyKey,
      assignedAt: this.options.now()
    });
  }

  /**
   * List a class's assignments for one requester. The caller must be the
   * owning teacher or an enrolled student; membership is checked before any
   * assignment row is read.
   */
  async listForClass(
    classId: string,
    requesterId: string
  ): Promise<readonly PersistedLabAssignment[]> {
    const parsedClassId = uuidSchema.parse(classId);
    await this.repository.assertClassAccess(
      parsedClassId,
      uuidSchema.parse(requesterId)
    );
    return this.repository.listForClass(parsedClassId);
  }

  getAssignment(
    assignmentId: string
  ): Promise<Readonly<PersistedLabAssignment> | null> {
    return this.repository.getAssignment(uuidSchema.parse(assignmentId));
  }
}

export function mapDefinitionPersistenceToAssignmentError(
  error: unknown
): LabAssignmentError | null {
  if (!(error instanceof LabDefinitionPersistenceError)) return null;
  switch (error.code) {
    case LAB_DEFINITION_PERSISTENCE_ERROR_CODES.notFound:
      return new LabAssignmentError(
        LAB_ASSIGNMENT_ERROR_CODES.notFound,
        error.message
      );
    case LAB_DEFINITION_PERSISTENCE_ERROR_CODES.notRunnable:
      return new LabAssignmentError(
        LAB_ASSIGNMENT_ERROR_CODES.notAssignable,
        error.message
      );
    default:
      return new LabAssignmentError(
        LAB_ASSIGNMENT_ERROR_CODES.unavailable,
        error.message
      );
  }
}
