export type CanonicalSkillId =
  | "burette_conditioning"
  | "calorimetry_sign_convention"
  | "data_recording"
  | "endpoint_control"
  | "heat_transfer"
  | "measure_mass"
  | "measure_dissolution_enthalpy"
  | "meniscus_reading"
  | "net_ionic_equations"
  | "precipitate_observation"
  | "procedural_safety"
  | "solution_dilution"
  | "significant_figures"
  | "stoichiometry"
  | "volumetric_transfer";

export type LegacySkillAlias =
  | "net_ionic_equation"
  | "sig_figs"
  | "sign_convention"
  | "volumetric_reading";

export type SkillAvailability = "planned" | "restricted" | "verified";

export interface SkillRegistryDefinition {
  readonly id: CanonicalSkillId;
  readonly version: "1.0.0";
  readonly description: string;
  readonly aliases: readonly LegacySkillAlias[];
  readonly supportedFamilyIds: readonly string[];
  readonly requiredComponentIds: readonly string[];
  readonly recommendedComponentIds: readonly string[];
  readonly relevantEventFlagIds: readonly string[];
  readonly positiveEvidenceReasonIds: readonly string[];
  readonly assessmentModeIds: readonly string[];
  readonly coachTriggerTypeIds: readonly string[];
  readonly adaptiveRetryPatternIds: readonly string[];
  readonly examplePrompts: readonly string[];
  readonly restricted: boolean;
}

export interface SkillRegistryEntry extends SkillRegistryDefinition {
  readonly availability: SkillAvailability;
}

export type SkillResolution =
  | {
      readonly status: "resolved";
      readonly inputId: string;
      readonly canonicalId: CanonicalSkillId;
      readonly source: "alias" | "canonical";
      readonly entry: SkillRegistryEntry;
    }
  | {
      readonly status: "unknown";
      readonly inputId: string;
    };

export type SkillSearchResult =
  | { readonly status: "none"; readonly query: string; readonly matches: [] }
  | {
      readonly status: "single";
      readonly query: string;
      readonly matches: readonly [SkillRegistryEntry];
    }
  | {
      readonly status: "ambiguous";
      readonly query: string;
      readonly matches: readonly SkillRegistryEntry[];
    };

export type SkillRegistryErrorCode =
  | "skill_registry.alias_conflict"
  | "skill_registry.duplicate_id"
  | "skill_registry.unknown_id";

export class SkillRegistryError extends Error {
  readonly code: SkillRegistryErrorCode;
  readonly registryId: string;

  constructor(code: SkillRegistryErrorCode, registryId: string) {
    const prefix =
      code === "skill_registry.duplicate_id"
        ? "Duplicate skill registry ID"
        : code === "skill_registry.alias_conflict"
          ? "Conflicting skill alias"
          : "Unknown skill registry ID";
    super(`${prefix}: ${registryId}`);
    this.name = "SkillRegistryError";
    this.code = code;
    this.registryId = registryId;
  }
}

export interface SkillRegistry {
  readonly snapshotId: "skills.2.2.0";
  list(): readonly SkillRegistryEntry[];
  get(id: CanonicalSkillId): SkillRegistryEntry;
  resolve(id: string): SkillResolution;
  search(query: string): SkillSearchResult;
}
