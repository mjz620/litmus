import type { ComponentRegistryId } from "../components";

export type ReagentRegistryId =
  | "reagent.hydrochloric_acid_0_100m.v1"
  | "reagent.phenolphthalein.v1"
  | "reagent.sodium_hydroxide_0_100m.v1";

export interface ReagentRegistryEntry {
  readonly id: ReagentRegistryId;
  readonly version: "1.0.0";
  readonly displayName: string;
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
  readonly availability: "verified";
}
