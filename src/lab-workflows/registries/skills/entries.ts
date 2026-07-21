import type { SkillRegistryDefinition } from "./types";

const TITRATION = "family.acid_base_titration.v1";
const CALORIMETRY = "family.calorimetry.v1";

export const SKILL_REGISTRY_DEFINITIONS = [
  {
    id: "measure_mass",
    version: "1.0.0",
    description:
      "Tares a balance, transfers a solid sample, and records mass at the apparatus resolution.",
    aliases: [],
    supportedFamilyIds: [],
    requiredComponentIds: [
      "component.balance.v1",
      "component.weighing_boat.v1"
    ],
    recommendedComponentIds: [],
    relevantEventFlagIds: [],
    positiveEvidenceReasonIds: [],
    assessmentModeIds: ["assessment.event_performance.v1"],
    coachTriggerTypeIds: [],
    adaptiveRetryPatternIds: [],
    examplePrompts: [
      "Create a lab that teaches taring and weighing a solid sample."
    ],
    restricted: false
  },
  {
    id: "measure_dissolution_enthalpy",
    version: "1.0.0",
    description:
      "Connects a measured solid mass and temperature change to deterministic molar dissolution enthalpy.",
    aliases: [],
    supportedFamilyIds: [],
    requiredComponentIds: [
      "component.balance.v1",
      "component.calorimeter.v1",
      "component.thermometer.v1"
    ],
    recommendedComponentIds: ["component.weighing_boat.v1"],
    relevantEventFlagIds: [],
    positiveEvidenceReasonIds: [],
    assessmentModeIds: ["assessment.event_performance.v1"],
    coachTriggerTypeIds: [],
    adaptiveRetryPatternIds: [],
    examplePrompts: ["Create an ammonium nitrate dissolution calorimetry lab."],
    restricted: false
  },
  {
    id: "endpoint_control",
    version: "1.0.0",
    description:
      "Controls delivery rate near a titration endpoint and avoids overshoot.",
    aliases: [],
    supportedFamilyIds: [TITRATION],
    requiredComponentIds: [
      "component.burette.v1",
      "component.erlenmeyer_flask.v1"
    ],
    recommendedComponentIds: ["component.indicator_bottle.v1"],
    relevantEventFlagIds: [
      "flag.flow_rate_high_near_endpoint.v1",
      "flag.endpoint_overshoot.v1"
    ],
    positiveEvidenceReasonIds: [
      "evidence.controlled_addition_near_endpoint.v1"
    ],
    assessmentModeIds: ["assessment.event_performance.v1"],
    coachTriggerTypeIds: ["coach_trigger.mistake_reflection.v1"],
    adaptiveRetryPatternIds: ["retry.endpoint_control_near_endpoint.v1"],
    examplePrompts: [
      "Create a 7-minute titration pre-lab focused on endpoint control."
    ],
    restricted: false
  },
  {
    id: "meniscus_reading",
    version: "1.0.0",
    description:
      "Reads the bottom of a concave meniscus at eye level and records apparatus-appropriate precision.",
    aliases: ["volumetric_reading"],
    supportedFamilyIds: [TITRATION],
    requiredComponentIds: ["component.burette.v1"],
    recommendedComponentIds: [],
    relevantEventFlagIds: ["meniscus_misread"],
    positiveEvidenceReasonIds: ["meniscus_read_ok"],
    assessmentModeIds: ["assessment.event_plus_entry.v1"],
    coachTriggerTypeIds: ["coach_trigger.mistake_reflection.v1"],
    adaptiveRetryPatternIds: [],
    examplePrompts: [
      "Give my students a short lab for practicing meniscus reading."
    ],
    restricted: false
  },
  {
    id: "burette_conditioning",
    version: "1.0.0",
    description:
      "Rinses a burette with the intended titrant before filling and explains the dilution consequence.",
    aliases: [],
    supportedFamilyIds: [TITRATION],
    requiredComponentIds: [
      "component.burette.v1",
      "component.reagent_bottle.v1"
    ],
    recommendedComponentIds: [],
    relevantEventFlagIds: ["burette_not_conditioned"],
    positiveEvidenceReasonIds: ["conditioned_with_titrant"],
    assessmentModeIds: ["assessment.event_performance.v1"],
    coachTriggerTypeIds: ["coach_trigger.mistake_reflection.v1"],
    adaptiveRetryPatternIds: [],
    examplePrompts: [
      "Make a pre-lab that checks whether students know how to condition a burette."
    ],
    restricted: false
  },
  {
    id: "stoichiometry",
    version: "1.0.0",
    description:
      "Relates measured quantities through a verified reaction model and balanced mole ratio.",
    aliases: [],
    supportedFamilyIds: [TITRATION],
    requiredComponentIds: [
      "component.burette.v1",
      "component.erlenmeyer_flask.v1"
    ],
    recommendedComponentIds: [],
    relevantEventFlagIds: ["result_out_of_tolerance"],
    positiveEvidenceReasonIds: ["result_within_tolerance"],
    assessmentModeIds: ["assessment.event_plus_entry.v1"],
    coachTriggerTypeIds: ["coach_trigger.mistake_reflection.v1"],
    adaptiveRetryPatternIds: [],
    examplePrompts: [
      "Create a titration workflow that assesses stoichiometry from measured endpoint volume."
    ],
    restricted: false
  },
  {
    id: "significant_figures",
    version: "1.0.0",
    description:
      "Records measurements and calculated results to precision justified by the apparatus and data.",
    aliases: ["sig_figs"],
    supportedFamilyIds: [TITRATION],
    requiredComponentIds: ["component.burette.v1"],
    recommendedComponentIds: [],
    relevantEventFlagIds: ["result_out_of_tolerance"],
    positiveEvidenceReasonIds: ["result_within_tolerance"],
    assessmentModeIds: ["assessment.event_plus_entry.v1"],
    coachTriggerTypeIds: [],
    adaptiveRetryPatternIds: [],
    examplePrompts: [
      "Create a five-minute titration measurement lab about significant figures."
    ],
    restricted: false
  },
  {
    id: "net_ionic_equations",
    version: "1.0.0",
    description:
      "Writes a balanced net ionic equation and excludes spectator ions using verified reaction truth.",
    aliases: ["net_ionic_equation"],
    // Stays family-bound, and therefore planned, until its assessment mode,
    // evidence reason, and retry template are registered.
    supportedFamilyIds: ["family.precipitation_solubility.v1"],
    requiredComponentIds: ["component.beaker.v1"],
    recommendedComponentIds: ["component.reagent_bottle.v1"],
    relevantEventFlagIds: [],
    positiveEvidenceReasonIds: ["evidence.net_ionic_equation_correct.v1"],
    assessmentModeIds: ["assessment.structured_equation.v1"],
    coachTriggerTypeIds: [],
    adaptiveRetryPatternIds: ["retry.net_ionic_alternate_pair.v1"],
    examplePrompts: [
      "Create a lab that helps students practice net ionic equations."
    ],
    restricted: false
  },
  {
    id: "precipitate_observation",
    version: "1.0.0",
    description:
      "Connects a visible precipitate observation to verified solubility truth without guessing product identity.",
    aliases: [],
    supportedFamilyIds: [],
    requiredComponentIds: [
      "component.beaker.v1",
      "component.reagent_bottle.v1"
    ],
    recommendedComponentIds: [],
    relevantEventFlagIds: [],
    positiveEvidenceReasonIds: [],
    assessmentModeIds: ["assessment.observation_entry.v1"],
    coachTriggerTypeIds: [],
    adaptiveRetryPatternIds: [],
    examplePrompts: [
      "Build a mini-lab where students predict and observe a precipitate."
    ],
    restricted: false
  },
  {
    id: "heat_transfer",
    version: "1.0.0",
    description:
      "Tracks energy transfer between system and surroundings using deterministic calorimetry state.",
    aliases: [],
    supportedFamilyIds: [],
    requiredComponentIds: [
      "component.calorimeter.v1",
      "component.thermometer.v1"
    ],
    recommendedComponentIds: [],
    relevantEventFlagIds: [],
    positiveEvidenceReasonIds: [],
    assessmentModeIds: ["assessment.event_performance.v1"],
    coachTriggerTypeIds: [],
    adaptiveRetryPatternIds: [],
    examplePrompts: ["Create a calorimetry workflow focused on heat transfer."],
    restricted: false
  },
  {
    id: "calorimetry_sign_convention",
    version: "1.0.0",
    description:
      "Applies consistent signs for system and surroundings heat in a verified calorimetry model.",
    aliases: ["sign_convention"],
    // Remains planned until explanation assessment + sign-convention evidence land.
    supportedFamilyIds: [CALORIMETRY],
    requiredComponentIds: [
      "component.calorimeter.v1",
      "component.thermometer.v1"
    ],
    recommendedComponentIds: [],
    relevantEventFlagIds: [],
    positiveEvidenceReasonIds: ["evidence.sign_convention_correct.v1"],
    assessmentModeIds: ["assessment.explanation.v1"],
    coachTriggerTypeIds: [],
    adaptiveRetryPatternIds: ["retry.calorimetry_sign_contrast.v1"],
    examplePrompts: [
      "Create a calorimetry workflow focused on heat transfer sign conventions."
    ],
    restricted: false
  },
  {
    id: "volumetric_transfer",
    version: "1.0.0",
    description:
      "Conditions a calibrated transfer pipette and delivers a bounded aliquot to a receiving vessel.",
    aliases: [],
    supportedFamilyIds: [],
    requiredComponentIds: [
      "component.reagent_bottle.v1",
      "component.volumetric_pipette.v1",
      "component.volumetric_flask.v1"
    ],
    recommendedComponentIds: [],
    relevantEventFlagIds: [],
    positiveEvidenceReasonIds: [],
    assessmentModeIds: ["assessment.event_performance.v1"],
    coachTriggerTypeIds: [],
    adaptiveRetryPatternIds: [],
    examplePrompts: [
      "Create a solution-preparation lab that assesses calibrated aliquot transfer."
    ],
    restricted: false
  },
  {
    id: "solution_dilution",
    version: "1.0.0",
    description:
      "Prepares a bounded aqueous dilution by filling to a verified mark, mixing, and using deterministic concentration evidence.",
    aliases: [],
    supportedFamilyIds: [],
    requiredComponentIds: [
      "component.volumetric_flask.v1",
      "component.wash_bottle.v1"
    ],
    recommendedComponentIds: ["component.volumetric_pipette.v1"],
    relevantEventFlagIds: [],
    positiveEvidenceReasonIds: [],
    assessmentModeIds: ["assessment.event_performance.v1"],
    coachTriggerTypeIds: [],
    adaptiveRetryPatternIds: [],
    examplePrompts: [
      "Create a bounded sodium-chloride dilution using a volumetric flask."
    ],
    restricted: false
  },
  {
    id: "procedural_safety",
    version: "1.0.0",
    description:
      "Follows workflow-specific handling and sequencing rules from deterministic safety policies.",
    aliases: [],
    supportedFamilyIds: [TITRATION],
    requiredComponentIds: [],
    recommendedComponentIds: [
      "component.burette.v1",
      "component.reagent_bottle.v1"
    ],
    relevantEventFlagIds: ["burette_not_conditioned"],
    positiveEvidenceReasonIds: ["conditioned_with_titrant"],
    assessmentModeIds: ["assessment.event_performance.v1"],
    coachTriggerTypeIds: ["coach_trigger.mistake_reflection.v1"],
    adaptiveRetryPatternIds: [],
    examplePrompts: [
      "Make a pre-lab that checks safe reagent handling during a titration."
    ],
    restricted: false
  },
  {
    id: "data_recording",
    version: "1.0.0",
    description:
      "Records observations, units, precision, and step context in a usable lab data table.",
    aliases: [],
    supportedFamilyIds: [TITRATION],
    requiredComponentIds: ["component.burette.v1"],
    recommendedComponentIds: ["component.erlenmeyer_flask.v1"],
    relevantEventFlagIds: ["meniscus_misread"],
    positiveEvidenceReasonIds: ["meniscus_read_ok"],
    assessmentModeIds: ["assessment.event_plus_entry.v1"],
    coachTriggerTypeIds: [],
    adaptiveRetryPatternIds: [],
    examplePrompts: [
      "Create a short titration lab that practices careful data recording with units."
    ],
    restricted: false
  }
] as const satisfies readonly SkillRegistryDefinition[];
