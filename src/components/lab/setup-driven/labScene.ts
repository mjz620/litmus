import type { SetupDrivenLabProjection } from "../../../stores/setupDrivenLabSession";
import { reagentRegistry } from "../../../lab-workflows/registries/reagents";
import { getAqueousSolutionColor } from "../three/solutionColor";
import {
  resolveEquipmentPose,
  type ResolvedEquipmentPose
} from "../../../lab-workflows/registries/scene-placements";
import {
  getVisibleControlGroups,
  type ControlGroupId,
  type EquipmentId
} from "./equipment";

export type LabVisualAdapterKind =
  | "burette"
  | "flask"
  | "indicator_shelf"
  | "wash_station"
  | "volumetric_pipette"
  | "volumetric_flask"
  | "wash_bottle"
  | "reagent_bottle"
  | "calorimeter"
  | "thermometer"
  | "beaker"
  | "balance"
  | "weighing_boat";

export interface LabVisualAdapterRegistration {
  readonly visualAdapterDefinitionId: string;
  readonly kind: LabVisualAdapterKind;
  readonly selectableEquipmentIds: readonly EquipmentId[];
}

export const LAB_VISUAL_ADAPTERS: Readonly<
  Record<string, LabVisualAdapterRegistration>
> = Object.freeze({
  "visual-adapter.burette.v1": Object.freeze({
    visualAdapterDefinitionId: "visual-adapter.burette.v1",
    kind: "burette",
    selectableEquipmentIds: Object.freeze(["burette", "meniscus"] as const)
  }),
  "visual-adapter.erlenmeyer_flask.v1": Object.freeze({
    visualAdapterDefinitionId: "visual-adapter.erlenmeyer_flask.v1",
    kind: "flask",
    selectableEquipmentIds: Object.freeze(["flask"] as const)
  }),
  "visual-adapter.indicator_bottle.v1": Object.freeze({
    visualAdapterDefinitionId: "visual-adapter.indicator_bottle.v1",
    kind: "indicator_shelf",
    selectableEquipmentIds: Object.freeze(["indicatorShelf"] as const)
  }),
  "visual-adapter.reagent_bottle.v1": Object.freeze({
    visualAdapterDefinitionId: "visual-adapter.reagent_bottle.v1",
    kind: "reagent_bottle",
    // Selectable id is resolved from the rest of the projection: titration
    // wash station vs dilution stock bottle share this adapter id.
    selectableEquipmentIds: Object.freeze([] as const)
  }),
  "visual-adapter.volumetric_pipette.v1": Object.freeze({
    visualAdapterDefinitionId: "visual-adapter.volumetric_pipette.v1",
    kind: "volumetric_pipette",
    selectableEquipmentIds: Object.freeze(["volumetricPipette"] as const)
  }),
  "visual-adapter.volumetric_flask.v1": Object.freeze({
    visualAdapterDefinitionId: "visual-adapter.volumetric_flask.v1",
    kind: "volumetric_flask",
    selectableEquipmentIds: Object.freeze(["volumetricFlask"] as const)
  }),
  "visual-adapter.wash_bottle.v1": Object.freeze({
    visualAdapterDefinitionId: "visual-adapter.wash_bottle.v1",
    kind: "wash_bottle",
    selectableEquipmentIds: Object.freeze(["washBottle"] as const)
  }),
  "visual-adapter.calorimeter.v1": Object.freeze({
    visualAdapterDefinitionId: "visual-adapter.calorimeter.v1",
    kind: "calorimeter",
    selectableEquipmentIds: Object.freeze(["calorimeter"] as const)
  }),
  "visual-adapter.thermometer.v1": Object.freeze({
    visualAdapterDefinitionId: "visual-adapter.thermometer.v1",
    kind: "thermometer",
    selectableEquipmentIds: Object.freeze(["thermometer"] as const)
  }),
  "visual-adapter.beaker.v1": Object.freeze({
    visualAdapterDefinitionId: "visual-adapter.beaker.v1",
    kind: "beaker",
    selectableEquipmentIds: Object.freeze(["beaker"] as const)
  }),
  "visual-adapter.balance.v1": Object.freeze({
    visualAdapterDefinitionId: "visual-adapter.balance.v1",
    kind: "balance",
    selectableEquipmentIds: Object.freeze(["balance"] as const)
  }),
  "visual-adapter.weighing_boat.v1": Object.freeze({
    visualAdapterDefinitionId: "visual-adapter.weighing_boat.v1",
    kind: "weighing_boat",
    selectableEquipmentIds: Object.freeze(["weighingBoat"] as const)
  })
});

