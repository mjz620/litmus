import type { ExperimentId } from "../../experiments/registry";
import { createServiceRoleSupabaseClient } from "../supabase/service";
import { createLabAssignmentService } from "./labDefinitionApi";
import type { PersistedLabAssignment } from "./labAssignmentRepository";
import {
  SupabaseLabDefinitionRepository,
  type LabDefinitionRepository
} from "./labDefinitionRepository";
import {
  resolveSessionDefinition,
  SessionDefinitionResolutionError,
  type ResolvedSessionDefinition
} from "./sessionDefinitionResolver";

export type StudentAssignmentLaunch =
  | {
      readonly kind: "setup_driven_v2";
      readonly assignment: Readonly<PersistedLabAssignment>;
      readonly experimentId: "acid_base_titration";
      readonly resolution: Extract<ResolvedSessionDefinition, { kind: "pinned_v2" }>;
    }
  | {
      readonly kind: "setup_driven_native_v2";
      readonly assignment: Readonly<PersistedLabAssignment>;
      readonly experimentId: "solution_preparation";
      readonly resolution: Extract<ResolvedSessionDefinition, { kind: "pinned_v2" }>;
    }
  | {
      readonly kind: "legacy_static";
      readonly assignment: Readonly<PersistedLabAssignment>;
      readonly experimentId: ExperimentId;
      readonly resolution: Extract<
        ResolvedSessionDefinition,
        { kind: "legacy_static" }
      >;
    };

export class StudentAssignmentLaunchError extends Error {
  constructor(
    readonly code:
      | "assignment.not_found.v1"
      | "assignment.forbidden.v1"
      | "assignment.unsupported_experiment.v1"
      | "assignment.resolution_failed.v1"
      | "assignment.unavailable.v1",
    message: string
  ) {
    super(message);
    this.name = "StudentAssignmentLaunchError";
  }
}

function asRegisteredExperimentId(value: string): ExperimentId | null {
  if (value === "acid_base_titration" || value === "precipitation_solubility") {
    return value;
  }
  return null;
}

export interface StudentAssignmentMembershipGate {
  readonly studentId: string;
  readonly assertClassMember: (classId: string) => Promise<boolean>;
}

/**
 * Resolve a class assignment into the exact student lab session inputs.
 * Pinned v2 rows always load the immutable approved definition; null-pin rows
 * keep the legacy static experiment path.
 *
 * When `membership` is provided, the student must belong to the assignment's
 * class before the definition is resolved.
 */
export async function resolveStudentAssignmentLaunch(input: {
  readonly assignmentId: string;
  readonly membership?: StudentAssignmentMembershipGate;
  readonly assignments?: {
    getAssignment(
      assignmentId: string
    ): Promise<Readonly<PersistedLabAssignment> | null>;
  };
  readonly definitions?: LabDefinitionRepository;
}): Promise<StudentAssignmentLaunch> {
  try {
    const assignments = input.assignments ?? createLabAssignmentService();
    const definitions =
      input.definitions ??
      new SupabaseLabDefinitionRepository(createServiceRoleSupabaseClient());

    const assignment = await assignments.getAssignment(input.assignmentId);
    if (!assignment) {
      throw new StudentAssignmentLaunchError(
        "assignment.not_found.v1",
        "That assignment was not found."
      );
    }

    if (input.membership) {
      const allowed = await input.membership.assertClassMember(
        assignment.classId
      );
      if (!allowed) {
        throw new StudentAssignmentLaunchError(
          "assignment.forbidden.v1",
          "Join this class before opening the assigned lab."
        );
      }
    }

    const resolution = await resolveSessionDefinition({
      definitions,
      assignment
    });

    if (resolution.kind === "pinned_v2") {
      if (assignment.experimentId === "acid_base_titration") {
        return {
          kind: "setup_driven_v2",
          assignment,
          experimentId: "acid_base_titration",
          resolution
        };
      }
      if (assignment.experimentId === "solution_preparation") {
        return {
          kind: "setup_driven_native_v2",
          assignment,
          experimentId: "solution_preparation",
          resolution
        };
      }
      throw new StudentAssignmentLaunchError(
        "assignment.unsupported_experiment.v1",
        "This assigned lab cannot open on the student bench yet."
      );
    }

    const experimentId = asRegisteredExperimentId(resolution.experimentId);
    if (!experimentId) {
      throw new StudentAssignmentLaunchError(
        "assignment.unsupported_experiment.v1",
        "This assigned experiment is not available for student practice."
      );
    }
    return {
      kind: "legacy_static",
      assignment,
      experimentId,
      resolution
    };
  } catch (error) {
    if (error instanceof StudentAssignmentLaunchError) throw error;
    if (error instanceof SessionDefinitionResolutionError) {
      throw new StudentAssignmentLaunchError(
        "assignment.resolution_failed.v1",
        error.message
      );
    }
    throw new StudentAssignmentLaunchError(
      "assignment.unavailable.v1",
      "Assignment lookup is unavailable."
    );
  }
}
