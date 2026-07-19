import { evaluateLabWorkflowEligibilityV2 } from "../../lab-workflows/validation";
import type { ValidatedLabWorkflowSpecV2 } from "../../lab-workflows/schema/v2";
import type { LabDefinitionRepository } from "./labDefinitionRepository";
import type { PersistedLabAssignment } from "./labAssignmentRepository";

export type ResolvedSessionDefinition =
  | {
      readonly kind: "pinned_v2";
      readonly versionId: string;
      readonly canonicalHash: string;
      readonly spec: Readonly<ValidatedLabWorkflowSpecV2>;
      readonly registrySnapshotIds: Readonly<Record<string, string>>;
      readonly resolvedAdapters: ValidatedLabWorkflowSpecV2["validation"]["resolvedAdapters"];
      readonly resolvedChemistryModels: ValidatedLabWorkflowSpecV2["validation"]["resolvedChemistryModels"];
    }
  | {
      readonly kind: "legacy_static";
      readonly experimentId: string;
      readonly experimentVersion: string;
    };

export class SessionDefinitionResolutionError extends Error {
  constructor(
    readonly code:
      | "session-definition.not_found.v1"
      | "session-definition.hash_mismatch.v1"
      | "session-definition.stale_implementation.v1"
      | "session-definition.unavailable.v1",
    message: string
  ) {
    super(message);
    this.name = "SessionDefinitionResolutionError";
  }
}

/**
 * Resolve the exact lab a student session must run.
 * Pinned assignments always reload the immutable approved version row.
 * Null-pin rows stay on the explicit legacy static experiment path.
 */
export async function resolveSessionDefinition(input: {
  readonly definitions: LabDefinitionRepository;
  readonly assignment?: Readonly<PersistedLabAssignment> | null;
  readonly sessionPin?: {
    readonly labDefinitionVersionId: string | null;
    readonly labDefinitionCanonicalHash: string | null;
    readonly experimentId: string;
    readonly experimentVersion: string;
  } | null;
}): Promise<ResolvedSessionDefinition> {
  const pinVersionId =
    input.assignment?.labDefinitionVersionId ??
    input.sessionPin?.labDefinitionVersionId ??
    null;
  const pinHash =
    input.assignment?.labDefinitionCanonicalHash ??
    input.sessionPin?.labDefinitionCanonicalHash ??
    null;

  if (!pinVersionId) {
    const experimentId =
      input.assignment?.experimentId ?? input.sessionPin?.experimentId;
    const experimentVersion =
      input.assignment?.experimentVersion ??
      input.sessionPin?.experimentVersion;
    if (!experimentId || !experimentVersion) {
      throw new SessionDefinitionResolutionError(
        "session-definition.not_found.v1",
        "No pinned definition or legacy experiment identity is available."
      );
    }
    return {
      kind: "legacy_static",
      experimentId,
      experimentVersion
    };
  }

  const version = await input.definitions.getVersionById(pinVersionId);
  if (!version) {
    throw new SessionDefinitionResolutionError(
      "session-definition.not_found.v1",
      "The pinned lab definition version is no longer available."
    );
  }
  if (pinHash && pinHash !== version.canonicalHash) {
    throw new SessionDefinitionResolutionError(
      "session-definition.hash_mismatch.v1",
      "The session pin does not match the immutable definition hash."
    );
  }
  if (version.canonicalHash !== version.spec.validation.canonicalSpecHash) {
    throw new SessionDefinitionResolutionError(
      "session-definition.hash_mismatch.v1",
      "Stored definition authority is inconsistent."
    );
  }

  const eligibility = evaluateLabWorkflowEligibilityV2(version.spec, "preview");
  if (!eligibility.eligible) {
    // Historical sessions must fail closed when required implementations vanish;
    // never silently upgrade to a newer draft or registry snapshot.
    throw new SessionDefinitionResolutionError(
      "session-definition.stale_implementation.v1",
      "A required registry, adapter, or model version is unavailable for replay."
    );
  }

  return {
    kind: "pinned_v2",
    versionId: version.id,
    canonicalHash: version.canonicalHash,
    spec: version.spec,
    registrySnapshotIds: version.registrySnapshotIds,
    resolvedAdapters: version.resolvedAdapters,
    resolvedChemistryModels: version.resolvedChemistryModels
  };
}