function selectableEquipmentIdsForAdapter(
  adapter: LabVisualAdapterRegistration,
  hasBuretteAdapter: boolean
): readonly EquipmentId[] {
  if (adapter.kind !== "reagent_bottle") {
    return adapter.selectableEquipmentIds;
  }

  // The same registered bottle adapter is presented as titration's wash
  // station when a burette is on the bench, and as a stock bottle elsewhere.
  return hasBuretteAdapter ? ["washStation"] : ["reagentBottle"];
}

const ACTION_CONTROL_GROUP: Readonly<Record<string, ControlGroupId>> =
  Object.freeze({
    "action.rinse.v1": "prepare",
    "action.fill.v1": "prepare",
    "action.select_indicator.v1": "indicator",
    "action.add_indicator.v1": "indicator",
    "action.dispense.v1": "deliver",
    "action.read_volume.v1": "reading",
    "action.rinse_transfer_device.v1": "solution",
    "action.transfer_liquid.v1": "solution",
    "action.fill_to_mark.v1": "solution",
    "action.mix_solution.v1": "solution",
    "action.pour_liquid.v1": "calorimetry",
    "action.mix_calorimeter.v1": "calorimetry",
    "action.set_calorimeter_lid.v1": "calorimetry",
    "action.place_thermometer.v1": "calorimetry",
    "action.remove_thermometer.v1": "calorimetry",
    "action.read_temperature.v1": "calorimetry",
    "action.tare_balance.v1": "weighing",
    "action.place_on_balance.v1": "weighing",
    "action.remove_from_balance.v1": "weighing",
    "action.transfer_solid.v1": "weighing",
    "action.collect_precipitate.v1": "weighing",
    "action.read_balance.v1": "weighing"
  });

export const SETUP_DRIVEN_SCENE_ERROR_CODES = Object.freeze({
  visualAdapterUnknown: "setup-scene.visual_adapter_unknown.v1",
  placementUnsupported: "setup-scene.placement_unsupported.v1",
  actionAdapterUnknown: "setup-scene.action_adapter_unknown.v1",
  equipmentReferenceUnknown: "setup-scene.equipment_reference_unknown.v1",
  equipmentStateInvalid: "setup-scene.equipment_state_invalid.v1"
} as const);

type SetupDrivenSceneErrorCode =
  (typeof SETUP_DRIVEN_SCENE_ERROR_CODES)[keyof typeof SETUP_DRIVEN_SCENE_ERROR_CODES];

export class SetupDrivenSceneError extends Error {
  readonly code: SetupDrivenSceneErrorCode;
  readonly registryId: string;

  constructor(
    code: SetupDrivenSceneErrorCode,
    registryId: string,
    message: string
  ) {
    super(message);
    this.name = "SetupDrivenSceneError";
    this.code = code;
    this.registryId = registryId;
  }
}

export interface LabSceneConfiguration {
  readonly mode: "legacy" | "setup_driven_v2";
  readonly workflowId: string | null;
  readonly workflowHash: string | null;
  readonly equipmentInstanceIds: readonly string[];
  readonly equipmentPoses: readonly ResolvedEquipmentPose[];
  readonly selectableEquipmentIds: readonly EquipmentId[];
  readonly availableActionIds: readonly string[];
  readonly availableControlGroups: readonly ControlGroupId[];
  readonly minDispenseVolumeML: number | null;
  readonly maxDispenseVolumeML: number | null;
  /** Fill fraction 0–1 keyed by visual adapter definition id. */
  readonly equipmentFillFractions: Readonly<Record<string, number>>;
  /**
   * Liquid colour per visual adapter, for vessels holding an aqueous reagent
   * that publishes an appearance. Adapters are absent from this map when the
   * contents are colourless, so the scene keeps its own default.
   */
  readonly equipmentLiquidColors: Readonly<Record<string, string>>;
  readonly projectedState: {
    readonly burette: {
      readonly availableML: number;
      readonly capacityML: number;
      readonly deliveredML: number;
      readonly meniscusReadingML: number;
    } | null;
    readonly flask: {
      readonly observableColor: string;
      readonly indicatorAdded: boolean;
    } | null;
    readonly beaker: {
      readonly observableColor: string;
    } | null;
    readonly balance: {
      readonly readingG: number;
      readonly resolutionG: number;
    } | null;
    readonly weighingBoat: {
      /** Fraction of a nominal full boat, for the heap visual only. */
      readonly solidFraction: number;
    } | null;
    readonly reagentBottleContents: "liquid" | "solid";
  } | null;
}

