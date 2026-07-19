import type { ReagentRegistryEntry } from "./types";

const ENGINE = ["engine.titration.v1"] as const;
const FAMILY = ["family.acid_base_titration.v1"] as const;
const SAFETY = ["safety.virtual_titration_ppe_notice.v1"] as const;
const SOLUTION_SAFETY = [
  "safety.virtual_solution_preparation_ppe_notice.v1"
] as const;

export const REAGENT_REGISTRY_ENTRIES = [
  {
    id: "reagent.hydrochloric_acid_0_100m.v1",
    version: "1.0.0",
    displayName: "0.100 M hydrochloric acid",
    phase: "aqueous_solution",
    usageModes: ["material_binding"],
    providedChemistryCapabilityIds: ["chemistry.acid_base_equilibrium.v1"],
    compatibleContainerCapabilityIds: ["capability.receive_liquid.v1"],
    initializationPresetSchemaId:
      "schema.material_initialization.aqueous_solution.v1",
    quantityPresetIds: ["quantity-preset.hydrochloric_acid_0_100m_25ml.v1"],
    safetyPolicyIds: SAFETY,
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
    phase: "aqueous_solution",
    usageModes: ["material_binding"],
    providedChemistryCapabilityIds: ["chemistry.acid_base_equilibrium.v1"],
    compatibleContainerCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.dispense_liquid.v1"
    ],
    initializationPresetSchemaId:
      "schema.material_initialization.aqueous_solution.v1",
    quantityPresetIds: [
      "quantity-preset.sodium_hydroxide_0_100m_25ml.v1",
      "quantity-preset.sodium_hydroxide_0_100m_50ml.v1"
    ],
    safetyPolicyIds: SAFETY,
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
    phase: "indicator",
    usageModes: ["material_binding", "legacy_action_parameter"],
    providedChemistryCapabilityIds: ["chemistry.indicator_response.v1"],
    compatibleContainerCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.dispense_liquid.v1"
    ],
    initializationPresetSchemaId: "schema.material_initialization.indicator.v1",
    quantityPresetIds: [
      "quantity-preset.phenolphthalein_1_drop.v1",
      "quantity-preset.phenolphthalein_2_drops.v1"
    ],
    safetyPolicyIds: SAFETY,
    profileKind: "indicator",
    concentrationM: null,
    compatibleContainerComponentIds: ["component.indicator_bottle.v1"],
    compatibleEngineIds: ENGINE,
    compatibleFamilyIds: FAMILY,
    allowedRoleIds: ["indicator"],
    requestedAmountLimits: [{ unitId: "unit.drop.v1", minimum: 1, maximum: 2 }],
    safetyConstraintIds: SAFETY,
    availability: "verified"
  },
  {
    id: "reagent.bromothymol_blue.v1",
    version: "1.0.0",
    displayName: "Bromothymol blue indicator",
    phase: "indicator",
    usageModes: ["material_binding", "legacy_action_parameter"],
    providedChemistryCapabilityIds: ["chemistry.indicator_response.v1"],
    compatibleContainerCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.dispense_liquid.v1"
    ],
    initializationPresetSchemaId: "schema.material_initialization.indicator.v1",
    quantityPresetIds: [
      "quantity-preset.bromothymol_blue_1_drop.v1",
      "quantity-preset.bromothymol_blue_2_drops.v1"
    ],
    safetyPolicyIds: SAFETY,
    profileKind: "indicator",
    concentrationM: null,
    compatibleContainerComponentIds: ["component.indicator_bottle.v1"],
    compatibleEngineIds: ENGINE,
    compatibleFamilyIds: FAMILY,
    allowedRoleIds: ["indicator"],
    requestedAmountLimits: [{ unitId: "unit.drop.v1", minimum: 1, maximum: 2 }],
    safetyConstraintIds: SAFETY,
    availability: "verified"
  },
  {
    id: "reagent.methyl_orange.v1",
    version: "1.0.0",
    displayName: "Methyl orange indicator",
    phase: "indicator",
    usageModes: ["material_binding", "legacy_action_parameter"],
    providedChemistryCapabilityIds: ["chemistry.indicator_response.v1"],
    compatibleContainerCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.dispense_liquid.v1"
    ],
    initializationPresetSchemaId: "schema.material_initialization.indicator.v1",
    quantityPresetIds: [
      "quantity-preset.methyl_orange_1_drop.v1",
      "quantity-preset.methyl_orange_2_drops.v1"
    ],
    safetyPolicyIds: SAFETY,
    profileKind: "indicator",
    concentrationM: null,
    compatibleContainerComponentIds: ["component.indicator_bottle.v1"],
    compatibleEngineIds: ENGINE,
    compatibleFamilyIds: FAMILY,
    allowedRoleIds: ["indicator"],
    requestedAmountLimits: [{ unitId: "unit.drop.v1", minimum: 1, maximum: 2 }],
    safetyConstraintIds: SAFETY,
    availability: "verified"
  },
  {
    id: "reagent.distilled_water.v1",
    version: "1.0.0",
    displayName: "Distilled water",
    phase: "pure_liquid",
    usageModes: ["material_binding", "legacy_action_parameter"],
    providedChemistryCapabilityIds: [],
    compatibleContainerCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.dispense_liquid.v1"
    ],
    initializationPresetSchemaId:
      "schema.material_initialization.pure_liquid.v1",
    quantityPresetIds: [
      "quantity-preset.distilled_water_250ml.v1",
      "quantity-preset.distilled_water_50ml.v1"
    ],
    safetyPolicyIds: [],
    profileKind: "pure_liquid",
    concentrationM: null,
    compatibleContainerComponentIds: [
      "component.reagent_bottle.v1",
      "component.wash_bottle.v1"
    ],
    compatibleEngineIds: ENGINE,
    compatibleFamilyIds: FAMILY,
    allowedRoleIds: ["rinse_solvent", "diluent"],
    requestedAmountLimits: [
      { unitId: "unit.ml.v1", minimum: 0.01, maximum: 250 }
    ],
    safetyConstraintIds: [],
    availability: "verified"
  },
  {
    id: "reagent.sodium_chloride_aqueous.v1",
    version: "1.0.0",
    displayName: "Sodium chloride solution",
    phase: "aqueous_solution",
    usageModes: ["material_binding"],
    providedChemistryCapabilityIds: ["chemistry.concentration_dilution.v1"],
    compatibleContainerCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.dispense_liquid.v1"
    ],
    initializationPresetSchemaId:
      "schema.material_initialization.aqueous_solution.v1",
    quantityPresetIds: ["quantity-preset.sodium_chloride_solution_50ml.v1"],
    safetyPolicyIds: SOLUTION_SAFETY,
    concentrationAuthoring: {
      configurationSchemaId:
        "schema.material_initialization.bounded_concentration.v1",
      unitId: "unit.mol_per_l.v1",
      minimumDecimalValue: "0.1",
      maximumDecimalValue: "1",
      maximumDecimalPlaces: 4,
      requiredChemistryCapabilityId: "chemistry.concentration_dilution.v1",
      safetyPolicyIds: SOLUTION_SAFETY
    },
    profileKind: "aqueous_solution",
    concentrationM: null,
    compatibleContainerComponentIds: ["component.reagent_bottle.v1"],
    compatibleEngineIds: [],
    compatibleFamilyIds: [],
    allowedRoleIds: ["stock_solution"],
    requestedAmountLimits: [
      { unitId: "unit.ml.v1", minimum: 0.01, maximum: 50 }
    ],
    safetyConstraintIds: SOLUTION_SAFETY,
    availability: "verified"
  },
  {
    id: "reagent.sodium_chloride_1_000m.v1",
    version: "1.0.0",
    displayName: "1.000 M sodium chloride stock solution",
    phase: "aqueous_solution",
    usageModes: ["material_binding"],
    providedChemistryCapabilityIds: ["chemistry.concentration_dilution.v1"],
    compatibleContainerCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.dispense_liquid.v1"
    ],
    initializationPresetSchemaId:
      "schema.material_initialization.aqueous_solution.v1",
    quantityPresetIds: ["quantity-preset.sodium_chloride_1_000m_50ml.v1"],
    safetyPolicyIds: SOLUTION_SAFETY,
    profileKind: "aqueous_solution",
    concentrationM: 1,
    compatibleContainerComponentIds: ["component.reagent_bottle.v1"],
    compatibleEngineIds: [],
    compatibleFamilyIds: [],
    allowedRoleIds: ["stock_solution"],
    requestedAmountLimits: [
      { unitId: "unit.ml.v1", minimum: 0.01, maximum: 50 }
    ],
    safetyConstraintIds: SOLUTION_SAFETY,
    availability: "verified"
  }
] as const satisfies readonly ReagentRegistryEntry[];
