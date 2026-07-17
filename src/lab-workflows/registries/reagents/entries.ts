import type { ReagentRegistryEntry } from "./types";

const ENGINE = ["engine.titration.v1"] as const;
const FAMILY = ["family.acid_base_titration.v1"] as const;
const SAFETY = ["safety.virtual_titration_ppe_notice.v1"] as const;

export const REAGENT_REGISTRY_ENTRIES = [
  {
    id: "reagent.hydrochloric_acid_0_100m.v1",
    version: "1.0.0",
    displayName: "0.100 M hydrochloric acid",
    profileKind: "aqueous_solution",
    concentrationM: 0.1,
    compatibleContainerComponentIds: ["component.erlenmeyer_flask.v1"],
    compatibleEngineIds: ENGINE,
    compatibleFamilyIds: FAMILY,
    allowedRoleIds: ["analyte"],
    requestedAmountLimits: [
      { unitId: "unit.ml.v1", minimum: 0.01, maximum: 125 }
    ],
    safetyConstraintIds: SAFETY,
    availability: "verified"
  },
  {
    id: "reagent.sodium_hydroxide_0_100m.v1",
    version: "1.0.0",
    displayName: "0.100 M sodium hydroxide",
    profileKind: "aqueous_solution",
    concentrationM: 0.1,
    compatibleContainerComponentIds: [
      "component.reagent_bottle.v1",
      "component.burette.v1"
    ],
    compatibleEngineIds: ENGINE,
    compatibleFamilyIds: FAMILY,
    allowedRoleIds: ["titrant"],
    requestedAmountLimits: [
      { unitId: "unit.ml.v1", minimum: 0.01, maximum: 50 }
    ],
    safetyConstraintIds: SAFETY,
    availability: "verified"
  },
  {
    id: "reagent.phenolphthalein.v1",
    version: "1.0.0",
    displayName: "Phenolphthalein indicator",
    profileKind: "indicator",
    concentrationM: null,
    compatibleContainerComponentIds: ["component.indicator_bottle.v1"],
    compatibleEngineIds: ENGINE,
    compatibleFamilyIds: FAMILY,
    allowedRoleIds: ["indicator"],
    requestedAmountLimits: [{ unitId: "unit.drop.v1", minimum: 1, maximum: 2 }],
    safetyConstraintIds: SAFETY,
    availability: "verified"
  }
] as const satisfies readonly ReagentRegistryEntry[];
