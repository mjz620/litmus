import type {
  ConfigurationAvailability,
  ConfigurationRegistryEntry,
  ConfigurationSchemaId,
  ConfigurationSchemaRegistryEntry,
  ConfigurationScope,
  LegacyConfigurationCategory,
  LegacyConfigurationRegistryEntry,
  QuantityPresetId,
  QuantityPresetRegistryEntry
} from "./types";

const FAMILY = ["family.acid_base_titration.v1"] as const;

function entry(
  id: string,
  category: LegacyConfigurationCategory,
  description: string,
  options: {
    readonly adapterKey?: string;
    readonly availability?: ConfigurationAvailability;
    readonly compatibleActionIds?: readonly string[];
    readonly compatibleComponentIds?: readonly string[];
    readonly compatibleFamilyIds?: readonly string[];
    readonly schemaId?: ConfigurationSchemaId;
    readonly scope?: ConfigurationScope;
  } = {}
): LegacyConfigurationRegistryEntry {
  return {
    id,
    version: "1.0.0",
    category,
    description,
    compatibleFamilyIds: options.compatibleFamilyIds ?? FAMILY,
    compatibleActionIds: options.compatibleActionIds ?? [],
    compatibleComponentIds: options.compatibleComponentIds ?? [],
    adapterKey: options.adapterKey ?? null,
    availability: options.availability ?? "verified",
    scope: options.scope ?? null,
    schemaId: options.schemaId ?? null
  };
}

function schema(
  id: ConfigurationSchemaId,
  scope: ConfigurationScope,
  description: string,
  availability: ConfigurationAvailability = "declared"
): ConfigurationSchemaRegistryEntry {
  return {
    id,
    version: "1.0.0",
    category: "configuration_schema",
    description,
    compatibleFamilyIds: [],
    compatibleActionIds: [],
    compatibleComponentIds: [],
    adapterKey: null,
    availability,
    scope,
    schemaId: null,
    strict: true
  };
}

function quantity(
  id: QuantityPresetId,
  amount: number,
  unitId: QuantityPresetRegistryEntry["unitId"],
  compatibleMaterialProfileIds: QuantityPresetRegistryEntry["compatibleMaterialProfileIds"]
): QuantityPresetRegistryEntry {
  return {
    id,
    version: "1.0.0",
    category: "quantity_preset",
    description: `Exact code-owned ${amount} ${unitId} material quantity preset.`,
    compatibleFamilyIds: [],
    compatibleActionIds: [],
    compatibleComponentIds: [],
    adapterKey: null,
    availability: "verified",
    scope: "quantity",
    schemaId:
      unitId === "unit.ml.v1"
        ? "schema.quantity.volume_ml.v1"
        : "schema.quantity.drop_count.v1",
    amount,
    unitId,
    compatibleMaterialProfileIds
  };
}

