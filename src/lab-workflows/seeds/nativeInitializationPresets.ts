import { equivalenceVolumeML } from "../chemistry-models/acid-base";
import {
  MATERIAL_LEDGER_SCHEMA_VERSION,
  validateMaterialLedger,
  type MaterialLedger
} from "../chemistry-models/material-ledger";
import type {
  CompiledEquipmentBinding,
  CompiledGenericLabProgram,
  CompiledMaterialBinding,
  GenericStateValue
} from "../runtime/generic/types";

const ACID_BASE_CAPABILITY_ID = "chemistry.acid_base_equilibrium.v1";
const BURETTE_COMPONENT_ID = "component.burette.v1";
const FLASK_COMPONENT_ID = "component.erlenmeyer_flask.v1";
const INDICATOR_BOTTLE_COMPONENT_ID = "component.indicator_bottle.v1";
const ML_UNIT_ID = "unit.ml.v1";

export const NATIVE_NEAR_ENDPOINT_PRESET_ID =
  "seed.titration.near_endpoint_22ml.v1" as const;

export class NativeInitializationPresetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NativeInitializationPresetError";
  }
}

export interface NativeInitializationPresetContext {
  readonly program: Readonly<CompiledGenericLabProgram>;
  readonly authoredMaterialLedger: Readonly<MaterialLedger>;
}

export interface NativeEquipmentFieldOverride {
  readonly equipmentInstanceId: string;
  readonly fields: Readonly<Record<string, GenericStateValue>>;
}

/**
 * Deterministic seed produced by a registered native initialization preset.
 *
 * The runtime seeds the material ledger first (so mechanical initializers
 * derive contained volumes, fill flags, and meniscus readings from material
 * truth), then applies the equipment field overrides for mechanical history
 * the ledger cannot express (conditioning solvent, committed indicator
 * addition, cumulative delivery).
 */
export interface NativeInitializationSeed {
  readonly materialLedger: MaterialLedger;
  readonly equipmentFieldOverrides: readonly NativeEquipmentFieldOverride[];
  readonly simulatedElapsedSeconds: number;
}

export interface NativeInitializationPreset {
  readonly id: string;
  createSeed(
    context: Readonly<NativeInitializationPresetContext>
  ): NativeInitializationSeed;
}

function fail(message: string): never {
  throw new NativeInitializationPresetError(message);
}

function exactlyOneEquipment(
  program: Readonly<CompiledGenericLabProgram>,
  equipmentDefinitionId: string
): Readonly<CompiledEquipmentBinding> {
  const matches = program.equipment.filter(
    (binding) => binding.equipmentDefinitionId === equipmentDefinitionId
  );
  if (matches.length !== 1) {
    fail(
      `The near-endpoint preset requires exactly one ${equipmentDefinitionId}.`
    );
  }
  return matches[0]!;
}

function ledgerAmountAt(
  ledger: Readonly<MaterialLedger>,
  materialInstanceId: string,
  equipmentInstanceId: string
): number {
  return (
    ledger.materials
      .find((entry) => entry.materialInstanceId === materialInstanceId)
      ?.locations.find(
        (location) => location.equipmentInstanceId === equipmentInstanceId
      )?.amount ?? 0
  );
}

/**
 * Native equivalent of the legacy `seed.titration.near_endpoint_22ml.v1`
 * template: the bench arrives conditioned and filled with the indicator
 * committed and titrant already delivered to three milliliters (rounded to
 * hundredths) before equivalence, thirty simulated seconds in.
 */
