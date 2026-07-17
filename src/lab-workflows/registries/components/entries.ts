import type { ComponentRegistryEntry } from "./types";

const TITRATION_FAMILY_ID = "family.acid_base_titration.v1";
const TITRATION_SAFETY_NOTICE_ID = "safety.virtual_titration_ppe_notice.v1";

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
    defaultConfigurationPresetAvailability: "declared",
    visualAdapterDefinitionId: "visual-adapter.reagent_bottle.v1",
    visualAdapterDefinitionAvailability: "verified",
    mechanicalAdapterId: "mechanical-adapter.reagent_bottle.v1",
    mechanicalAdapterAvailability: "verified",
    purpose:
      "Identify the verified titrant source used to prepare the titration burette.",
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
    allowedActionIds: ["action.rinse.v1", "action.fill.v1"],
    allowedRoleIds: ["titrant_source"],
    emittedEventTypes: ["rinse_burette", "fill_burette", "refill_burette"],
    measurement: null,
    visualAdapterId: "WashStation",
    accessibilityRequirements: [
      "Expose the reagent identity as text rather than color alone.",
      "Provide keyboard-equivalent liquid and funnel selection controls.",
      "Announce the selected preparation setup before confirmation."
    ],
    safetyConstraintIds: [TITRATION_SAFETY_NOTICE_ID],
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
  }
] as const satisfies readonly ComponentRegistryEntry[];