/** Nominal full boat for the heap visual only; never a chemistry quantity. */
const WEIGHING_BOAT_VISUAL_FULL_G = 5;

function isSolidProfile(materialProfileId: string): boolean {
  return reagentRegistry.has(materialProfileId)
    ? reagentRegistry.get(materialProfileId).phase === "solid"
    : false;
}

/**
 * How full the boat looks, from the ledger's solid mass at that instance.
 * Purely presentational: the engine owns the mass, this only sizes a heap.
 */
function solidGramsAt(
  projection: Readonly<SetupDrivenLabProjection>,
  equipmentInstanceId: string
): number {
  return projection.materials.reduce((total, material) => {
    if (!isSolidProfile(material.materialProfileId)) return total;
    const here = material.locations.find(
      (location) => location.equipmentInstanceId === equipmentInstanceId
    );
    return total + (here?.amount ?? 0);
  }, 0);
}

/**
 * Millilitres of liquid the ledger places at a vessel.
 *
 * The reagent bottle's registered state is only `{reagentInstanceId,
 * selected}` — it has no `capacityML`, `availableML`, or `totalVolumeML` — so
 * a volume-field lookup returns 0 and the bottle renders as empty glass while
 * the student is told to pipette from it. The ledger is the engine's own
 * record of what is in there, so read that instead.
 */
function liquidMLAt(
  projection: Readonly<SetupDrivenLabProjection>,
  equipmentInstanceId: string
): number {
  return projection.materials.reduce((total, material) => {
    if (isSolidProfile(material.materialProfileId)) return total;
    const here = material.locations.find(
      (location) => location.equipmentInstanceId === equipmentInstanceId
    );
    return total + (here?.amount ?? 0);
  }, 0);
}

const SOLUTION_CONCENTRATION_OBSERVABLE_ID =
  "observable.solution_concentration_m.v1";
const STOCK_CONCENTRATION_OBSERVABLE_ID = "observable.stock_concentration_m.v1";

