import {
  INDICATOR_PROFILE_IDS,
  type IndicatorId
} from "../../../lab-workflows/chemistry-models/acid-base";
import { materialRegistry } from "../../../lab-workflows/registries/reagents";
import type { GenericLabState } from "../../../lab-workflows/runtime";
import type { ValidatedLabWorkflowSpecV2 } from "../../../lab-workflows/schema/v2";
import {
  getProcedureStageLabel,
  type TitrationProcedureStage
} from "../titration/procedureStage";

const BURETTE_COMPONENT_ID = "component.burette.v1";
const FLASK_COMPONENT_ID = "component.erlenmeyer_flask.v1";
const ACID_BASE_CAPABILITY_ID = "chemistry.acid_base_equilibrium.v1";

/**
 * Student-visible facts for a native titration bench, projected directly from
 * equipment-owned observables (burette/flask state fields), registered
 * material metadata, and emitted event envelopes. This is the native-truth
 * replacement for routing the notebook through the legacy `TitrationState`
 * bridge: it never touches `state.chemistry.groundTruth`, so the unknown
 * analyte concentration cannot leak into a student surface, and it computes
 * no chemistry.
 */
export interface NativeTitrationBenchFacts {
  readonly analyteName: string;
  readonly analyteVolumeML: number;
  readonly titrantName: string;
  readonly titrantConcentrationM: number;
  /** Display label of the bound indicator, e.g. "phenolphthalein". */
  readonly indicatorName: string;
  readonly indicatorAdded: boolean;
  /** Burette fill fraction 0–1 from availableML / capacityML. */
  readonly buretteFillFraction: number;
  readonly buretteConditioned: boolean;
  readonly stage: TitrationProcedureStage;
  readonly stageLabel: string;
}

function equipmentField(
  state: Readonly<GenericLabState>,
  equipmentDefinitionId: string,
  key: string
): boolean | null | number | string | readonly string[] | undefined {
  const matches = state.equipment.filter(
    (candidate) => candidate.equipmentDefinitionId === equipmentDefinitionId
  );
  if (matches.length !== 1) return undefined;
  return matches[0].fields.find((candidate) => candidate.key === key)?.value;
}

function numberField(
  state: Readonly<GenericLabState>,
  equipmentDefinitionId: string,
  key: string
): number | undefined {
  const value = equipmentField(state, equipmentDefinitionId, key);
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

/**
 * Project the notebook/bench facts for a native titration workflow, or null
 * when the bench is not a titration bench (no exact burette+flask pair or no
 * exact analyte/titrant/indicator material bindings). Failing soft keeps the
 * shared native workspace usable for non-titration labs.
 */
export function nativeTitrationBenchFacts(
  workflow: Readonly<ValidatedLabWorkflowSpecV2>,
  state: Readonly<GenericLabState>
): NativeTitrationBenchFacts | null {
  const availableML = numberField(state, BURETTE_COMPONENT_ID, "availableML");
  const capacityML = numberField(state, BURETTE_COMPONENT_ID, "capacityML");
  const deliveredML = numberField(state, BURETTE_COMPONENT_ID, "deliveredML");
  const totalVolumeML = numberField(state, FLASK_COMPONENT_ID, "totalVolumeML");
  if (
    availableML === undefined ||
    capacityML === undefined ||
    deliveredML === undefined ||
    totalVolumeML === undefined
  ) {
    return null;
  }

  const flaskInstanceId = workflow.equipment.find(
    ({ equipmentDefinitionId }) =>
      equipmentDefinitionId === FLASK_COMPONENT_ID
  )?.instanceId;
  let profiles;
  try {
    profiles = workflow.materials.map((binding) => ({
      binding,
      profile: materialRegistry.get(binding.materialProfileId)
    }));
  } catch {
    return null;
  }
  const analyte = profiles.find(
    ({ binding, profile }) =>
      binding.containerInstanceId === flaskInstanceId &&
      profile.providedChemistryCapabilityIds.includes(ACID_BASE_CAPABILITY_ID)
  );
  const titrant = profiles.find(
    ({ binding, profile }) =>
      binding.containerInstanceId !== flaskInstanceId &&
      profile.providedChemistryCapabilityIds.includes(ACID_BASE_CAPABILITY_ID)
  );
  const indicatorId: IndicatorId | undefined = profiles
    .map(({ profile }) => INDICATOR_PROFILE_IDS[profile.id])
    .find((candidate) => candidate !== undefined);
  if (!analyte || !titrant || !indicatorId || titrant.profile.concentrationM === null) {
    return null;
  }

  const events = state.eventEnvelopes.map(({ payload }) => payload);
  const lastAdditionIndex = events.findLastIndex(
    ({ type }) => type === "add_titrant"
  );
  const lastReadingIndex = events.findLastIndex(
    ({ type }) => type === "read_meniscus"
  );
  // Mirrors the legacy display projection in titration/procedureStage.ts;
  // native workflows have no submit_report action, so no report stage here.
  const stage: TitrationProcedureStage =
    deliveredML === 0
      ? availableML === 0
        ? "prepare_burette"
        : "add_titrant"
      : lastReadingIndex > lastAdditionIndex
        ? "record_results"
        : "add_titrant";

  return Object.freeze({
    analyteName: analyte.profile.displayName,
    analyteVolumeML: totalVolumeML - deliveredML,
    titrantName: titrant.profile.displayName,
    titrantConcentrationM: titrant.profile.concentrationM,
    indicatorName: indicatorId.replaceAll("_", " "),
    indicatorAdded:
      equipmentField(state, FLASK_COMPONENT_ID, "indicatorAdded") === true,
    buretteFillFraction: capacityML > 0 ? availableML / capacityML : 0,
    buretteConditioned:
      equipmentField(state, BURETTE_COMPONENT_ID, "conditionedWith") ===
      "titrant",
    stage,
    stageLabel: getProcedureStageLabel(stage)
  });
}
