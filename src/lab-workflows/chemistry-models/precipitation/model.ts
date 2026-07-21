import { materialAmountAt } from "../material-ledger";
import type { GenericStateField } from "../../runtime/generic/types";
import type {
  GenericChemistryActionContext,
  GenericChemistryModule,
  GenericChemistryModuleInitializationContext
} from "../coordinator/types";
import {
  inventoryFromSolutionPortions,
  isSolutionId,
  solvePrecipitationEquilibrium,
  type IonFormula,
  type PrecipitationEquilibrium,
  type SolutionId,
  type SolutionPortion
} from "./solubility";

export const PRECIPITATION_MODEL_ID = "chemistry-model.precipitation.v1";

const PRECIPITATION_CAPABILITY_ID = "chemistry.precipitation_solubility.v1";

export const PRECIPITATION_OBSERVABLE_IDS = Object.freeze({
  precipitateObserved: "observable.precipitate_observed.v1",
  precipitateColor: "observable.precipitate_color.v1",
  ionProduct: "observable.precipitation_ion_product.v1",
  solubilityProduct: "observable.solubility_product.v1",
  saturationRatio: "observable.precipitation_saturation_ratio.v1",
  precipitateAmountMol: "observable.precipitate_amount_mol.v1",
  precipitateMassG: "observable.precipitate_mass_g.v1",
  dissolvedSilverM: "observable.dissolved_silver_m.v1",
  dissolvedChlorideM: "observable.dissolved_chloride_m.v1"
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

/** Material identities select ionic composition; concentration comes from the compiled binding. */
const REAGENT_SOLUTIONS: Readonly<Record<string, SolutionId>> = Object.freeze({
  "reagent.silver_nitrate_0_100m.v1": "silver_nitrate",
  "reagent.sodium_chloride_0_100m.v1": "sodium_chloride",
  "reagent.sodium_chloride_aqueous.v1": "sodium_chloride",
  "reagent.sodium_chloride_1_000m.v1": "sodium_chloride",
  "reagent.distilled_water.v1": "distilled_water",
  "reagent.distilled_water_cold_20c.v1": "distilled_water",
  "reagent.distilled_water_hot_60c.v1": "distilled_water"
});

const FIELD = Object.freeze({
  bindingInputs: "bindingInputs",
  reactionContainerId: "reactionContainerId",
  formsPrecipitate: "formsPrecipitate",
  precipitateId: "precipitateId",
  precipitateFormula: "precipitateFormula",
  precipitateColor: "precipitateColor",
  netIonicEquation: "netIonicEquation",
  spectatorIons: "spectatorIons",
  dissolvedIonConcentrations: "dissolvedIonConcentrations",
  reactionQuotientBefore: "reactionQuotientBefore",
  solubilityProduct: "solubilityProduct",
  saturationRatioBefore: "saturationRatioBefore",
  precipitateMoles: "precipitateMoles",
  precipitateMassG: "precipitateMassG",
  totalVolumeL: "totalVolumeL"
} as const);

const PART_SEPARATOR = "\u001f";
const MASS_SCALE = 1_000_000;

interface BindingInput {
  readonly materialInstanceId: string;
  readonly solutionId: SolutionId;
  readonly concentrationM: number;
}

function field(
  state: readonly GenericStateField[],
  key: string
): GenericStateField {
  const found = state.find((entry) => entry.key === key);
  if (!found) fail(ERROR.invalidState, `Missing precipitation field ${key}.`);
  return found;
}

function numberField(state: readonly GenericStateField[], key: string): number {
  const value = field(state, key).value;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(ERROR.invalidState, `Precipitation field ${key} must be numeric.`);
  }
  return value;
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

function solutionFor(materialProfileId: string): SolutionId | null {
  const solutionId = REAGENT_SOLUTIONS[materialProfileId];
  if (solutionId !== undefined && isSolutionId(solutionId)) return solutionId;
  return null;
}

function encodeBinding(input: BindingInput): string {
  return [
    input.materialInstanceId,
    input.solutionId,
    String(input.concentrationM)
  ].join(PART_SEPARATOR);
}

function decodeBinding(value: string): BindingInput {
  const [materialInstanceId, solutionId, concentrationText, ...rest] =
    value.split(PART_SEPARATOR);
  const concentrationM = Number(concentrationText);
  if (
    rest.length > 0 ||
    !materialInstanceId ||
    !solutionId ||
    !isSolutionId(solutionId) ||
    !Number.isFinite(concentrationM) ||
    concentrationM < 0
  ) {
    fail(ERROR.invalidState, "Malformed precipitation material binding.");
  }
  return { materialInstanceId, solutionId, concentrationM };
}

function concentrationEntries(
  equilibrium: PrecipitationEquilibrium
): readonly string[] {
  return Object.entries(equilibrium.dissolvedIonConcentrationsM)
    .filter((entry): entry is [string, number] => entry[1] !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([formula, concentration]) =>
      [formula, String(concentration)].join(PART_SEPARATOR)
    );
}

function concentrationFor(
  state: readonly GenericStateField[],
  formula: IonFormula
): number {
  const prefix = `${formula}${PART_SEPARATOR}`;
  const entry = stringListField(state, FIELD.dissolvedIonConcentrations).find(
    (candidate) => candidate.startsWith(prefix)
  );
  if (!entry) return 0;
  const value = Number(entry.slice(prefix.length));
  if (!Number.isFinite(value) || value < 0) {
    fail(ERROR.invalidState, `Invalid dissolved concentration for ${formula}.`);
  }
  return value;
}

function emptyResultFields(): readonly GenericStateField[] {
  return [
    { key: FIELD.reactionContainerId, value: null },
    { key: FIELD.formsPrecipitate, value: false },
    { key: FIELD.precipitateId, value: null },
    { key: FIELD.precipitateFormula, value: null },
    { key: FIELD.precipitateColor, value: "clear" },
    { key: FIELD.netIonicEquation, value: "No reaction" },
    { key: FIELD.spectatorIons, value: [] as readonly string[] },
    { key: FIELD.dissolvedIonConcentrations, value: [] as readonly string[] },
    { key: FIELD.reactionQuotientBefore, value: 0 },
    { key: FIELD.solubilityProduct, value: 0 },
    { key: FIELD.saturationRatioBefore, value: 0 },
    { key: FIELD.precipitateMoles, value: 0 },
    { key: FIELD.precipitateMassG, value: 0 },
    { key: FIELD.totalVolumeL, value: 0 }
  ];
}

function resultFields(
  containerInstanceId: string,
  equilibrium: PrecipitationEquilibrium
): readonly GenericStateField[] {
  return [
    { key: FIELD.reactionContainerId, value: containerInstanceId },
    { key: FIELD.formsPrecipitate, value: equilibrium.formsPrecipitate },
    { key: FIELD.precipitateId, value: equilibrium.precipitateId },
    { key: FIELD.precipitateFormula, value: equilibrium.formula },
    { key: FIELD.precipitateColor, value: equilibrium.color },
    { key: FIELD.netIonicEquation, value: equilibrium.netIonicEquation },
    { key: FIELD.spectatorIons, value: [...equilibrium.spectatorIons] },
    {
      key: FIELD.dissolvedIonConcentrations,
      value: concentrationEntries(equilibrium)
    },
    {
      key: FIELD.reactionQuotientBefore,
      value: equilibrium.reactionQuotientBefore
    },
    {
      key: FIELD.solubilityProduct,
      value: equilibrium.solubilityProduct ?? 0
    },
    {
      key: FIELD.saturationRatioBefore,
      value: equilibrium.saturationRatioBefore
    },
    { key: FIELD.precipitateMoles, value: equilibrium.precipitateMoles },
    {
      key: FIELD.precipitateMassG,
      value: Math.round(equilibrium.precipitateMassG * MASS_SCALE) / MASS_SCALE
    },
    { key: FIELD.totalVolumeL, value: equilibrium.totalVolumeL }
  ];
}

function bindingsFrom(
  context: Readonly<GenericChemistryModuleInitializationContext>
): readonly BindingInput[] {
  return context.materialBindings.flatMap((binding) => {
    const solutionId = solutionFor(binding.materialProfileId);
    if (solutionId === null) {
      if (
        binding.providedChemistryCapabilityIds.includes(
          PRECIPITATION_CAPABILITY_ID
        )
      ) {
        fail(
          ERROR.unknownReagent,
          `Reagent ${binding.materialProfileId} has no registered ionic composition.`
        );
      }
      return [];
    }
    const concentrationM = binding.initialConcentrationM ?? 0;
    if (!Number.isFinite(concentrationM) || concentrationM < 0) {
      fail(
        ERROR.unknownReagent,
        `Reagent ${binding.materialProfileId} has no valid concentration.`
      );
    }
    return [
      { materialInstanceId: binding.instanceId, solutionId, concentrationM }
    ];
  });
}

function solveLedger(
  ledger: GenericChemistryActionContext["materialLedger"],
  bindings: readonly BindingInput[]
): {
  readonly containerInstanceId: string;
  readonly equilibrium: PrecipitationEquilibrium;
} | null {
  const byContainer = new Map<string, SolutionPortion[]>();
  for (const binding of bindings) {
    const material = ledger.materials.find(
      (candidate) => candidate.materialInstanceId === binding.materialInstanceId
    );
    if (!material || material.unitId !== "unit.ml.v1") continue;
    for (const location of material.locations) {
      const volumeML = materialAmountAt(
        ledger,
        material.materialInstanceId,
        location.equipmentInstanceId
      );
      if (volumeML <= 0) continue;
      const portions = byContainer.get(location.equipmentInstanceId) ?? [];
      portions.push({
        solutionId: binding.solutionId,
        concentrationM: binding.concentrationM,
        volumeML
      });
      byContainer.set(location.equipmentInstanceId, portions);
    }
  }

  const solved = [...byContainer.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([containerInstanceId, portions]) => ({
      containerInstanceId,
      equilibrium: solvePrecipitationEquilibrium(
        inventoryFromSolutionPortions(portions)
      )
    }))
    .filter(({ equilibrium }) => equilibrium.solubilityProduct !== null)
    .sort((left, right) => {
      if (
        left.equilibrium.saturationRatioBefore !==
        right.equilibrium.saturationRatioBefore
      ) {
        return (
          right.equilibrium.saturationRatioBefore -
          left.equilibrium.saturationRatioBefore
        );
      }
      return left.containerInstanceId.localeCompare(right.containerInstanceId);
    });
  return solved[0] ?? null;
}

function initialState(
  context: Parameters<GenericChemistryModule["initialize"]>[0]
): readonly GenericStateField[] {
  const bindings = bindingsFrom(context);
  const solved = solveLedger(context.materialLedger, bindings);
  return [
    {
      key: FIELD.bindingInputs,
      value: bindings.map(encodeBinding).sort()
    },
    ...(solved
      ? resultFields(solved.containerInstanceId, solved.equilibrium)
      : emptyResultFields())
  ];
}

const applyActionTransition: NonNullable<
  GenericChemistryModule["applyActionTransition"]
> = (context, state) => {
  const bindings = stringListField(state, FIELD.bindingInputs).map(
    decodeBinding
  );
  const solved = solveLedger(context.materialLedger, bindings);
  return {
    state: [
      { key: FIELD.bindingInputs, value: bindings.map(encodeBinding).sort() },
      ...(solved
        ? resultFields(solved.containerInstanceId, solved.equilibrium)
        : emptyResultFields())
    ]
  };
};

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
    },
    {
      observableId: PRECIPITATION_OBSERVABLE_IDS.ionProduct,
      value: numberField(state, FIELD.reactionQuotientBefore)
    },
    {
      observableId: PRECIPITATION_OBSERVABLE_IDS.solubilityProduct,
      value: numberField(state, FIELD.solubilityProduct)
    },
    {
      observableId: PRECIPITATION_OBSERVABLE_IDS.saturationRatio,
      value: numberField(state, FIELD.saturationRatioBefore)
    },
    {
      observableId: PRECIPITATION_OBSERVABLE_IDS.precipitateAmountMol,
      value: numberField(state, FIELD.precipitateMoles),
      unitId: "unit.mol.v1"
    },
    {
      observableId: PRECIPITATION_OBSERVABLE_IDS.precipitateMassG,
      value: numberField(state, FIELD.precipitateMassG),
      unitId: "unit.g.v1"
    },
    {
      observableId: PRECIPITATION_OBSERVABLE_IDS.dissolvedSilverM,
      value: concentrationFor(state, "Ag+"),
      unitId: "unit.mol_per_l.v1"
    },
    {
      observableId: PRECIPITATION_OBSERVABLE_IDS.dissolvedChlorideM,
      value: concentrationFor(state, "Cl-"),
      unitId: "unit.mol_per_l.v1"
    }
  ];
}

const applyMaterialAction: GenericChemistryModule["applyMaterialAction"] = (
  _action,
  state
) => ({ state });

const deriveGroundTruthValues: NonNullable<
  GenericChemistryModule["deriveGroundTruthValues"]
> = (state) => ({
  precipitateAmountMol: numberField(state, FIELD.precipitateMoles),
  precipitateMassG: numberField(state, FIELD.precipitateMassG),
  reactionQuotientBefore: numberField(state, FIELD.reactionQuotientBefore),
  solubilityProduct: numberField(state, FIELD.solubilityProduct)
});

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
  applyMaterialAction,
  applyActionTransition,
  deriveObservables: observables,
  deriveGroundTruthValues
});
