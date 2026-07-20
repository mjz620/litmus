import type { SetupDrivenLabProjection } from "../../../stores/setupDrivenLabSession";
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
  | "beaker";

export interface LabVisualAdapterRegistration {
  readonly visualAdapterDefinitionId: string;
  readonly kind: LabVisualAdapterKind;
  readonly selectableEquipmentIds: readonly EquipmentId[];
}

/** @deprecated Prefer LAB_VISUAL_ADAPTERS; kept as an alias for titration-era imports. */
export type TitrationVisualAdapterKind = LabVisualAdapterKind;
/** @deprecated Prefer LabVisualAdapterRegistration. */
export type TitrationVisualAdapterRegistration = LabVisualAdapterRegistration;

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
  })
});

/** Titration-era alias; includes dilution adapters in the shared map. */
export const TITRATION_VISUAL_ADAPTERS = LAB_VISUAL_ADAPTERS;

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
    "action.read_temperature.v1": "calorimetry"
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

export interface TitrationSceneConfiguration {
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
  } | null;
}

const LEGACY_SCENE_CONFIGURATION: TitrationSceneConfiguration = Object.freeze({
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

function fillFractionFor(
  equipment: SetupDrivenLabProjection["equipment"][number]
): number {
  const capacity = optionalNumberField(equipment, "capacityML", 0);
  const available = optionalNumberField(
    equipment,
    "availableML",
    optionalNumberField(equipment, "totalVolumeML", 0)
  );
  return capacity > 0 ? available / capacity : available > 0 ? 0.7 : 0;
}

/**
 * Resolve exact registered visual adapters and poses for the shared immersive
 * lab scene. Titration requires burette+flask when those adapters are present;
 * native solution-preparation labs may omit them.
 */
export function resolveTitrationSceneConfiguration(
  projection: Readonly<SetupDrivenLabProjection> | null
): Readonly<TitrationSceneConfiguration> {
  if (!projection) return LEGACY_SCENE_CONFIGURATION;

  const selectableEquipmentIds: EquipmentId[] = [];
  const equipmentPoses: ResolvedEquipmentPose[] = [];
  const equipmentFillFractions: Record<string, number> = {};
  let buretteState:
    | NonNullable<
        NonNullable<TitrationSceneConfiguration["projectedState"]>["burette"]
      >
    | null = null;
  let flaskState:
    | NonNullable<
        NonNullable<TitrationSceneConfiguration["projectedState"]>["flask"]
      >
    | null = null;
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
      fillFractionFor(equipment);
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
    const selectableId: EquipmentId = hasBuretteAdapter
      ? "washStation"
      : "reagentBottle";
    if (!selectableEquipmentIds.includes(selectableId)) {
      selectableEquipmentIds.push(selectableId);
    }
  }
  if (hasBuretteAdapter !== Boolean(buretteState) || hasFlaskAdapter !== Boolean(flaskState)) {
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
    projectedState: Object.freeze({
      burette: buretteState,
      flask: flaskState
    })
  });
}

export function visibleControlGroupsForConfiguration(
  configuration: Readonly<TitrationSceneConfiguration>,
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
export function projectionActionsForEquipmentFocus(
  projection: Readonly<SetupDrivenLabProjection>,
  focused: EquipmentId | null
): SetupDrivenLabProjection["actions"] {
  if (!focused) return projection.actions;
  const instanceIds = new Set<string>();
  for (const equipment of projection.equipment) {
    const adapter = LAB_VISUAL_ADAPTERS[equipment.visualAdapterDefinitionId];
    if (!adapter) continue;
    if (adapter.selectableEquipmentIds.includes(focused)) {
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
    return action.targetEquipmentInstanceIds.some((id) =>
      instanceIds.has(id)
    );
  });
}
