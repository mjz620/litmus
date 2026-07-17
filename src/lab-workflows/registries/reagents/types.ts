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
  | "reagent.hydrochloric_acid_0_100m.v1"
  | "reagent.phenolphthalein.v1"
  | "reagent.sodium_hydroxide_0_100m.v1";

export type MaterialProfileId = ReagentRegistryId;
export type MaterialPhase = "aqueous_solution" | "indicator" | "pure_liquid";
export type MaterialAvailability = "declared" | "verified" | "restricted";

export interface MaterialProfile {
  readonly id: ReagentRegistryId;
  readonly version: "1.0.0";
  readonly displayName: string;
  readonly phase: MaterialPhase;
  readonly providedChemistryCapabilityIds: readonly ChemistryCapabilityId[];
  /** Every listed capability is required of a compatible container. */
  readonly compatibleContainerCapabilityIds: readonly EquipmentCapabilityId[];
  readonly initializationPresetSchemaId: Extract<
    ConfigurationSchemaId,
    | "schema.material_initialization.aqueous_solution.v1"
    | "schema.material_initialization.indicator.v1"
  >;
  readonly quantityPresetIds: readonly QuantityPresetId[];
  readonly safetyPolicyIds: readonly SafetyRegistryId[];
  readonly availability: MaterialAvailability;
}

/**
 * The material profile is evolved in place. These fields remain the exact v1
 * reagent compatibility contract until the v2 validator is introduced.
 */
export interface ReagentRegistryEntry extends MaterialProfile {
  readonly profileKind: "aqueous_solution" | "indicator";
  readonly concentrationM: number | null;
  readonly compatibleContainerComponentIds: readonly ComponentRegistryId[];
  readonly compatibleEngineIds: readonly ["engine.titration.v1"];
  readonly compatibleFamilyIds: readonly ["family.acid_base_titration.v1"];
  readonly allowedRoleIds: readonly ("analyte" | "indicator" | "titrant")[];
  readonly requestedAmountLimits: readonly {
    readonly unitId: "unit.drop.v1" | "unit.ml.v1";
    readonly minimum: number;
    readonly maximum: number;
  }[];
  readonly safetyConstraintIds: readonly [
    "safety.virtual_titration_ppe_notice.v1"
  ];
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
