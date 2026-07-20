import type { GenericStateField } from "../../runtime/generic/types";
import type { GenericChemistryModule } from "../coordinator/types";
import {
  isSolutionId,
  predictPrecipitation,
  type SolutionId
} from "./solubility";

export const PRECIPITATION_MODEL_ID = "chemistry-model.precipitation.v1";

const PRECIPITATION_CAPABILITY_ID = "chemistry.precipitation_solubility.v1";

export const PRECIPITATION_OBSERVABLE_IDS = Object.freeze({
  precipitateObserved: "observable.precipitate_observed.v1",
  precipitateColor: "observable.precipitate_color.v1"
} as const);

const ERROR = Object.freeze({
  invalidState: "chemistry-model.precipitation.invalid_state.v1",
  unknownReagent: "chemistry-model.precipitation.unknown_reagent.v1"
} as const);

export class PrecipitationModelError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PrecipitationModelError";
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new PrecipitationModelError(code, message);
}

/**
 * Registered aqueous reagents mapped onto the solubility vocabulary. Only
 * reagent IDs that exist in the registry appear here; an unmapped reagent is a
 * hard failure rather than a silent no-reaction.
 */
const REAGENT_SOLUTIONS: Readonly<Record<string, SolutionId>> = Object.freeze({
  "reagent.silver_nitrate_0_100m.v1": "silver_nitrate",
  "reagent.sodium_chloride_0_100m.v1": "sodium_chloride",
  "reagent.sodium_chloride_aqueous.v1": "sodium_chloride",
  "reagent.sodium_chloride_1_000m.v1": "sodium_chloride"
});

const FIELD = Object.freeze({
  contents: "contents",
  formsPrecipitate: "formsPrecipitate",
  precipitateId: "precipitateId",
  precipitateFormula: "precipitateFormula",
  precipitateColor: "precipitateColor",
  netIonicEquation: "netIonicEquation",
  spectatorIons: "spectatorIons"
} as const);

/** Container contents travel as sorted `container=solution` pairs. */
const CONTENTS_SEPARATOR = "=";

function field(
  state: readonly GenericStateField[],
  key: string
): GenericStateField {
  const found = state.find((entry) => entry.key === key);
  if (!found) fail(ERROR.invalidState, `Missing precipitation field ${key}.`);
  return found;
}

function stringListField(
  state: readonly GenericStateField[],
  key: string
): readonly string[] {
  const { value } = field(state, key);
  if (!Array.isArray(value)) {
    fail(ERROR.invalidState, `Precipitation field ${key} must be a list.`);
  }
  return value;
}

function solutionFor(materialProfileId: string): SolutionId {
  const solutionId = REAGENT_SOLUTIONS[materialProfileId];
  if (!solutionId || !isSolutionId(solutionId)) {
    fail(
      ERROR.unknownReagent,
      `Reagent ${materialProfileId} has no registered solubility mapping.`
    );
  }
  return solutionId;
}

function encode(containerInstanceId: string, solutionId: SolutionId): string {
  return `${containerInstanceId}${CONTENTS_SEPARATOR}${solutionId}`;
}

function decode(entry: string): {
  readonly containerInstanceId: string;
  readonly solutionId: SolutionId;
} {
  const separatorIndex = entry.indexOf(CONTENTS_SEPARATOR);
  if (separatorIndex <= 0) {
    fail(ERROR.invalidState, `Malformed contents entry ${entry}.`);
  }
  const containerInstanceId = entry.slice(0, separatorIndex);
  const solutionId = entry.slice(separatorIndex + 1);
  if (!isSolutionId(solutionId)) {
    fail(ERROR.invalidState, `Unknown solution ${solutionId} in contents.`);
  }
  return { containerInstanceId, solutionId };
}

function emptyResultFields(): readonly GenericStateField[] {
  return [
    { key: FIELD.formsPrecipitate, value: false },
    { key: FIELD.precipitateId, value: null },
    { key: FIELD.precipitateFormula, value: null },
    { key: FIELD.precipitateColor, value: "clear" },
    { key: FIELD.netIonicEquation, value: "" },
    { key: FIELD.spectatorIons, value: [] as readonly string[] }
  ];
}

