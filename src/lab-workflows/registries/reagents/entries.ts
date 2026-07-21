import type { ReagentRegistryEntry } from "./types";

const ENGINE = ["engine.titration.v1"] as const;
const FAMILY = ["family.acid_base_titration.v1"] as const;
const SAFETY = ["safety.virtual_titration_ppe_notice.v1"] as const;
const SOLUTION_SAFETY = [
  "safety.virtual_solution_preparation_ppe_notice.v1"
] as const;

/*
 * Monoprotic dissociation data at 25 °C:
 * - Acetic acid pKa 4.756: NIST critically selected ionization data,
 *   https://www.nist.gov/system/files/documents/srd/jpcrd615.pdf
 * - Aqueous ammonia pKb 4.751: CRC value reproduced by the U.S. ATSDR,
 *   https://www.ncbi.nlm.nih.gov/books/NBK598719/
 * Strong HCl and NaOH are represented as fully dissociated at the dilute
 * school-lab concentrations registered below, the standard AP-chemistry model.
 */
export const ACID_BASE_DISSOCIATION_25C = Object.freeze({
  aceticAcid: { type: "weak_acid", pKa25C: 4.756 } as const,
  ammonia: { type: "weak_base", pKb25C: 4.751 } as const,
  hydrochloricAcid: { type: "strong_acid" } as const,
  sodiumHydroxide: { type: "strong_base" } as const
});

/*
 * Formula masses from NIST Chemistry WebBook SRD 69 (accessed 2026-07-20):
 * NH4NO3 https://webbook.nist.gov/cgi/cbook.cgi?ID=C6484522
 * CaCl2 https://webbook.nist.gov/cgi/cbook.cgi?ID=C10043524
 * NaOH https://webbook.nist.gov/cgi/cbook.cgi?ID=C1310732
 * NaCl https://webbook.nist.gov/cgi/cbook.cgi?ID=C7647145
 * Values are retained at NIST's published precision; the display layer may
 * round, but engine mass-to-mole conversion must not substitute nicer values.
 */
export const SOLID_MOLAR_MASS_G_PER_MOL = Object.freeze({
  "reagent.ammonium_nitrate_solid.v1": 80.0434,
  "reagent.calcium_chloride_solid.v1": 110.984,
  "reagent.sodium_hydroxide_solid.v1": 39.9971,
  "reagent.sodium_chloride_solid.v1": 58.44277
} as const);

function solid(
  id: keyof typeof SOLID_MOLAR_MASS_G_PER_MOL,
  displayName: string,
  quantityPresetId:
    | "quantity-preset.ammonium_nitrate_2_50g.v1"
    | "quantity-preset.calcium_chloride_2_50g.v1"
    | "quantity-preset.sodium_hydroxide_2_50g.v1"
    | "quantity-preset.sodium_chloride_2_50g.v1"
): ReagentRegistryEntry {
  return {
    id,
    version: "1.0.0",
    displayName,
    phase: "solid",
    usageModes: ["material_binding"],
    providedChemistryCapabilityIds: ["chemistry.thermal_energy.v1"],
    compatibleContainerCapabilityIds: ["capability.contain_solid.v1"],
    initializationPresetSchemaId: "schema.material_initialization.solid.v1",
    quantityPresetIds: [quantityPresetId],
    safetyPolicyIds: ["safety.virtual_calorimetry_ppe_notice.v1"],
    availability: "verified",
    molarMassGPerMol: SOLID_MOLAR_MASS_G_PER_MOL[id],
    profileKind: "solid",
    concentrationM: null,
    initialTemperatureC: null,
    compatibleContainerComponentIds: [
      "component.reagent_bottle.v1",
      "component.weighing_boat.v1",
      "component.calorimeter.v1"
    ],
    compatibleEngineIds: [],
    compatibleFamilyIds: [],
    allowedRoleIds: ["solid_sample"],
    requestedAmountLimits: [
      { unitId: "unit.g.v1", minimum: 0.0001, maximum: 100 }
    ],
    safetyConstraintIds: ["safety.virtual_calorimetry_ppe_notice.v1"]
  };
}

