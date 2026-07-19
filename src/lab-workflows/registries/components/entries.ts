import type { ComponentRegistryEntry } from "./types";

const TITRATION_FAMILY_ID = "family.acid_base_titration.v1";
const TITRATION_SAFETY_NOTICE_ID = "safety.virtual_titration_ppe_notice.v1";
const SOLUTION_PREPARATION_SAFETY_NOTICE_ID =
  "safety.virtual_solution_preparation_ppe_notice.v1";

export const COMPONENT_REGISTRY_ENTRIES = [
  {
    id: "component.burette.v1",
    version: "1.0.0",
    displayName: "Burette",
    capabilityIds: [
      "capability.contain_liquid.v1",
      "capability.receive_liquid.v1",
      "capability.dispense_liquid.v1",
      "capability.measure_volume.v1",
      "capability.rinse.v1",
      "capability.mount.v1"
    ],
    stateSchemaId: "schema.equipment_state.burette.v1",
    stateSchemaAvailability: "verified",
    defaultConfigurationPresetId: "component_config.burette.50ml.v1",
    defaultConfigurationPresetAvailability: "verified",
    visualAdapterDefinitionId: "visual-adapter.burette.v1",
    visualAdapterDefinitionAvailability: "verified",
    mechanicalAdapterId: "mechanical-adapter.burette.v1",
    mechanicalAdapterAvailability: "verified",
    purpose:
      "Contain, condition, dispense, and read titrant in the verified titration workflow.",
    stateSchema: {
      schemaVersion: "1.0.0",
      additionalProperties: false,
      fields: [
        {
          key: "capacityML",
          valueType: "number",
          nullable: false,
          runtimeOwned: true,
          description: "Configured burette capacity."
        },
        {
          key: "availableML",
          valueType: "number",
          nullable: false,
          runtimeOwned: true,
          description: "Titrant remaining in the burette."
        },
        {
          key: "deliveredML",
          valueType: "number",
          nullable: false,
          runtimeOwned: true,
          description: "Cumulative titrant delivered by the engine."
        },
        {
          key: "conditionedWith",
          valueType: "enum",
          nullable: true,
          runtimeOwned: true,
          allowedValues: ["water", "titrant"],
          description: "Accepted burette rinse solvent, when one has been used."
        },
        {
          key: "filled",
          valueType: "boolean",
          nullable: false,
          runtimeOwned: true,
          description: "Whether any verified fill has occurred."
        },
        {
          key: "stopcockDetent",
          valueType: "enum",
          nullable: false,
          runtimeOwned: true,
          allowedValues: ["closed", "dropwise", "slow", "open"],
          description: "Current local interaction detent."
        },
        {
          key: "meniscusReadingML",
          valueType: "number",
          nullable: false,
          runtimeOwned: true,
          description: "Engine-owned burette scale reading."
        }
      ]
    },
    allowedActionIds: [
      "action.rinse.v1",
      "action.fill.v1",
      "action.dispense.v1",
      "action.read_volume.v1"
    ],
    allowedRoleIds: ["titrant_delivery"],
    emittedEventTypes: [
      "rinse_burette",
      "fill_burette",
      "refill_burette",
      "add_titrant",
      "read_meniscus"
    ],
    measurement: {
      kind: "volumetric_delivery",
      unitId: "unit.ml.v1",
      capacityML: 50,
      graduationIncrementML: 0.1,
      reportIncrementML: 0.05,
      toleranceML: 0.05,
      quantitative: true,
      description:
        "50.00 mL virtual burette with 0.10 mL graduations and readings recorded to 0.05 mL."
    },
    visualAdapterId: "Burette",
    accessibilityRequirements: [
      "Provide a keyboard-operable precision-control path.",
      "Expose the bottom of the concave meniscus as text and graphics.",
      "Keep graduations and current reading legible in reduced graphics mode."
    ],
    safetyConstraintIds: [TITRATION_SAFETY_NOTICE_ID],
    compatibleFamilyIds: [TITRATION_FAMILY_ID],
    performanceTier: "core"
  },
  {
    id: "component.erlenmeyer_flask.v1",
    version: "1.0.0",
    displayName: "Erlenmeyer flask",
    capabilityIds: [
      "capability.contain_liquid.v1",
      "capability.receive_liquid.v1",
      "capability.observe_color.v1"
    ],
    stateSchemaId: "schema.equipment_state.erlenmeyer_flask.v1",
    stateSchemaAvailability: "verified",
    defaultConfigurationPresetId: "component_config.erlenmeyer.125ml.v1",
    defaultConfigurationPresetAvailability: "verified",
    visualAdapterDefinitionId: "visual-adapter.erlenmeyer_flask.v1",
    visualAdapterDefinitionAvailability: "verified",
    mechanicalAdapterId: "mechanical-adapter.erlenmeyer_flask.v1",
    mechanicalAdapterAvailability: "verified",
    purpose:
      "Receive titrant and project engine-owned indicator color in the verified titration workflow.",
    stateSchema: {
      schemaVersion: "1.0.0",
      additionalProperties: false,
      fields: [
        {
          key: "capacityML",
          valueType: "number",
          nullable: false,
          runtimeOwned: true,
          description: "Configured vessel capacity."
        },
        {
          key: "totalVolumeML",
          valueType: "number",
          nullable: false,
          runtimeOwned: true,
          description: "Total engine-owned liquid volume."
        },
        {
          key: "observableColor",
          valueType: "string",
          nullable: false,
          runtimeOwned: true,
          description: "Engine observation projected into the flask liquid."
        },
        {
          key: "indicatorAdded",
          valueType: "boolean",
          nullable: false,
          runtimeOwned: true,
          description: "Whether the one permitted indicator addition occurred."
        }
      ]
    },
    allowedActionIds: ["action.add_indicator.v1"],
    allowedRoleIds: ["reaction_vessel"],
    emittedEventTypes: ["select_indicator", "add_titrant"],
    measurement: {
      kind: "approximate_volume",
      unitId: "unit.ml.v1",
      capacityML: 125,
      graduationIncrementML: 25,
      reportIncrementML: 5,
      toleranceML: 5,
      quantitative: false,
      description:
        "Approximate flask markings are visual context and are not valid for quantitative delivery."
    },
    visualAdapterId: "ErlenmeyerFlask",
    accessibilityRequirements: [
      "Pair liquid color with an engine-owned textual observation.",
      "Provide keyboard focus and a stable focused camera target.",
      "Do not present approximate markings as precision measurements."
    ],
    safetyConstraintIds: [TITRATION_SAFETY_NOTICE_ID],
    compatibleFamilyIds: [TITRATION_FAMILY_ID],
    performanceTier: "core"
  },
  {
    id: "component.reagent_bottle.v1",
    version: "1.0.0",
    displayName: "Reagent bottle",
    capabilityIds: [
      "capability.contain_liquid.v1",
      "capability.dispense_liquid.v1"
    ],
    stateSchemaId: "schema.equipment_state.reagent_bottle.v1",
    stateSchemaAvailability: "verified",
    defaultConfigurationPresetId:
      "component_config.reagent_bottle.titrant_source.v1",
    defaultConfigurationPresetAvailability: "verified",
    visualAdapterDefinitionId: "visual-adapter.reagent_bottle.v1",
    visualAdapterDefinitionAvailability: "verified",
    mechanicalAdapterId: "mechanical-adapter.reagent_bottle.v1",
    mechanicalAdapterAvailability: "verified",
    purpose:
      "Hold an exact registered liquid source for a compatible transfer or dispensing action.",
    stateSchema: {
      schemaVersion: "1.0.0",
      additionalProperties: false,
      fields: [
        {
          key: "reagentInstanceId",
          valueType: "string",
          nullable: false,
          runtimeOwned: true,
          description:
            "Exact reagent binding supplied by deterministic assembly."
        },
        {
          key: "selected",
          valueType: "boolean",
          nullable: false,
          runtimeOwned: true,
          description: "Whether the source is selected for burette preparation."
        }
      ]
    },
    allowedActionIds: [
      "action.rinse.v1",
      "action.fill.v1",
      "action.rinse_transfer_device.v1",
      "action.transfer_liquid.v1",
      "action.pour_liquid.v1"
    ],
    allowedRoleIds: ["titrant_source", "stock_solution_source"],
    emittedEventTypes: ["rinse_burette", "fill_burette", "refill_burette"],
    measurement: null,
    visualAdapterId: "WashStation",
    accessibilityRequirements: [
      "Expose the reagent identity as text rather than color alone.",
      "Provide keyboard-equivalent liquid and funnel selection controls.",
      "Announce the selected preparation setup before confirmation."
    ],
    safetyConstraintIds: [],
    compatibleFamilyIds: [TITRATION_FAMILY_ID],
    performanceTier: "core"
  },
  {
    id: "component.indicator_bottle.v1",
    version: "1.0.0",
    displayName: "Indicator bottle",
    capabilityIds: [
      "capability.contain_liquid.v1",
      "capability.dispense_liquid.v1"
    ],
    stateSchemaId: "schema.equipment_state.indicator_bottle.v1",
    stateSchemaAvailability: "verified",
    defaultConfigurationPresetId: "component_config.indicator_dropper.v1",
    defaultConfigurationPresetAvailability: "verified",
    visualAdapterDefinitionId: "visual-adapter.indicator_bottle.v1",
    visualAdapterDefinitionAvailability: "verified",
    mechanicalAdapterId: "mechanical-adapter.indicator_bottle.v1",
    mechanicalAdapterAvailability: "verified",
    purpose:
      "Select and add one verified indicator profile to the titration flask.",
    stateSchema: {
      schemaVersion: "1.0.0",
      additionalProperties: false,
      fields: [
        {
          key: "indicatorReagentInstanceId",
          valueType: "string",
          nullable: false,
          runtimeOwned: true,
          description: "Exact verified indicator profile bound by the runtime."
        },
        {
          key: "selected",
          valueType: "boolean",
          nullable: false,
          runtimeOwned: true,
          description: "Whether this bottle is the selected indicator."
        },
        {
          key: "added",
          valueType: "boolean",
          nullable: false,
          runtimeOwned: true,
          description: "Whether the indicator was committed to the flask."
        }
      ]
    },
    allowedActionIds: ["action.select_indicator.v1"],
    allowedRoleIds: ["indicator_source"],
    emittedEventTypes: ["select_indicator"],
    measurement: null,
    visualAdapterId: "IndicatorShelf",
    accessibilityRequirements: [
      "Pair every cap color with a text label.",
      "Show transition details before the one permitted addition.",
      "Expose selection and added state without relying on animation."
    ],
    safetyConstraintIds: [TITRATION_SAFETY_NOTICE_ID],
    compatibleFamilyIds: [TITRATION_FAMILY_ID],
    performanceTier: "core"
  },
  {
    id: "component.volumetric_pipette.v1",
    version: "1.0.0",
    displayName: "10 mL volumetric pipette",
    capabilityIds: [
      "capability.contain_liquid.v1",
      "capability.receive_liquid.v1",
      "capability.dispense_liquid.v1",
      "capability.transfer_liquid.v1",
      "capability.measure_volume.v1",
      "capability.rinse.v1"
    ],
    stateSchemaId: "schema.equipment_state.volumetric_pipette.v1",
    stateSchemaAvailability: "verified",
    defaultConfigurationPresetId: "component_config.volumetric_pipette.10ml.v1",
    defaultConfigurationPresetAvailability: "verified",
    visualAdapterDefinitionId: "visual-adapter.volumetric_pipette.v1",
    visualAdapterDefinitionAvailability: "verified",
    mechanicalAdapterId: "mechanical-adapter.volumetric_pipette.v1",
    mechanicalAdapterAvailability: "verified",
    purpose:
      "Condition, measure, and deliver one bounded aliquot from a verified liquid source.",
    stateSchema: {
      schemaVersion: "1.0.0",
      additionalProperties: false,
      fields: [
        {
          key: "capacityML",
          valueType: "number",
          nullable: false,
          runtimeOwned: true,
          description: "Registered calibrated delivery capacity."
        },
        {
          key: "availableML",
          valueType: "number",
          nullable: false,
          runtimeOwned: true,
          description: "Liquid currently held by the pipette."
        },
        {
          key: "deliveredML",
          valueType: "number",
          nullable: false,
          runtimeOwned: true,
          description: "Cumulative volume delivered from the pipette."
        },
        {
          key: "conditionedMaterialProfileId",
          valueType: "string",
          nullable: true,
          runtimeOwned: true,
          description:
            "Exact material profile used for the latest conditioning rinse."
        },
        {
          key: "residualFilmPresent",
          valueType: "boolean",
          nullable: false,
          runtimeOwned: true,
          description:
            "Whether a code-owned conditioning film remains on the walls."
        }
      ]
    },
    allowedActionIds: [
      "action.rinse_transfer_device.v1",
      "action.transfer_liquid.v1"
    ],
    allowedRoleIds: ["aliquot_transfer"],
    emittedEventTypes: ["rinse_transfer_device", "transfer_liquid"],
    measurement: {
      kind: "volumetric_transfer",
      unitId: "unit.ml.v1",
      capacityML: 10,
      graduationIncrementML: 10,
      reportIncrementML: 0.01,
      toleranceML: 0.02,
      quantitative: true,
      description:
        "Verified 10.00 mL transfer pipette with a 0.02 mL delivery tolerance."
    },
    visualAdapterId: "VolumetricPipette",
    accessibilityRequirements: [
      "Provide keyboard actions for conditioning, aspirating, and delivering.",
      "Expose current fill and conditioning state as text.",
      "Do not rely on the calibration mark alone to communicate readiness."
    ],
    safetyConstraintIds: [SOLUTION_PREPARATION_SAFETY_NOTICE_ID],
    compatibleFamilyIds: [],
    performanceTier: "core"
  },
  {
    id: "component.volumetric_flask.v1",
    version: "1.0.0",
    displayName: "100 mL volumetric flask",
    capabilityIds: [
      "capability.contain_liquid.v1",
      "capability.receive_liquid.v1",
      "capability.fill_to_mark.v1",
      "capability.mix.v1"
    ],
    stateSchemaId: "schema.equipment_state.volumetric_flask.v1",
    stateSchemaAvailability: "verified",
    defaultConfigurationPresetId: "component_config.volumetric_flask.100ml.v1",
    defaultConfigurationPresetAvailability: "verified",
    visualAdapterDefinitionId: "visual-adapter.volumetric_flask.v1",
    visualAdapterDefinitionAvailability: "verified",
    mechanicalAdapterId: "mechanical-adapter.volumetric_flask.v1",
    mechanicalAdapterAvailability: "verified",
    purpose:
      "Receive a measured aliquot, fill to a verified calibration mark, and mix the prepared solution.",
    stateSchema: {
      schemaVersion: "1.0.0",
      additionalProperties: false,
      fields: [
        {
          key: "capacityML",
          valueType: "number",
          nullable: false,
          runtimeOwned: true,
          description: "Registered flask capacity and calibration-mark volume."
        },
        {
          key: "totalVolumeML",
          valueType: "number",
          nullable: false,
          runtimeOwned: true,
          description: "Total liquid volume in the flask."
        },
        {
          key: "markErrorML",
          valueType: "number",
          nullable: false,
          runtimeOwned: true,
          description:
            "Signed difference between current volume and the calibration mark."
        },
        {
          key: "markToleranceML",
          valueType: "number",
          nullable: false,
          runtimeOwned: true,
          description:
            "Registered absolute tolerance around the calibration mark."
        },
        {
          key: "filledToMark",
          valueType: "boolean",
          nullable: false,
          runtimeOwned: true,
          description: "Whether a fill-to-mark action has been completed."
        },
        {
          key: "withinMarkTolerance",
          valueType: "boolean",
          nullable: false,
          runtimeOwned: true,
          description:
            "Whether the submitted final volume is within registered tolerance."
        },
        {
          key: "mixed",
          valueType: "boolean",
          nullable: false,
          runtimeOwned: true,
          description: "Whether the contents have been mechanically mixed."
        },
        {
          key: "mixCount",
          valueType: "number",
          nullable: false,
          runtimeOwned: true,
          description: "Cumulative bounded mixing operations."
        }
      ]
    },
    allowedActionIds: [
      "action.transfer_liquid.v1",
      "action.fill_to_mark.v1",
      "action.mix_solution.v1"
    ],
    allowedRoleIds: ["dilution_vessel"],
    emittedEventTypes: ["transfer_liquid", "fill_to_mark", "mix_solution"],
    measurement: {
      kind: "volumetric_containment",
      unitId: "unit.ml.v1",
      capacityML: 100,
      graduationIncrementML: 100,
      reportIncrementML: 0.01,
      toleranceML: 0.08,
      quantitative: true,
      description:
        "Verified 100.00 mL volumetric flask with a 0.08 mL mark tolerance."
    },
    visualAdapterId: "VolumetricFlask",
    accessibilityRequirements: [
      "Expose current volume, mark error, and mixed state as text.",
      "Provide keyboard actions for fill-to-mark and mixing.",
      "Pair the calibration mark with a non-visual tolerance status."
    ],
    safetyConstraintIds: [SOLUTION_PREPARATION_SAFETY_NOTICE_ID],
    compatibleFamilyIds: [],
    performanceTier: "core"
  },
  {
    id: "component.wash_bottle.v1",
    version: "1.0.0",
    displayName: "Distilled-water wash bottle",
    capabilityIds: [
      "capability.contain_liquid.v1",
      "capability.dispense_liquid.v1"
    ],
    stateSchemaId: "schema.equipment_state.wash_bottle.v1",
    stateSchemaAvailability: "verified",
    defaultConfigurationPresetId: "component_config.wash_bottle.250ml.v1",
    defaultConfigurationPresetAvailability: "verified",
    visualAdapterDefinitionId: "visual-adapter.wash_bottle.v1",
    visualAdapterDefinitionAvailability: "verified",
    mechanicalAdapterId: "mechanical-adapter.wash_bottle.v1",
    mechanicalAdapterAvailability: "verified",
    purpose:
      "Supply verified distilled water for a bounded fill-to-mark operation.",
    stateSchema: {
      schemaVersion: "1.0.0",
      additionalProperties: false,
      fields: [
        {
          key: "reagentInstanceId",
          valueType: "string",
          nullable: false,
          runtimeOwned: true,
          description: "Exact distilled-water binding supplied by assembly."
        },
        {
          key: "availableML",
          valueType: "number",
          nullable: false,
          runtimeOwned: true,
          description: "Distilled water remaining in the bottle."
        }
      ]
    },
    allowedActionIds: ["action.fill_to_mark.v1", "action.pour_liquid.v1"],
    allowedRoleIds: ["diluent_source"],
    emittedEventTypes: ["fill_to_mark"],
    measurement: {
      kind: "approximate_volume",
      unitId: "unit.ml.v1",
      capacityML: 250,
      graduationIncrementML: 50,
      reportIncrementML: 10,
      toleranceML: 10,
      quantitative: false,
      description:
        "A 250 mL supply bottle; its markings are not used for quantitative delivery."
    },
    visualAdapterId: "WashBottle",
    accessibilityRequirements: [
      "Expose the exact bound material identity and remaining volume as text.",
      "Provide a keyboard fill-to-mark path.",
      "Do not present the bottle as a precision measuring device."
    ],
    safetyConstraintIds: [SOLUTION_PREPARATION_SAFETY_NOTICE_ID],
    compatibleFamilyIds: [],
    performanceTier: "core"
  },
  {
    id: "component.calorimeter.v1",
    version: "1.0.0",
    displayName: "Coffee-cup calorimeter",
    capabilityIds: [
      "capability.contain_liquid.v1",
      "capability.receive_liquid.v1",
      "capability.mix.v1",
      "capability.seal_lid.v1",
      "capability.accept_probe.v1"
    ],
    stateSchemaId: "schema.equipment_state.calorimeter.v1",
    stateSchemaAvailability: "verified",
    defaultConfigurationPresetId:
      "component_config.calorimeter.coffee_cup_100ml.v1",
    defaultConfigurationPresetAvailability: "verified",
    visualAdapterDefinitionId: "visual-adapter.calorimeter.v1",
    visualAdapterDefinitionAvailability: "verified",
    mechanicalAdapterId: "mechanical-adapter.calorimeter.v1",
    mechanicalAdapterAvailability: "verified",
    purpose:
      "Receive poured aqueous samples, accept a temperature probe, seal with a lid, and mix for coffee-cup calorimetry.",
    stateSchema: {
      schemaVersion: "1.0.0",
      additionalProperties: false,
      fields: [
        {
          key: "capacityML",
          valueType: "number",
          nullable: false,
          runtimeOwned: true,
          description: "Registered calorimeter working volume."
        },
        {
          key: "totalVolumeML",
          valueType: "number",
          nullable: false,
          runtimeOwned: true,
          description: "Total liquid volume in the calorimeter."
        },
        {
          key: "lidClosed",
          valueType: "boolean",
          nullable: false,
          runtimeOwned: true,
          description: "Whether the calorimeter lid is closed."
        },
        {
          key: "probeInserted",
          valueType: "boolean",
          nullable: false,
          runtimeOwned: true,
          description: "Whether a registered thermometer probe is inserted."
        },
        {
          key: "insertedThermometerInstanceId",
          valueType: "string",
          nullable: true,
          runtimeOwned: true,
          description: "Exact thermometer instance currently inserted, if any."
        },
        {
          key: "mixed",
          valueType: "boolean",
          nullable: false,
          runtimeOwned: true,
          description: "Whether the calorimeter contents have been mixed."
        },
        {
          key: "mixCount",
          valueType: "number",
          nullable: false,
          runtimeOwned: true,
          description: "Number of completed mix actions."
        }
      ]
    },
    allowedActionIds: [
      "action.pour_liquid.v1",
      "action.mix_calorimeter.v1",
      "action.set_calorimeter_lid.v1"
    ],
    allowedRoleIds: ["calorimetry_vessel"],
    emittedEventTypes: [
      "pour_liquid",
      "mix_calorimeter",
      "set_calorimeter_lid"
    ],
    measurement: {
      kind: "approximate_volume",
      unitId: "unit.ml.v1",
      capacityML: 100,
      graduationIncrementML: 10,
      reportIncrementML: 1,
      toleranceML: 1,
      quantitative: false,
      description:
        "Coffee-cup working volume of 100 mL; temperature precision comes from the registered thermometer."
    },
    visualAdapterId: "Calorimeter",
    accessibilityRequirements: [
      "Expose lid, probe, volume, and mix state as text.",
      "Provide keyboard pour, lid, and mix controls.",
      "Do not rely on steam or color alone to communicate thermal state."
    ],
    safetyConstraintIds: ["safety.virtual_calorimetry_ppe_notice.v1"],
    compatibleFamilyIds: [],
    performanceTier: "core"
  },
  {
    id: "component.thermometer.v1",
    version: "1.0.0",
    displayName: "Digital thermometer",
    capabilityIds: ["capability.measure_temperature.v1"],
    stateSchemaId: "schema.equipment_state.thermometer.v1",
    stateSchemaAvailability: "verified",
    defaultConfigurationPresetId: "component_config.thermometer.digital_0_1c.v1",
    defaultConfigurationPresetAvailability: "verified",
    visualAdapterDefinitionId: "visual-adapter.thermometer.v1",
    visualAdapterDefinitionAvailability: "verified",
    mechanicalAdapterId: "mechanical-adapter.thermometer.v1",
    mechanicalAdapterAvailability: "verified",
    purpose:
      "Place into a calorimeter, remove, and report temperature readings to registered precision.",
    stateSchema: {
      schemaVersion: "1.0.0",
      additionalProperties: false,
      fields: [
        {
          key: "placed",
          valueType: "boolean",
          nullable: false,
          runtimeOwned: true,
          description: "Whether the probe is inserted in a calorimeter."
        },
        {
          key: "hostCalorimeterInstanceId",
          valueType: "string",
          nullable: true,
          runtimeOwned: true,
          description: "Exact calorimeter instance currently hosting the probe."
        },
        {
          key: "reportIncrementC",
          valueType: "number",
          nullable: false,
          runtimeOwned: true,
          description: "Registered temperature reporting increment in Celsius."
        },
        {
          key: "lastReportedC",
          valueType: "number",
          nullable: true,
          runtimeOwned: true,
          description: "Most recent student-reported temperature reading."
        }
      ]
    },
    allowedActionIds: [
      "action.place_thermometer.v1",
      "action.remove_thermometer.v1",
      "action.read_temperature.v1"
    ],
    allowedRoleIds: ["temperature_probe"],
    emittedEventTypes: [
      "place_thermometer",
      "remove_thermometer",
      "read_temperature"
    ],
    measurement: {
      kind: "temperature",
      unitId: "unit.celsius.v1",
      capacityML: 0,
      graduationIncrementML: 0,
      reportIncrementML: 0.1,
      toleranceML: 0.1,
      quantitative: true,
      description: "Digital thermometer with 0.1 °C report increment."
    },
    visualAdapterId: "Thermometer",
    accessibilityRequirements: [
      "Expose placement and last reported temperature as text.",
      "Provide keyboard place, remove, and read controls.",
      "Pair every reading with an explicit unit label."
    ],
    safetyConstraintIds: ["safety.virtual_calorimetry_ppe_notice.v1"],
    compatibleFamilyIds: [],
    performanceTier: "core"
  }
] as const satisfies readonly ComponentRegistryEntry[];