export const CONFIGURATION_REGISTRY_ENTRIES = [
  entry(
    "engine_config.titration.strong_acid_strong_base_25ml.v1",
    "engine_configuration",
    "Verified 25.0 mL strong-acid/strong-base titration profile.",
    {
      adapterKey: "EXAMPLE_STRONG",
      scope: "model",
      schemaId: "schema.model_configuration.strong_acid_strong_base_25ml.v1"
    }
  ),
  entry(
    "seed.titration.near_endpoint_22ml.v1",
    "seed_template",
    "Verified endpoint-control seed with 22.00 mL already delivered.",
    {
      adapterKey: "createTitrationRetryScenario:endpoint_control",
      scope: "model",
      schemaId: "schema.model_configuration.strong_acid_strong_base_25ml.v1"
    }
  ),
  entry(
    "component_config.burette.50ml.v1",
    "component_configuration",
    "Verified 50.00 mL burette presentation and measurement configuration.",
    {
      compatibleComponentIds: ["component.burette.v1"],
      scope: "equipment",
      schemaId: "schema.equipment_configuration.burette.v1"
    }
  ),
  entry(
    "component_config.erlenmeyer.125ml.v1",
    "component_configuration",
    "Verified 125 mL Erlenmeyer flask presentation configuration.",
    {
      compatibleComponentIds: ["component.erlenmeyer_flask.v1"],
      scope: "equipment",
      schemaId: "schema.equipment_configuration.erlenmeyer_flask.v1"
    }
  ),
  entry(
    "component_config.indicator_dropper.v1",
    "component_configuration",
    "Verified one-addition indicator dropper configuration.",
    {
      compatibleComponentIds: ["component.indicator_bottle.v1"],
      scope: "equipment",
      schemaId: "schema.equipment_configuration.indicator_bottle.v1"
    }
  ),
  entry(
    "component_config.reagent_bottle.titrant_source.v1",
    "component_configuration",
    "Verified reagent-bottle liquid-source configuration.",
    {
      compatibleComponentIds: ["component.reagent_bottle.v1"],
      compatibleFamilyIds: [],
      scope: "equipment",
      schemaId: "schema.equipment_configuration.reagent_bottle.v1"
    }
  ),
  entry(
    "component_config.reagent_bottle.stock_solution.v1",
    "component_configuration",
    "Verified liquid stock-solution source bottle.",
    {
      compatibleComponentIds: ["component.reagent_bottle.v1"],
      compatibleFamilyIds: [],
      scope: "equipment",
      schemaId: "schema.equipment_configuration.reagent_bottle.v1"
    }
  ),
  entry(
    "component_config.volumetric_pipette.10ml.v1",
    "component_configuration",
    "Verified 10.00 mL volumetric transfer-pipette configuration.",
    {
      compatibleComponentIds: ["component.volumetric_pipette.v1"],
      compatibleFamilyIds: [],
      scope: "equipment",
      schemaId: "schema.equipment_configuration.volumetric_pipette.v1"
    }
  ),
  entry(
    "component_config.volumetric_flask.100ml.v1",
    "component_configuration",
    "Verified 100.00 mL volumetric-flask configuration.",
    {
      compatibleComponentIds: ["component.volumetric_flask.v1"],
      compatibleFamilyIds: [],
      scope: "equipment",
      schemaId: "schema.equipment_configuration.volumetric_flask.v1"
    }
  ),
  entry(
    "component_config.wash_bottle.250ml.v1",
    "component_configuration",
    "Verified 250 mL distilled-water supply bottle configuration.",
    {
      compatibleComponentIds: ["component.wash_bottle.v1"],
      compatibleFamilyIds: [],
      scope: "equipment",
      schemaId: "schema.equipment_configuration.wash_bottle.v1"
    }
  ),
  entry(
    "component_config.calorimeter.coffee_cup_100ml.v1",
    "component_configuration",
    "Verified 100 mL coffee-cup calorimeter configuration.",
    {
      compatibleComponentIds: ["component.calorimeter.v1"],
      compatibleFamilyIds: [],
      scope: "equipment",
      schemaId: "schema.equipment_configuration.calorimeter.v1"
    }
  ),
  entry(
    "component_config.thermometer.digital_0_1c.v1",
    "component_configuration",
    "Verified digital thermometer configuration with 0.1 °C reporting.",
    {
      compatibleComponentIds: ["component.thermometer.v1"],
      compatibleFamilyIds: [],
      scope: "equipment",
      schemaId: "schema.equipment_configuration.thermometer.v1"
    }
  ),
  entry(
    "placement.bench_center_stand.v1",
    "placement",
    "Burette stand placement backed by the current titration bench.",
    {
      compatibleComponentIds: ["component.burette.v1"],
      scope: "layout",
      schemaId: "schema.layout_configuration.titration_bench.v1"
    }
  ),
  entry(
    "placement.bench_center_stand_reversed.v1",
    "placement",
    "Burette stand at the center station with the verified reversed control orientation.",
    {
      compatibleComponentIds: ["component.burette.v1"],
      scope: "layout",
      schemaId: "schema.layout_configuration.titration_bench.v1"
    }
  ),
  entry(
    "placement.bench_left_stand.v1",
    "placement",
    "Burette stand at the verified left dispensing station.",
    {
      compatibleComponentIds: ["component.burette.v1"],
      scope: "layout",
      schemaId: "schema.layout_configuration.titration_bench.v1"
    }
  ),
  entry(
    "placement.bench_left_stand_reversed.v1",
    "placement",
    "Burette stand at the verified left station with reversed controls.",
    {
      compatibleComponentIds: ["component.burette.v1"],
      scope: "layout",
      schemaId: "schema.layout_configuration.titration_bench.v1"
    }
  ),
  entry(
    "placement.under_burette.v1",
    "placement",
    "Receiving-flask placement beneath the current burette.",
    {
      compatibleComponentIds: ["component.erlenmeyer_flask.v1"],
      scope: "layout",
      schemaId: "schema.layout_configuration.titration_bench.v1"
    }
  ),
  entry(
    "placement.under_left_burette.v1",
    "placement",
    "Receiving flask beneath the verified left burette station.",
    {
      compatibleComponentIds: ["component.erlenmeyer_flask.v1"],
      scope: "layout",
      schemaId: "schema.layout_configuration.titration_bench.v1"
    }
  ),
  entry(
    "placement.indicator_shelf.v1",
    "placement",
    "Indicator shelf placement backed by the current titration bench.",
    {
      compatibleComponentIds: ["component.indicator_bottle.v1"],
      scope: "layout",
      schemaId: "schema.layout_configuration.titration_bench.v1"
    }
  ),
  entry(
    "placement.indicator_shelf_right.v1",
    "placement",
    "Indicator shelf at the verified right-side bench anchor.",
    {
      compatibleComponentIds: ["component.indicator_bottle.v1"],
      scope: "layout",
      schemaId: "schema.layout_configuration.titration_bench.v1"
    }
  ),
  entry(
    "placement.reagent_station.v1",
    "placement",
    "Liquid-source placement on the current laboratory preparation station.",
    {
      compatibleComponentIds: ["component.reagent_bottle.v1"],
      compatibleFamilyIds: [],
      scope: "layout",
      schemaId: "schema.layout_configuration.titration_bench.v1"
    }
  ),
  entry(
    "placement.reagent_station_left.v1",
    "placement",
    "Liquid-source supplies at the verified left-side bench anchor.",
    {
      compatibleComponentIds: ["component.reagent_bottle.v1"],
      compatibleFamilyIds: [],
      scope: "layout",
      schemaId: "schema.layout_configuration.titration_bench.v1"
    }
  ),
  entry(
    "placement.solution_pipette_stand.v1",
    "placement",
    "Pipette stand on the verified solution-preparation bench.",
    {
      compatibleComponentIds: ["component.volumetric_pipette.v1"],
      compatibleFamilyIds: [],
      scope: "layout",
      schemaId: "schema.layout_configuration.solution_preparation_bench.v1"
    }
  ),
  entry(
    "placement.solution_flask_center.v1",
    "placement",
    "Volumetric flask at the verified center preparation station.",
    {
      compatibleComponentIds: ["component.volumetric_flask.v1"],
      compatibleFamilyIds: [],
      scope: "layout",
      schemaId: "schema.layout_configuration.solution_preparation_bench.v1"
    }
  ),
  entry(
    "placement.solution_stock_right.v1",
    "placement",
    "Stock-solution bottle on the verified right preparation station.",
    {
      compatibleComponentIds: ["component.reagent_bottle.v1"],
      compatibleFamilyIds: [],
      scope: "layout",
      schemaId: "schema.layout_configuration.solution_preparation_bench.v1"
    }
  ),
  entry(
    "placement.solution_wash_left.v1",
    "placement",
    "Distilled-water bottle on the verified left preparation station.",
    {
      compatibleComponentIds: ["component.wash_bottle.v1"],
      compatibleFamilyIds: [],
      scope: "layout",
      schemaId: "schema.layout_configuration.solution_preparation_bench.v1"
    }
  ),
  entry(
    "placement.calorimeter_center.v1",
    "placement",
    "Coffee-cup calorimeter at the verified calorimetry bench center.",
    {
      compatibleComponentIds: ["component.calorimeter.v1"],
      compatibleFamilyIds: [],
      scope: "layout",
      schemaId: "schema.layout_configuration.calorimetry_bench.v1"
    }
  ),
  entry(
    "placement.calorimetry_thermometer.v1",
    "placement",
    "Digital thermometer beside the verified coffee-cup calorimeter.",
    {
      compatibleComponentIds: ["component.thermometer.v1"],
      compatibleFamilyIds: [],
      scope: "layout",
      schemaId: "schema.layout_configuration.calorimetry_bench.v1"
    }
  ),
  entry(
    "placement.calorimetry_wash_left.v1",
    "placement",
    "Distilled-water supply on the verified calorimetry bench.",
    {
      compatibleComponentIds: ["component.wash_bottle.v1"],
      compatibleFamilyIds: [],
      scope: "layout",
      schemaId: "schema.layout_configuration.calorimetry_bench.v1"
    }
  ),
  entry(
    "placement.calorimetry_stock_right.v1",
    "placement",
    "Registered aqueous stock bottle on the verified calorimetry bench.",
    {
      compatibleComponentIds: ["component.reagent_bottle.v1"],
      compatibleFamilyIds: [],
      scope: "layout",
      schemaId: "schema.layout_configuration.calorimetry_bench.v1"
    }
  ),
  entry(
    "action_params.burette_reading.v1",
    "action_parameters",
    "Burette reading entry bounded to the registered capacity and precision.",
    {
      compatibleActionIds: ["action.read_volume.v1"],
      scope: "action",
      schemaId: "schema.action_parameters.read_volume.v1"
    }
  ),
  entry(
    "action_params.titration_dropwise_or_slow.v1",
    "action_parameters",
    "Existing dropwise-or-slow titrant delivery control profile.",
    {
      compatibleActionIds: ["action.dispense.v1"],
      scope: "action",
      schemaId: "schema.action_parameters.dispense.v1"
    }
  ),
  entry(
    "observable.burette_reading_ml.v1",
    "observable",
    "Engine-owned current burette reading in milliliters.",
    { adapterKey: "currentReadingML" }
  ),
  entry(
    "observable.endpoint_observed.v1",
    "observable",
    "Engine-owned indication that the configured indicator endpoint has been observed.",
    { adapterKey: "endpointObserved" }
  ),
  entry(
    "observable.solution_concentration_m.v1",
    "observable",
    "Deterministic concentration of the bounded volumetric-flask solution, reported to 0.000001 mol/L.",
    {
      adapterKey: "solutionConcentrationM",
      compatibleFamilyIds: []
    }
  ),
  entry(
    "observable.solution_volume_ml.v1",
    "observable",
    "Conserved liquid volume in the bounded volumetric flask, reported to 0.000001 mL.",
    {
      adapterKey: "solutionVolumeML",
      compatibleFamilyIds: []
    }
  ),
  entry(
    "observable.calorimeter_temperature_c.v1",
    "observable",
    "Equilibrium coffee-cup calorimeter temperature in Celsius from conserved thermal energy.",
    {
      adapterKey: "calorimeterTemperatureC",
      compatibleFamilyIds: []
    }
  ),
  entry(
    "observable.calorimeter_heat_content_j.v1",
    "observable",
    "Heat content of calorimeter liquid relative to 0 °C using registered water c and density.",
    {
      adapterKey: "calorimeterHeatContentJ",
      compatibleFamilyIds: []
    }
  ),
  entry(
    "observable.calorimeter_volume_ml.v1",
    "observable",
    "Conserved liquid volume in the coffee-cup calorimeter.",
    {
      adapterKey: "calorimeterVolumeML",
      compatibleFamilyIds: []
    }
  ),
  entry(
    "observation.reported_volume_ml.v1",
    "observation_key",
    "Student-reported burette volume observation.",
    { adapterKey: "reportedML" }
  ),
  entry(
    "observation.observed_color.v1",
    "observation_key",
    "Engine-owned indicator color observation.",
    { adapterKey: "observedColor" }
  ),
  entry(
    "completion.all_required_observations.v1",
    "completion_policy",
    "Complete after all required registered observations are present."
  ),
  entry(
    "completion.engine_endpoint_observed.v1",
    "completion_policy",
    "Complete from the titration engine's endpoint evidence."
  ),
  entry(
    "coach_trigger.mistake_reflection.v1",
    "coach_trigger",
    "Reflective coaching trigger for a registered mistake flag."
  ),
  entry(
    "hint.endpoint_control_graduated.v1",
    "hint_strategy",
    "Existing graduated endpoint-control reflection and hint strategy."
  ),
  entry(
    "assessment.event_plus_entry.v1",
    "assessment_mode",
    "Assess with deterministic event evidence plus a student entry."
  ),
  entry(
    "assessment.event_performance.v1",
    "assessment_mode",
    "Assess directly from deterministic event performance evidence."
  ),
  entry(
    "submission.initial_burette_reading.v1",
    "submission_field",
    "Structured initial burette-reading field."
  ),
  entry(
    "submission.endpoint_reflection.v1",
    "submission_field",
    "Short endpoint-control reflection field."
  ),
  entry(
    "passing.percent_70.v1",
    "passing_policy",
    "Deterministic seventy-percent rubric threshold."
  ),
  entry(
    "retry.endpoint_control_near_endpoint.v1",
    "retry_template",
    "Existing verified endpoint-control retry template.",
    { adapterKey: "createTitrationRetryScenario:endpoint_control" }
  ),
  entry(
    "evidence.controlled_addition_near_endpoint.v1",
    "evidence_reason",
    "Canonical workflow reference for controlled_addition_near_endpoint."
  ),
  entry(
    "device.chromebook_core.v1",
    "device_profile",
    "Demand-rendered core profile for Chromebook-class hardware."
  ),
  entry("unit.ml.v1", "unit", "Milliliter volume unit."),
  entry("unit.drop.v1", "unit", "Bounded indicator drop-count unit."),
  entry("unit.celsius.v1", "unit", "Celsius temperature unit.", {
    compatibleFamilyIds: []
  }),
  entry("unit.joule.v1", "unit", "Joule energy unit.", {
    compatibleFamilyIds: []
  }),
  entry("unit.mol_per_l.v1", "unit", "Moles of solute per liter of solution.", {
    compatibleFamilyIds: []
  }),
  schema(
    "schema.equipment_configuration.burette.v1",
    "equipment",
    "Strict metadata contract for registered burette configurations."
  ),
  schema(
    "schema.equipment_configuration.calorimeter.v1",
    "equipment",
    "Strict metadata contract for registered coffee-cup calorimeter configurations."
  ),
  schema(
    "schema.equipment_configuration.erlenmeyer_flask.v1",
    "equipment",
    "Strict metadata contract for registered Erlenmeyer-flask configurations."
  ),
  schema(
    "schema.equipment_configuration.indicator_bottle.v1",
    "equipment",
    "Strict metadata contract for registered indicator-bottle configurations."
  ),
  schema(
    "schema.equipment_configuration.reagent_bottle.v1",
    "equipment",
    "Strict metadata contract for registered reagent-bottle configurations."
  ),
  schema(
    "schema.equipment_configuration.thermometer.v1",
    "equipment",
    "Strict metadata contract for registered digital-thermometer configurations."
  ),
  schema(
    "schema.equipment_configuration.volumetric_pipette.v1",
    "equipment",
    "Strict metadata contract for registered volumetric-pipette configurations."
  ),
  schema(
    "schema.equipment_configuration.volumetric_flask.v1",
    "equipment",
    "Strict metadata contract for registered volumetric-flask configurations."
  ),
  schema(
    "schema.equipment_configuration.wash_bottle.v1",
    "equipment",
    "Strict metadata contract for registered wash-bottle configurations."
  ),
  schema(
    "schema.layout_configuration.titration_bench.v1",
    "layout",
    "Strict metadata contract for bounded current titration-bench placements."
  ),
  schema(
    "schema.layout_configuration.solution_preparation_bench.v1",
    "layout",
    "Strict metadata contract for bounded solution-preparation placements."
  ),
  schema(
    "schema.layout_configuration.calorimetry_bench.v1",
    "layout",
    "Strict metadata contract for bounded coffee-cup calorimetry placements."
  ),
  schema(
    "schema.material_initialization.aqueous_solution.v1",
    "material_initialization",
    "Strict metadata contract for code-owned aqueous-solution initialization."
  ),
  schema(
    "schema.material_initialization.bounded_concentration.v1",
    "material_initialization",
    "Strict canonical decimal concentration in a profile-owned unit, precision, support range, and safety policy.",
    "verified"
  ),
  schema(
    "schema.material_initialization.indicator.v1",
    "material_initialization",
    "Strict metadata contract for code-owned indicator initialization."
  ),
  schema(
    "schema.material_initialization.pure_liquid.v1",
    "material_initialization",
    "Strict metadata contract for a code-owned pure-liquid identity without authored composition."
  ),
  schema(
    "schema.model_configuration.strong_acid_strong_base_25ml.v1",
    "model",
    "Strict metadata contract for the current legacy titration configuration."
  ),
  schema(
    "schema.quantity.drop_count.v1",
    "quantity",
    "Strict positive integer drop-count metadata contract."
  ),
  schema(
    "schema.quantity.volume_ml.v1",
    "quantity",
    "Strict finite positive milliliter-volume metadata contract."
  ),
  quantity(
    "quantity-preset.hydrochloric_acid_0_100m_25ml.v1",
    25,
    "unit.ml.v1",
    ["reagent.hydrochloric_acid_0_100m.v1"]
  ),
  quantity(
    "quantity-preset.hydrochloric_acid_solution_25ml.v1",
    25,
    "unit.ml.v1",
    ["reagent.hydrochloric_acid_aqueous.v1"]
  ),
  quantity(
    "quantity-preset.sodium_hydroxide_0_100m_25ml.v1",
    25,
    "unit.ml.v1",
    ["reagent.sodium_hydroxide_0_100m.v1"]
  ),
  quantity(
    "quantity-preset.sodium_hydroxide_0_100m_50ml.v1",
    50,
    "unit.ml.v1",
    ["reagent.sodium_hydroxide_0_100m.v1"]
  ),
  quantity(
    "quantity-preset.sodium_hydroxide_solution_25ml.v1",
    25,
    "unit.ml.v1",
    ["reagent.sodium_hydroxide_aqueous.v1"]
  ),
  quantity(
    "quantity-preset.sodium_hydroxide_solution_50ml.v1",
    50,
    "unit.ml.v1",
    ["reagent.sodium_hydroxide_aqueous.v1"]
  ),

  quantity("quantity-preset.phenolphthalein_1_drop.v1", 1, "unit.drop.v1", [
    "reagent.phenolphthalein.v1"
  ]),
  quantity("quantity-preset.phenolphthalein_2_drops.v1", 2, "unit.drop.v1", [
    "reagent.phenolphthalein.v1"
  ]),
  quantity("quantity-preset.bromothymol_blue_1_drop.v1", 1, "unit.drop.v1", [
    "reagent.bromothymol_blue.v1"
  ]),
  quantity("quantity-preset.bromothymol_blue_2_drops.v1", 2, "unit.drop.v1", [
    "reagent.bromothymol_blue.v1"
  ]),
  quantity("quantity-preset.methyl_orange_1_drop.v1", 1, "unit.drop.v1", [
    "reagent.methyl_orange.v1"
  ]),
  quantity("quantity-preset.methyl_orange_2_drops.v1", 2, "unit.drop.v1", [
    "reagent.methyl_orange.v1"
  ]),
  quantity("quantity-preset.distilled_water_50ml.v1", 50, "unit.ml.v1", [
    "reagent.distilled_water.v1"
  ]),
  quantity("quantity-preset.distilled_water_250ml.v1", 250, "unit.ml.v1", [
    "reagent.distilled_water.v1"
  ]),
  quantity(
    "quantity-preset.distilled_water_cold_20c_50ml.v1",
    50,
    "unit.ml.v1",
    ["reagent.distilled_water_cold_20c.v1"]
  ),
  quantity(
    "quantity-preset.distilled_water_cold_20c_100ml.v1",
    100,
    "unit.ml.v1",
    ["reagent.distilled_water_cold_20c.v1"]
  ),
  quantity(
    "quantity-preset.distilled_water_hot_60c_50ml.v1",
    50,
    "unit.ml.v1",
    ["reagent.distilled_water_hot_60c.v1"]
  ),
  quantity(
    "quantity-preset.distilled_water_hot_60c_100ml.v1",
    100,
    "unit.ml.v1",
    ["reagent.distilled_water_hot_60c.v1"]
  ),
  quantity("quantity-preset.sodium_chloride_1_000m_50ml.v1", 50, "unit.ml.v1", [
    "reagent.sodium_chloride_1_000m.v1"
  ]),
  quantity(
    "quantity-preset.sodium_chloride_solution_50ml.v1",
    50,
    "unit.ml.v1",
    ["reagent.sodium_chloride_aqueous.v1"]
  )
] as const satisfies readonly ConfigurationRegistryEntry[];