function observableNumber(
  projection: Readonly<SetupDrivenLabProjection>,
  observableId: string
): number | null {
  const value = projection.observables[observableId];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Colour of the liquid in a vessel, from the reagent's published appearance
 * and the concentration the engine reports.
 *
 * Only aqueous reagents that publish an appearance tint anything; everything
 * else stays the solvent colour, which is what distilled water and a
 * colourless solute both look like. The vessel that is being diluted reads
 * the flask concentration; every other vessel holds undiluted stock, so it
 * reads the stock concentration. Both numbers come from the chemistry model —
 * the scene converts a concentration to a colour and computes no chemistry.
 */
function liquidColorFor(
  projection: Readonly<SetupDrivenLabProjection>,
  equipment: SetupDrivenLabProjection["equipment"][number],
  isDilutionTarget: boolean
): string | null {
  let appearance: NonNullable<
    ReturnType<typeof reagentRegistry.get>["aqueousAppearance"]
  > | null = null;
  let dominantAmount = 0;

  for (const material of projection.materials) {
    const here = material.locations.find(
      (location) => location.equipmentInstanceId === equipment.instanceId
    );
    if (!here || here.amount <= 0) continue;
    if (!reagentRegistry.has(material.materialProfileId)) continue;
    const entry = reagentRegistry.get(material.materialProfileId);
    if (entry.phase !== "aqueous_solution" || !entry.aqueousAppearance)
      continue;
    /*
     * Diluent water outweighs the aliquot in the flask, so the tint is chosen
     * among reagents that actually absorb rather than by raw volume.
     */
    if (here.amount > dominantAmount) {
      dominantAmount = here.amount;
      appearance = entry.aqueousAppearance;
    }
  }

  if (!appearance) return null;

  const concentrationM = observableNumber(
    projection,
    isDilutionTarget
      ? SOLUTION_CONCENTRATION_OBSERVABLE_ID
      : STOCK_CONCENTRATION_OBSERVABLE_ID
  );
  return getAqueousSolutionColor(appearance, concentrationM);
}

function solidFractionAt(
  projection: Readonly<SetupDrivenLabProjection>,
  equipmentInstanceId: string
): number {
  return Math.max(
    0,
    Math.min(1, solidGramsAt(projection, equipmentInstanceId) / WEIGHING_BOAT_VISUAL_FULL_G)
  );
}

/**
 * A clear stock bottle must not render a solid as a column of liquid, so the
 * bottle asks the reagent registry what phase it is actually holding.
 */
function reagentBottlePhase(
  projection: Readonly<SetupDrivenLabProjection>
): "liquid" | "solid" {
  const bottles = new Set(
    projection.equipment
      .filter(
        ({ visualAdapterDefinitionId }) =>
          visualAdapterDefinitionId === "visual-adapter.reagent_bottle.v1"
      )
      .map(({ instanceId }) => instanceId)
  );
  if (bottles.size === 0) return "liquid";
  const holdsSolid = projection.materials.some(
    (material) =>
      isSolidProfile(material.materialProfileId) &&
      material.locations.some(
        (location) =>
          bottles.has(location.equipmentInstanceId) && location.amount > 0
      )
  );
  return holdsSolid ? "solid" : "liquid";
}

/** Registered chemistry observable carrying the precipitate appearance. */
const PRECIPITATE_COLOR_OBSERVABLE_ID = "observable.precipitate_color.v1";

const LEGACY_SCENE_CONFIGURATION: LabSceneConfiguration = Object.freeze({
  mode: "legacy",
  workflowId: null,
  workflowHash: null,
  equipmentInstanceIds: Object.freeze([]),
  equipmentPoses: Object.freeze([]),
  selectableEquipmentIds: Object.freeze([
    "burette",
    "flask",
    "meniscus",
    "indicatorShelf",
    "washStation"
  ] as const),
  availableActionIds: Object.freeze([
    "action.rinse.v1",
    "action.fill.v1",
    "action.select_indicator.v1",
    "action.add_indicator.v1",
    "action.dispense.v1",
    "action.read_volume.v1"
  ]),
  availableControlGroups: Object.freeze([
    "prepare",
    "indicator",
    "deliver",
    "reading"
  ] as const),
  minDispenseVolumeML: null,
  maxDispenseVolumeML: null,
  equipmentFillFractions: Object.freeze({}),
  equipmentLiquidColors: Object.freeze({}),
  projectedState: null
});

function numberField(
  equipment: SetupDrivenLabProjection["equipment"][number],
  key: string
): number {
  const value = equipment.stateFields[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new SetupDrivenSceneError(
      SETUP_DRIVEN_SCENE_ERROR_CODES.equipmentStateInvalid,
      `${equipment.instanceId}.${key}`,
      `Equipment state ${equipment.instanceId}.${key} is not a finite number.`
    );
  }
  return value;
}

function optionalNumberField(
  equipment: SetupDrivenLabProjection["equipment"][number],
  key: string,
  fallback = 0
): number {
  const value = equipment.stateFields[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringField(
  equipment: SetupDrivenLabProjection["equipment"][number],
  key: string
): string {
  const value = equipment.stateFields[key];
  if (typeof value !== "string") {
    throw new SetupDrivenSceneError(
      SETUP_DRIVEN_SCENE_ERROR_CODES.equipmentStateInvalid,
      `${equipment.instanceId}.${key}`,
      `Equipment state ${equipment.instanceId}.${key} is not a string.`
    );
  }
  return value;
}

function booleanField(
  equipment: SetupDrivenLabProjection["equipment"][number],
  key: string
): boolean {
  const value = equipment.stateFields[key];
  if (typeof value !== "boolean") {
    throw new SetupDrivenSceneError(
      SETUP_DRIVEN_SCENE_ERROR_CODES.equipmentStateInvalid,
      `${equipment.instanceId}.${key}`,
      `Equipment state ${equipment.instanceId}.${key} is not boolean.`
    );
  }
  return value;
}

/** Nominal full solid stock jar, for the visible bed only. */
const SOLID_STOCK_VISUAL_FULL_G = 25;
/** Floor so a small classroom sample is still visibly present in the jar. */
const SOLID_STOCK_VISUAL_MIN_FRACTION = 0.18;

/** Nominal full stock bottle for vessels that register no capacity. */
const LIQUID_STOCK_VISUAL_FULL_ML = 50;
/** Floor so a nearly-drained stock bottle still reads as holding liquid. */
const LIQUID_STOCK_VISUAL_MIN_FRACTION = 0.2;

/**
 * How full a vessel looks.
 *
 * Solids carry no volume — a stock jar of ammonium nitrate has no
 * `capacityML`, `availableML`, or `totalVolumeML` — so this returned 0 for
 * them and the contents mesh was never rendered at all. The jar read as empty
 * glass, which is why colouring it as a solid changed nothing. Fall back to
 * the ledger's solid mass at that vessel.
 */
function fillFractionFor(
  projection: Readonly<SetupDrivenLabProjection>,
  equipment: SetupDrivenLabProjection["equipment"][number]
): number {
  const capacity = optionalNumberField(equipment, "capacityML", 0);
  const available = optionalNumberField(
    equipment,
    "availableML",
    optionalNumberField(equipment, "totalVolumeML", 0)
  );
  if (capacity > 0) return Math.max(0, Math.min(1, available / capacity));
  if (available > 0) return 0.7;

  /*
   * Vessels with no volume state at all — the reagent bottle — still have a
   * ledger entry. Without this the stock bottle renders empty.
   */
  const liquidML = liquidMLAt(projection, equipment.instanceId);
  if (liquidML > 0) {
    return Math.max(
      LIQUID_STOCK_VISUAL_MIN_FRACTION,
      Math.min(1, liquidML / LIQUID_STOCK_VISUAL_FULL_ML)
    );
  }

  const grams = solidGramsAt(projection, equipment.instanceId);
  if (grams <= 0) return 0;
  return Math.max(
    SOLID_STOCK_VISUAL_MIN_FRACTION,
    Math.min(1, grams / SOLID_STOCK_VISUAL_FULL_G)
  );
}

/**
 * Resolve exact registered visual adapters and poses for the shared immersive
 * lab scene. Titration requires burette+flask when those adapters are present;
 * native solution-preparation labs may omit them.
 */
export function resolveLabSceneConfiguration(
  projection: Readonly<SetupDrivenLabProjection> | null
): Readonly<LabSceneConfiguration> {
  if (!projection) return LEGACY_SCENE_CONFIGURATION;

  const selectableEquipmentIds: EquipmentId[] = [];
  const equipmentPoses: ResolvedEquipmentPose[] = [];
  const equipmentFillFractions: Record<string, number> = {};
  const equipmentLiquidColors: Record<string, string> = {};
  let buretteState: NonNullable<
    NonNullable<LabSceneConfiguration["projectedState"]>["burette"]
  > | null = null;
  let flaskState: NonNullable<
    NonNullable<LabSceneConfiguration["projectedState"]>["flask"]
  > | null = null;
  let beakerState: NonNullable<
    NonNullable<LabSceneConfiguration["projectedState"]>["beaker"]
  > | null = null;
  let balanceState: NonNullable<
    NonNullable<LabSceneConfiguration["projectedState"]>["balance"]
  > | null = null;
  let weighingBoatInstanceId: string | null = null;
  let hasBuretteAdapter = false;
  let hasFlaskAdapter = false;
  const equipmentIds = new Set(
    projection.equipment.map(({ instanceId }) => instanceId)
  );
  for (const equipment of projection.equipment) {
    const adapter = LAB_VISUAL_ADAPTERS[equipment.visualAdapterDefinitionId];
    if (!adapter) {
      throw new SetupDrivenSceneError(
        SETUP_DRIVEN_SCENE_ERROR_CODES.visualAdapterUnknown,
        equipment.visualAdapterDefinitionId,
        `No exact lab visual adapter is registered for ${equipment.visualAdapterDefinitionId}.`
      );
    }
    try {
      equipmentPoses.push(
        resolveEquipmentPose({
          equipmentInstanceId: equipment.instanceId,
          equipmentDefinitionId: equipment.equipmentDefinitionId,
          visualAdapterDefinitionId: equipment.visualAdapterDefinitionId,
          placementSlotId: equipment.placementSlotId
        })
      );
    } catch {
      throw new SetupDrivenSceneError(
        SETUP_DRIVEN_SCENE_ERROR_CODES.placementUnsupported,
        equipment.placementSlotId,
        `${equipment.placementSlotId} is not a verified pose for ${adapter.visualAdapterDefinitionId}.`
      );
    }
    equipmentFillFractions[equipment.visualAdapterDefinitionId] =
      fillFractionFor(projection, equipment);
    const liquidColor = liquidColorFor(
      projection,
      equipment,
      adapter.kind === "volumetric_flask"
    );
    if (liquidColor) {
      equipmentLiquidColors[equipment.visualAdapterDefinitionId] = liquidColor;
    }
    for (const equipmentId of adapter.selectableEquipmentIds) {
      if (!selectableEquipmentIds.includes(equipmentId)) {
        selectableEquipmentIds.push(equipmentId);
      }
    }
    if (adapter.kind === "burette") {
      hasBuretteAdapter = true;
      buretteState = Object.freeze({
        availableML: numberField(equipment, "availableML"),
        capacityML: numberField(equipment, "capacityML"),
        deliveredML: numberField(equipment, "deliveredML"),
        meniscusReadingML: numberField(equipment, "meniscusReadingML")
      });
    }
    if (adapter.kind === "flask") {
      hasFlaskAdapter = true;
      flaskState = Object.freeze({
        observableColor: stringField(equipment, "observableColor"),
        indicatorAdded: booleanField(equipment, "indicatorAdded")
      });
    }
    if (adapter.kind === "balance") {
      balanceState = Object.freeze({
        readingG: numberField(equipment, "currentReadingG"),
        resolutionG: numberField(equipment, "resolutionG")
      });
    }
    if (adapter.kind === "weighing_boat") {
      weighingBoatInstanceId = equipment.instanceId;
    }
    if (adapter.kind === "beaker") {
      /*
       * Precipitation runs in the beaker, and the precipitate colour is owned
       * by the chemistry model rather than by the vessel, so it arrives as a
       * registered observable. Fall back to the beaker's own field for
       * workflows whose contents are apparatus-owned. Projecting this is what
       * makes a precipitate visible at all.
       */
      const precipitateColor =
        projection.observables[PRECIPITATE_COLOR_OBSERVABLE_ID];
      beakerState = Object.freeze({
        observableColor:
          typeof precipitateColor === "string" && precipitateColor.length > 0
            ? precipitateColor
            : stringField(equipment, "observableColor")
      });
    }
  }
  for (const equipment of projection.equipment) {
    if (
      equipment.visualAdapterDefinitionId !== "visual-adapter.reagent_bottle.v1"
    ) {
      continue;
    }
    /*
     * A reagent bottle is only titration's wash station when the bench
     * actually has a burette. Keying off the volumetric flask instead meant
     * every lab without one — calorimetry, precipitation — classified its
     * stock bottles as "washStation", so LabScene drew titration's wash
     * station (which has bespoke hotspots and no Interactable) in place of the
     * bottles, and the precipitation bench listed equipment it does not have.
     */
    for (const selectableId of selectableEquipmentIdsForAdapter(
      LAB_VISUAL_ADAPTERS[equipment.visualAdapterDefinitionId]!,
      hasBuretteAdapter
    )) {
      if (!selectableEquipmentIds.includes(selectableId)) {
        selectableEquipmentIds.push(selectableId);
      }
    }
  }
  if (
    hasBuretteAdapter !== Boolean(buretteState) ||
    hasFlaskAdapter !== Boolean(flaskState)
  ) {
    throw new SetupDrivenSceneError(
      SETUP_DRIVEN_SCENE_ERROR_CODES.equipmentStateInvalid,
      projection.workflowId,
      "Burette and flask adapters require exact projected state fields."
    );
  }
  if (hasBuretteAdapter && !hasFlaskAdapter) {
    throw new SetupDrivenSceneError(
      SETUP_DRIVEN_SCENE_ERROR_CODES.equipmentStateInvalid,
      projection.workflowId,
      "The titration scene requires both burette and flask projections when either is present."
    );
  }
  if (hasFlaskAdapter && !hasBuretteAdapter) {
    throw new SetupDrivenSceneError(
      SETUP_DRIVEN_SCENE_ERROR_CODES.equipmentStateInvalid,
      projection.workflowId,
      "The titration scene requires both burette and flask projections when either is present."
    );
  }

  const availableActionIds: string[] = [];
  const availableControlGroups: ControlGroupId[] = [];
  let minDispenseVolumeML: number | null = null;
  let maxDispenseVolumeML: number | null = null;
  for (const action of projection.actions) {
    if (
      (action.sourceEquipmentInstanceId !== null &&
        !equipmentIds.has(action.sourceEquipmentInstanceId)) ||
      action.targetEquipmentInstanceIds.some((id) => !equipmentIds.has(id))
    ) {
      throw new SetupDrivenSceneError(
        SETUP_DRIVEN_SCENE_ERROR_CODES.equipmentReferenceUnknown,
        action.permissionId,
        `Action permission ${action.permissionId} references unavailable equipment.`
      );
    }
    const controlGroup = ACTION_CONTROL_GROUP[action.actionId];
    if (!controlGroup) {
      throw new SetupDrivenSceneError(
        SETUP_DRIVEN_SCENE_ERROR_CODES.actionAdapterUnknown,
        action.actionId,
        `No exact lab control adapter is registered for ${action.actionId}.`
      );
    }
    if (action.actionId === "action.dispense.v1") {
      const volumeBounds = action.numericParameterBounds.find(
        ({ parameterKey }) => parameterKey === "volumeML"
      );
      if (
        !volumeBounds ||
        volumeBounds.effectiveMinimum === null ||
        volumeBounds.effectiveMaximum === null ||
        !Number.isFinite(volumeBounds.effectiveMinimum) ||
        !Number.isFinite(volumeBounds.effectiveMaximum) ||
        volumeBounds.effectiveMinimum <= 0 ||
        volumeBounds.effectiveMaximum < volumeBounds.effectiveMinimum
      ) {
        throw new SetupDrivenSceneError(
          SETUP_DRIVEN_SCENE_ERROR_CODES.equipmentStateInvalid,
          `${action.permissionId}.volumeML`,
          `Action permission ${action.permissionId} has invalid volume bounds.`
        );
      }
      minDispenseVolumeML = volumeBounds.effectiveMinimum;
      maxDispenseVolumeML = volumeBounds.effectiveMaximum;
    }
    if (!action.available) continue;
    if (!availableActionIds.includes(action.actionId)) {
      availableActionIds.push(action.actionId);
    }
    if (!availableControlGroups.includes(controlGroup)) {
      availableControlGroups.push(controlGroup);
    }
  }

  return Object.freeze({
    mode: "setup_driven_v2" as const,
    workflowId: projection.workflowId,
    workflowHash: projection.workflowHash,
    equipmentInstanceIds: Object.freeze(
      projection.equipment.map(({ instanceId }) => instanceId)
    ),
    equipmentPoses: Object.freeze(equipmentPoses),
    selectableEquipmentIds: Object.freeze(selectableEquipmentIds),
    availableActionIds: Object.freeze(availableActionIds),
    availableControlGroups: Object.freeze(availableControlGroups),
    minDispenseVolumeML,
    maxDispenseVolumeML,
    equipmentFillFractions: Object.freeze(equipmentFillFractions),
    equipmentLiquidColors: Object.freeze(equipmentLiquidColors),
    projectedState: Object.freeze({
      burette: buretteState,
      flask: flaskState,
      beaker: beakerState,
      balance: balanceState,
      weighingBoat: weighingBoatInstanceId
        ? Object.freeze({
            solidFraction: solidFractionAt(projection, weighingBoatInstanceId)
          })
        : null,
      reagentBottleContents: reagentBottlePhase(projection)
    })
  });
}

export function visibleControlGroupsForConfiguration(
  configuration: Readonly<LabSceneConfiguration>,
  focused: EquipmentId | null
): readonly ControlGroupId[] {
  const focusedGroups = getVisibleControlGroups(focused);
  return focusedGroups.filter((group) =>
    configuration.availableControlGroups.includes(group)
  );
}

/**
 * Native-lab actions whose source or target equipment maps to the focused
 * visual selection. Empty focus returns every currently projected action.
 */
/**
 * Instance ids the given focus selects, shared by action filtering and the
 * contents readout below.
 */
function instanceIdsForFocus(
  projection: Readonly<SetupDrivenLabProjection>,
  focused: EquipmentId
): ReadonlySet<string> {
  const instanceIds = new Set<string>();
  const hasBuretteAdapter = projection.equipment.some(
    ({ visualAdapterDefinitionId }) =>
      visualAdapterDefinitionId === "visual-adapter.burette.v1"
  );
  for (const equipment of projection.equipment) {
    const adapter = LAB_VISUAL_ADAPTERS[equipment.visualAdapterDefinitionId];
    if (!adapter) continue;
    if (
      selectableEquipmentIdsForAdapter(adapter, hasBuretteAdapter).includes(
        focused
      )
    ) {
      instanceIds.add(equipment.instanceId);
    }
  }
  return instanceIds;
}

/**
 * Vessels the procedure delivers into — the reaction mixture.
 *
 * Anything a permitted action targets is where the chemistry happens, which is
 * derived from the workflow itself rather than from instance naming.
 */
function reactionVesselIds(
  projection: Readonly<SetupDrivenLabProjection>
): ReadonlySet<string> {
  const targets = new Set<string>();
  for (const action of projection.actions) {
    for (const instanceId of action.targetEquipmentInstanceIds) {
      targets.add(instanceId);
    }
  }
  return targets;
}

/**
 * Display name without a leading concentration.
 *
 * Registered names embed the standard's strength ("0.100 M hydrochloric
 * acid"), which is exactly the quantity a titration asks the student to
 * determine.
 */
function nameWithoutConcentration(displayName: string): string {
  const stripped = displayName.replace(/^\s*[\d.]+\s*M\s+/i, "").trim();
  if (!stripped) return displayName;
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

/**
 * What the focused apparatus is holding, as engine-owned text.
 *
 * Students asked the coach questions like "what is the molarity of the
 * titrant?" and could not be answered, because the coach is deliberately never
 * given the numbers. The number belongs to the engine, so the bench shows it —
 * reading it here is projection, not a second source of truth.
 *
 * But a reaction vessel must not give the experiment away. In a titration the
 * analyte's concentration is the unknown the student is there to determine, so
 * anything sitting in a vessel the procedure delivers into reports volume
 * only, with the strength stripped from its name. Source containers — the
 * burette, the stock bottle — still report concentration, because a standard
 * the student is told to use is not a spoiler.
 */
export function equipmentContentsForFocus(
  projection: Readonly<SetupDrivenLabProjection>,
  focused: EquipmentId | null
): readonly string[] {
  if (!focused) return [];
  const instanceIds = instanceIdsForFocus(projection, focused);
  if (instanceIds.size === 0) return [];

  const vessels = reactionVesselIds(projection);
  const isReactionVessel = [...instanceIds].some((id) => vessels.has(id));

  const lines: string[] = [];
  for (const material of projection.materials) {
    const amount = material.locations
      .filter(({ equipmentInstanceId }) => instanceIds.has(equipmentInstanceId))
      .reduce((total, location) => total + location.amount, 0);
    if (amount <= 0) continue;

    const entry = reagentRegistry.has(material.materialProfileId)
      ? reagentRegistry.get(material.materialProfileId)
      : null;
    const solidPhase = entry?.phase === "solid";
    const quantity = solidPhase
      ? `${amount.toFixed(2)} g`
      : `${amount.toFixed(2)} mL`;
    const rawName = entry?.displayName ?? material.materialProfileId;

    if (isReactionVessel) {
      lines.push(`${nameWithoutConcentration(rawName)} — ${quantity}`);
      continue;
    }

    /*
     * Registered names usually already carry the strength, so appending it
     * again produced "0.100 M hydrochloric acid — 0.100 M · 25.00 mL".
     */
    const concentration =
      typeof entry?.concentrationM === "number" &&
      !/^\s*[\d.]+\s*M\s+/i.test(rawName)
        ? `${entry.concentrationM.toFixed(3)} M`
        : null;
    lines.push(
      concentration
        ? `${rawName} — ${concentration} · ${quantity}`
        : `${rawName} — ${quantity}`
    );
  }
  return Object.freeze(lines.sort());
}

export function projectionActionsForEquipmentFocus(
  projection: Readonly<SetupDrivenLabProjection>,
  focused: EquipmentId | null
): SetupDrivenLabProjection["actions"] {
  if (!focused) return projection.actions;
  const instanceIds = new Set<string>();
  const hasBuretteAdapter = projection.equipment.some(
    ({ visualAdapterDefinitionId }) =>
      visualAdapterDefinitionId === "visual-adapter.burette.v1"
  );
  for (const equipment of projection.equipment) {
    const adapter = LAB_VISUAL_ADAPTERS[equipment.visualAdapterDefinitionId];
    if (!adapter) continue;
    if (
      selectableEquipmentIdsForAdapter(adapter, hasBuretteAdapter).includes(
        focused
      )
    ) {
      instanceIds.add(equipment.instanceId);
    }
  }
  if (instanceIds.size === 0) return [];
  return projection.actions.filter((action) => {
    if (
      action.sourceEquipmentInstanceId &&
      instanceIds.has(action.sourceEquipmentInstanceId)
    ) {
      return true;
    }
    return action.targetEquipmentInstanceIds.some((id) => instanceIds.has(id));
  });
}
