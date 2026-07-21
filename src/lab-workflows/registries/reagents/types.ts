import type {
  ChemistryCapabilityId,
  EquipmentCapabilityId
} from "../../capabilities";
import type { ComponentRegistryId } from "../components";
import type {
  ConfigurationSchemaId,
  QuantityPresetId
} from "../configurations/types";
import type { SafetyRegistryId } from "../safety/types";

export type ReagentRegistryId =
  | "reagent.acetic_acid_0_100m.v1"
  | "reagent.ammonia_0_100m.v1"
  | "reagent.bromothymol_blue.v1"
  | "reagent.distilled_water.v1"
  | "reagent.distilled_water_cold_20c.v1"
  | "reagent.distilled_water_hot_60c.v1"
  | "reagent.hydrochloric_acid_0_100m.v1"
  | "reagent.hydrochloric_acid_titrant_0_100m.v1"
  | "reagent.hydrochloric_acid_aqueous.v1"
  | "reagent.methyl_orange.v1"
  | "reagent.phenolphthalein.v1"
  | "reagent.sodium_hydroxide_0_100m.v1"
  | "reagent.sodium_hydroxide_aqueous.v1"
  | "reagent.sodium_chloride_aqueous.v1"
  | "reagent.sodium_chloride_1_000m.v1"
  | "reagent.silver_nitrate_0_100m.v1"
  | "reagent.sodium_chloride_0_100m.v1"
  | "reagent.ammonium_nitrate_solid.v1"
  | "reagent.calcium_chloride_solid.v1"
  | "reagent.sodium_hydroxide_solid.v1"
  | "reagent.sodium_chloride_solid.v1";

export type MaterialProfileId = ReagentRegistryId;
export type MaterialPhase =
  | "aqueous_solution"
  | "indicator"
  | "pure_liquid"
  | "solid";
export type MaterialAvailability = "declared" | "verified" | "restricted";
export type MaterialUsageMode = "legacy_action_parameter" | "material_binding";

export type AcidBaseDissociationProfile =
  | { readonly type: "strong_acid" }
  | { readonly type: "strong_base" }
  | { readonly type: "weak_acid"; readonly pKa25C: number }
  | { readonly type: "weak_base"; readonly pKb25C: number };

export interface MaterialProfile {
  readonly id: ReagentRegistryId;
  readonly version: "1.0.0";
  readonly displayName: string;
  readonly phase: MaterialPhase;
  readonly usageModes: readonly MaterialUsageMode[];
  readonly providedChemistryCapabilityIds: readonly ChemistryCapabilityId[];
  /** Every listed capability is required of a compatible container. */
  readonly compatibleContainerCapabilityIds: readonly EquipmentCapabilityId[];
  readonly initializationPresetSchemaId: Extract<
    ConfigurationSchemaId,
    | "schema.material_initialization.aqueous_solution.v1"
    | "schema.material_initialization.indicator.v1"
    | "schema.material_initialization.pure_liquid.v1"
    | "schema.material_initialization.solid.v1"
  >;
  readonly quantityPresetIds: readonly QuantityPresetId[];
  readonly safetyPolicyIds: readonly SafetyRegistryId[];
  readonly availability: MaterialAvailability;
  /** Published formula mass used by deterministic mass-to-mole conversion. */
  readonly molarMassGPerMol?: number | null;
  /** Registered monoprotic behavior at 25 °C; null for non-acid/base materials. */
  readonly acidBaseDissociation?: AcidBaseDissociationProfile | null;
  readonly concentrationAuthoring?: {
    readonly configurationSchemaId: "schema.material_initialization.bounded_concentration.v1";
    readonly unitId: "unit.mol_per_l.v1";
    readonly minimumDecimalValue: string;
    readonly maximumDecimalValue: string;
    readonly maximumDecimalPlaces: number;
    readonly requiredChemistryCapabilityId:
      | "chemistry.concentration_dilution.v1"
      | "chemistry.acid_base_equilibrium.v1";
    readonly safetyPolicyIds: readonly SafetyRegistryId[];
  };
}

/**
 * The material profile is evolved in place. These fields remain the exact v1
 * reagent compatibility contract until the v2 validator is introduced.
 */
export interface ReagentRegistryEntry extends MaterialProfile {
  readonly profileKind: MaterialPhase;
  readonly concentrationM: number | null;
  /** Registered Celsius temperature for thermal water sources; null otherwise. */
  readonly initialTemperatureC: number | null;
  readonly compatibleContainerComponentIds: readonly ComponentRegistryId[];
  readonly compatibleEngineIds: readonly string[];
  readonly compatibleFamilyIds: readonly string[];
  readonly allowedRoleIds: readonly (
    | "analyte"
    | "indicator"
    | "diluent"
    | "rinse_solvent"
    | "stock_solution"
    | "solid_sample"
    | "titrant"
  )[];
  readonly requestedAmountLimits: readonly {
    readonly unitId: "unit.drop.v1" | "unit.g.v1" | "unit.ml.v1";
    readonly minimum: number;
    readonly maximum: number;
  }[];
  readonly safetyConstraintIds: readonly SafetyRegistryId[];
}

export function materialIsVerified(
  profile: Pick<MaterialProfile, "availability">
): boolean {
  return profile.availability === "verified";
}

export function materialSupportsContainerCapabilities(
  profile: Pick<MaterialProfile, "compatibleContainerCapabilityIds">,
  containerCapabilityIds: readonly EquipmentCapabilityId[]
): boolean {
  return profile.compatibleContainerCapabilityIds.every((capabilityId) =>
    containerCapabilityIds.includes(capabilityId)
  );
}