function createNearEndpointSeed(
  context: Readonly<NativeInitializationPresetContext>
): NativeInitializationSeed {
  const { program, authoredMaterialLedger } = context;
  const burette = exactlyOneEquipment(program, BURETTE_COMPONENT_ID);
  const flask = exactlyOneEquipment(program, FLASK_COMPONENT_ID);

  const acidBaseMaterials = program.materials.filter((binding) =>
    binding.providedChemistryCapabilityIds.includes(ACID_BASE_CAPABILITY_ID)
  );
  const analytes = acidBaseMaterials.filter(
    (binding) => binding.containerInstanceId === flask.instanceId
  );
  const titrants = acidBaseMaterials.filter(
    (binding) => binding.containerInstanceId !== flask.instanceId
  );
  if (analytes.length !== 1 || titrants.length !== 1) {
    fail(
      "The near-endpoint preset requires exactly one flask-bound analyte and one titrant."
    );
  }
  const analyte = analytes[0]! as Readonly<CompiledMaterialBinding>;
  const titrant = titrants[0]! as Readonly<CompiledMaterialBinding>;
  if (
    analyte.initialConcentrationM === null ||
    titrant.initialConcentrationM === null ||
    analyte.quantityUnitId !== ML_UNIT_ID ||
    titrant.quantityUnitId !== ML_UNIT_ID
  ) {
    fail(
      "The near-endpoint preset requires milliliter analyte and titrant bindings with exact concentrations."
    );
  }
  const analyteVolumeML = ledgerAmountAt(
    authoredMaterialLedger,
    analyte.instanceId,
    flask.instanceId
  );
  if (analyteVolumeML <= 0) {
    fail("The near-endpoint preset requires the analyte inside the flask.");
  }

  const equivalenceML = equivalenceVolumeML(
    {
      analyte: {
        type: "strong_acid",
        concentrationM: analyte.initialConcentrationM,
        volumeML: analyteVolumeML
      },
      titrant: { concentrationM: titrant.initialConcentrationM }
    },
    1
  );
  const capacityML = burette.measurement?.capacityML ?? 0;
  // Same window as the legacy retry seed builder: three milliliters before
  // equivalence, positive, within capacity, at most five milliliters out.
  const deliveredML = Math.round((equivalenceML - 3) * 100) / 100;
  if (
    !Number.isFinite(deliveredML) ||
    deliveredML <= 0 ||
    deliveredML >= capacityML ||
    equivalenceML <= deliveredML ||
    equivalenceML - deliveredML > 5
  ) {
    fail(
      "These concentrations cannot support a near-endpoint seed within five milliliters of equivalence."
    );
  }

  const titrantTotal = titrant.quantityAmount;
  if (deliveredML >= titrantTotal) {
    fail("The bound titrant quantity cannot cover the seeded delivery.");
  }

  const materialLedger = validateMaterialLedger({
    schemaVersion: MATERIAL_LEDGER_SCHEMA_VERSION,
    materials: authoredMaterialLedger.materials.map((entry) =>
      entry.materialInstanceId === titrant.instanceId
        ? {
            ...entry,
            locations: [
              {
                equipmentInstanceId: titrant.containerInstanceId,
                amount: titrantTotal - deliveredML
              },
              { equipmentInstanceId: flask.instanceId, amount: deliveredML }
            ]
          }
        : {
            ...entry,
            locations: entry.locations.map((location) => ({ ...location }))
          }
    )
  });

  const indicatorBottles = program.equipment.filter(
    (binding) =>
      binding.equipmentDefinitionId === INDICATOR_BOTTLE_COMPONENT_ID
  );
  return {
    materialLedger,
    equipmentFieldOverrides: [
      {
        equipmentInstanceId: burette.instanceId,
        fields: { deliveredML, conditionedWith: "titrant" }
      },
      {
        equipmentInstanceId: flask.instanceId,
        fields: { indicatorAdded: true }
      },
      ...indicatorBottles.map((binding) => ({
        equipmentInstanceId: binding.instanceId,
        fields: { selected: true, added: true }
      }))
    ],
    simulatedElapsedSeconds: 30
  };
}

const NATIVE_INITIALIZATION_PRESETS: readonly NativeInitializationPreset[] =
  Object.freeze([
    Object.freeze({
      id: NATIVE_NEAR_ENDPOINT_PRESET_ID,
      createSeed: createNearEndpointSeed
    })
  ]);

export const NATIVE_INITIALIZATION_PRESET_IDS: readonly string[] =
  Object.freeze(NATIVE_INITIALIZATION_PRESETS.map(({ id }) => id));

export function resolveNativeInitializationPreset(
  presetId: string
): NativeInitializationPreset | null {
  return (
    NATIVE_INITIALIZATION_PRESETS.find(({ id }) => id === presetId) ?? null
  );
}