export const REAGENT_REGISTRY_ENTRIES = [
  solid(
    "reagent.ammonium_nitrate_solid.v1",
    "Ammonium nitrate solid",
    "quantity-preset.ammonium_nitrate_2_50g.v1"
  ),
  solid(
    "reagent.calcium_chloride_solid.v1",
    "Anhydrous calcium chloride solid",
    "quantity-preset.calcium_chloride_2_50g.v1"
  ),
  solid(
    "reagent.sodium_hydroxide_solid.v1",
    "Sodium hydroxide solid",
    "quantity-preset.sodium_hydroxide_2_50g.v1"
  ),
  solid(
    "reagent.sodium_chloride_solid.v1",
    "Sodium chloride solid",
    "quantity-preset.sodium_chloride_2_50g.v1"
  ),
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
    initialTemperatureC: null,
    compatibleContainerComponentIds: ["component.erlenmeyer_flask.v1"],
    compatibleEngineIds: ENGINE,
    compatibleFamilyIds: FAMILY,
    allowedRoleIds: ["analyte"],
    requestedAmountLimits: [
      { unitId: "unit.ml.v1", minimum: 0.01, maximum: 125 }
    ],
    safetyConstraintIds: SAFETY,
    availability: "verified",
    acidBaseDissociation: ACID_BASE_DISSOCIATION_25C.hydrochloricAcid
  },
  {
    id: "reagent.hydrochloric_acid_titrant_0_100m.v1",
    version: "1.0.0",
    displayName: "0.100 M hydrochloric acid titrant",
    phase: "aqueous_solution",
    usageModes: ["material_binding"],
    providedChemistryCapabilityIds: ["chemistry.acid_base_equilibrium.v1"],
    compatibleContainerCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.dispense_liquid.v1"
    ],
    initializationPresetSchemaId:
      "schema.material_initialization.aqueous_solution.v1",
    quantityPresetIds: ["quantity-preset.hydrochloric_acid_0_100m_50ml.v1"],
    safetyPolicyIds: SAFETY,
    profileKind: "aqueous_solution",
    concentrationM: 0.1,
    initialTemperatureC: null,
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
    availability: "verified",
    acidBaseDissociation: ACID_BASE_DISSOCIATION_25C.hydrochloricAcid
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
    initialTemperatureC: null,
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
    availability: "verified",
    acidBaseDissociation: ACID_BASE_DISSOCIATION_25C.sodiumHydroxide
  },
  {
    id: "reagent.hydrochloric_acid_aqueous.v1",
    version: "1.0.0",
    displayName: "Hydrochloric acid solution",
    phase: "aqueous_solution",
    usageModes: ["material_binding"],
    providedChemistryCapabilityIds: ["chemistry.acid_base_equilibrium.v1"],
    compatibleContainerCapabilityIds: ["capability.receive_liquid.v1"],
    initializationPresetSchemaId:
      "schema.material_initialization.aqueous_solution.v1",
    quantityPresetIds: ["quantity-preset.hydrochloric_acid_solution_25ml.v1"],
    safetyPolicyIds: SAFETY,
    concentrationAuthoring: {
      configurationSchemaId:
        "schema.material_initialization.bounded_concentration.v1",
      unitId: "unit.mol_per_l.v1",
      minimumDecimalValue: "0.05",
      maximumDecimalValue: "0.25",
      maximumDecimalPlaces: 4,
      requiredChemistryCapabilityId: "chemistry.acid_base_equilibrium.v1",
      safetyPolicyIds: SAFETY
    },
    profileKind: "aqueous_solution",
    concentrationM: null,
    initialTemperatureC: null,
    compatibleContainerComponentIds: ["component.erlenmeyer_flask.v1"],
    compatibleEngineIds: ENGINE,
    compatibleFamilyIds: FAMILY,
    allowedRoleIds: ["analyte"],
    requestedAmountLimits: [
      { unitId: "unit.ml.v1", minimum: 0.01, maximum: 125 }
    ],
    safetyConstraintIds: SAFETY,
    availability: "verified",
    acidBaseDissociation: ACID_BASE_DISSOCIATION_25C.hydrochloricAcid
  },
  {
    id: "reagent.sodium_hydroxide_aqueous.v1",
    version: "1.0.0",
    displayName: "Sodium hydroxide solution",
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
      "quantity-preset.sodium_hydroxide_solution_25ml.v1",
      "quantity-preset.sodium_hydroxide_solution_50ml.v1"
    ],
    safetyPolicyIds: SAFETY,
    concentrationAuthoring: {
      configurationSchemaId:
        "schema.material_initialization.bounded_concentration.v1",
      unitId: "unit.mol_per_l.v1",
      minimumDecimalValue: "0.05",
      maximumDecimalValue: "0.25",
      maximumDecimalPlaces: 4,
      requiredChemistryCapabilityId: "chemistry.acid_base_equilibrium.v1",
      safetyPolicyIds: SAFETY
    },
    profileKind: "aqueous_solution",
    concentrationM: null,
    initialTemperatureC: null,
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
    availability: "verified",
    acidBaseDissociation: ACID_BASE_DISSOCIATION_25C.sodiumHydroxide
  },
  {
    id: "reagent.acetic_acid_0_100m.v1",
    version: "1.0.0",
    displayName: "0.100 M acetic acid",
    phase: "aqueous_solution",
    usageModes: ["material_binding"],
    providedChemistryCapabilityIds: ["chemistry.acid_base_equilibrium.v1"],
    compatibleContainerCapabilityIds: ["capability.receive_liquid.v1"],
    initializationPresetSchemaId:
      "schema.material_initialization.aqueous_solution.v1",
    quantityPresetIds: ["quantity-preset.acetic_acid_0_100m_25ml.v1"],
    safetyPolicyIds: SAFETY,
    profileKind: "aqueous_solution",
    concentrationM: 0.1,
    initialTemperatureC: null,
    compatibleContainerComponentIds: ["component.erlenmeyer_flask.v1"],
    compatibleEngineIds: ENGINE,
    compatibleFamilyIds: FAMILY,
    allowedRoleIds: ["analyte"],
    requestedAmountLimits: [
      { unitId: "unit.ml.v1", minimum: 0.01, maximum: 125 }
    ],
    safetyConstraintIds: SAFETY,
    availability: "verified",
    acidBaseDissociation: ACID_BASE_DISSOCIATION_25C.aceticAcid
  },
  {
    id: "reagent.ammonia_0_100m.v1",
    version: "1.0.0",
    displayName: "0.100 M aqueous ammonia",
    phase: "aqueous_solution",
    usageModes: ["material_binding"],
    providedChemistryCapabilityIds: ["chemistry.acid_base_equilibrium.v1"],
    compatibleContainerCapabilityIds: ["capability.receive_liquid.v1"],
    initializationPresetSchemaId:
      "schema.material_initialization.aqueous_solution.v1",
    quantityPresetIds: [
      "quantity-preset.ammonia_0_100m_25ml.v1",
      "quantity-preset.ammonia_0_100m_50ml.v1"
    ],
    safetyPolicyIds: SAFETY,
    profileKind: "aqueous_solution",
    concentrationM: 0.1,
    initialTemperatureC: null,
    compatibleContainerComponentIds: [
      "component.erlenmeyer_flask.v1",
      "component.reagent_bottle.v1",
      "component.burette.v1"
    ],
    compatibleEngineIds: ENGINE,
    compatibleFamilyIds: FAMILY,
    allowedRoleIds: ["analyte", "titrant"],
    requestedAmountLimits: [
      { unitId: "unit.ml.v1", minimum: 0.01, maximum: 125 }
    ],
    safetyConstraintIds: SAFETY,
    availability: "verified",
    acidBaseDissociation: ACID_BASE_DISSOCIATION_25C.ammonia
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
    initialTemperatureC: null,
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
    initialTemperatureC: null,
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
    initialTemperatureC: null,
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
    initialTemperatureC: null,
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
    id: "reagent.distilled_water_cold_20c.v1",
    version: "1.0.0",
    displayName: "Distilled water at 20.0 °C",
    phase: "pure_liquid",
    usageModes: ["material_binding"],
    providedChemistryCapabilityIds: ["chemistry.thermal_energy.v1"],
    compatibleContainerCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.dispense_liquid.v1"
    ],
    initializationPresetSchemaId:
      "schema.material_initialization.pure_liquid.v1",
    quantityPresetIds: [
      "quantity-preset.distilled_water_cold_20c_100ml.v1",
      "quantity-preset.distilled_water_cold_20c_50ml.v1"
    ],
    safetyPolicyIds: ["safety.virtual_calorimetry_ppe_notice.v1"],
    profileKind: "pure_liquid",
    concentrationM: null,
    initialTemperatureC: 20,
    compatibleContainerComponentIds: [
      "component.reagent_bottle.v1",
      "component.wash_bottle.v1"
    ],
    compatibleEngineIds: [],
    compatibleFamilyIds: [],
    allowedRoleIds: ["diluent"],
    requestedAmountLimits: [
      { unitId: "unit.ml.v1", minimum: 0.01, maximum: 250 }
    ],
    safetyConstraintIds: ["safety.virtual_calorimetry_ppe_notice.v1"],
    availability: "verified"
  },
  {
    id: "reagent.distilled_water_hot_60c.v1",
    version: "1.0.0",
    displayName: "Distilled water at 60.0 °C",
    phase: "pure_liquid",
    usageModes: ["material_binding"],
    providedChemistryCapabilityIds: ["chemistry.thermal_energy.v1"],
    compatibleContainerCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.dispense_liquid.v1"
    ],
    initializationPresetSchemaId:
      "schema.material_initialization.pure_liquid.v1",
    quantityPresetIds: [
      "quantity-preset.distilled_water_hot_60c_100ml.v1",
      "quantity-preset.distilled_water_hot_60c_50ml.v1"
    ],
    safetyPolicyIds: ["safety.virtual_calorimetry_ppe_notice.v1"],
    profileKind: "pure_liquid",
    concentrationM: null,
    initialTemperatureC: 60,
    compatibleContainerComponentIds: [
      "component.reagent_bottle.v1",
      "component.wash_bottle.v1"
    ],
    compatibleEngineIds: [],
    compatibleFamilyIds: [],
    allowedRoleIds: ["diluent"],
    requestedAmountLimits: [
      { unitId: "unit.ml.v1", minimum: 0.01, maximum: 250 }
    ],
    safetyConstraintIds: ["safety.virtual_calorimetry_ppe_notice.v1"],
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
    initialTemperatureC: null,
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
    id: "reagent.silver_nitrate_0_100m.v1",
    version: "1.0.0",
    displayName: "0.100 M silver nitrate solution",
    phase: "aqueous_solution",
    usageModes: ["material_binding"],
    providedChemistryCapabilityIds: ["chemistry.precipitation_solubility.v1"],
    compatibleContainerCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.dispense_liquid.v1"
    ],
    initializationPresetSchemaId:
      "schema.material_initialization.aqueous_solution.v1",
    quantityPresetIds: ["quantity-preset.silver_nitrate_0_100m_50ml.v1"],
    safetyPolicyIds: SOLUTION_SAFETY,
    profileKind: "aqueous_solution",
    concentrationM: 0.1,
    initialTemperatureC: null,
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
    id: "reagent.sodium_chloride_0_100m.v1",
    version: "1.0.0",
    displayName: "0.100 M sodium chloride solution",
    phase: "aqueous_solution",
    usageModes: ["material_binding"],
    providedChemistryCapabilityIds: ["chemistry.precipitation_solubility.v1"],
    compatibleContainerCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.dispense_liquid.v1"
    ],
    initializationPresetSchemaId:
      "schema.material_initialization.aqueous_solution.v1",
    quantityPresetIds: ["quantity-preset.sodium_chloride_0_100m_50ml.v1"],
    safetyPolicyIds: SOLUTION_SAFETY,
    profileKind: "aqueous_solution",
    concentrationM: 0.1,
    initialTemperatureC: null,
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
    initialTemperatureC: null,
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