/**
 * Seed one contents entry per material binding, recording which solution is
 * sitting in which container before the student touches anything.
 */
function initialState(
  context: Parameters<GenericChemistryModule["initialize"]>[0]
): readonly GenericStateField[] {
  const contents = context.materialBindings
    .map((binding) =>
      encode(binding.containerInstanceId, solutionFor(binding.materialProfileId))
    )
    .sort();

  return [
    { key: FIELD.contents, value: Object.freeze(contents) },
    ...emptyResultFields()
  ];
}

/**
 * Record delivered solutions and, once a container holds two distinct ones,
 * ask the solubility rules what forms. The prediction is a pure function of
 * the pair, so re-deriving it is stable across replay.
 */
function applyTransfers(
  action: Parameters<GenericChemistryModule["applyMaterialAction"]>[0],
  state: readonly GenericStateField[]
): readonly GenericStateField[] {
  const contents = new Set(stringListField(state, FIELD.contents));

  for (const transfer of action.transfers) {
    if (transfer.amount <= 0) continue;
    contents.add(
      encode(transfer.targetEquipmentInstanceId, solutionFor(transfer.materialProfileId))
    );
  }

  const nextContents = Object.freeze([...contents].sort());

  const byContainer = new Map<string, Set<SolutionId>>();
  for (const entry of nextContents) {
    const { containerInstanceId, solutionId } = decode(entry);
    const existing = byContainer.get(containerInstanceId) ?? new Set();
    existing.add(solutionId);
    byContainer.set(containerInstanceId, existing);
  }

  // Deterministic scan: containers in sorted order, first mixed pair wins.
  const mixed = [...byContainer.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .find(([, solutions]) => solutions.size >= 2);

  if (!mixed) {
    return [
      { key: FIELD.contents, value: nextContents },
      ...emptyResultFields()
    ];
  }

  const [solutionA, solutionB] = [...mixed[1]].sort();
  const result = predictPrecipitation(solutionA, solutionB);

  return [
    { key: FIELD.contents, value: nextContents },
    { key: FIELD.formsPrecipitate, value: result.formsPrecipitate },
    { key: FIELD.precipitateId, value: result.precipitateId },
    { key: FIELD.precipitateFormula, value: result.formula },
    { key: FIELD.precipitateColor, value: result.color },
    { key: FIELD.netIonicEquation, value: result.netIonicEquation },
    {
      key: FIELD.spectatorIons,
      value: Object.freeze([...result.spectatorIons].sort())
    }
  ];
}

const applyMaterialAction: GenericChemistryModule["applyMaterialAction"] = (
  action,
  state
) => ({ state: applyTransfers(action, state) });

function observables(state: readonly GenericStateField[]) {
  const formsPrecipitate = field(state, FIELD.formsPrecipitate).value;
  const color = field(state, FIELD.precipitateColor).value;
  return [
    {
      observableId: PRECIPITATION_OBSERVABLE_IDS.precipitateObserved,
      value: typeof formsPrecipitate === "boolean" ? formsPrecipitate : false
    },
    {
      observableId: PRECIPITATION_OBSERVABLE_IDS.precipitateColor,
      value: typeof color === "string" ? color : "clear"
    }
  ];
}

/**
 * Precipitation chemistry over the shared material ledger. It owns no
 * apparatus state and no volumes — it reads the transfers mechanics report and
 * projects the deterministic solubility outcome.
 */
export const PRECIPITATION_MODULE: GenericChemistryModule = Object.freeze({
  id: PRECIPITATION_MODEL_ID,
  version: "1.0.0",
  providedCapabilityIds: [PRECIPITATION_CAPABILITY_ID] as const,
  requiredCapabilityIds: [
    "chemistry.material_ledger.v1",
    "chemistry.volume_conservation.v1",
    "chemistry.solution_mixing.v1"
  ] as const,
  initialize: initialState,
  applyMaterialAction: applyMaterialAction,
  deriveObservables: observables
});
