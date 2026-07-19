import type { SetupDrivenLabProjection } from "../../../stores/setupDrivenLabSession";
import {
  resolveEquipmentPose,
  type ResolvedEquipmentPose
} from "../../../lab-workflows/registries/scene-placements";
import {
  EQUIPMENT_IDS,
  getVisibleControlGroups,
  type ControlGroupId,
  type EquipmentId
} from "./equipment";

export type TitrationVisualAdapterKind =
  | "burette"
  | "flask"
  | "indicator_shelf"
  | "wash_station";

export interface TitrationVisualAdapterRegistration {
  readonly visualAdapterDefinitionId: string;
  readonly kind: TitrationVisualAdapterKind;
  readonly selectableEquipmentIds: readonly EquipmentId[];
}

export const TITRATION_VISUAL_ADAPTERS: Readonly<
  Record<string, TitrationVisualAdapterRegistration>
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
    kind: "wash_station",
    selectableEquipmentIds: Object.freeze(["washStation"] as const)
  })
});

const ACTION_CONTROL_GROUP: Readonly<Record<string, ControlGroupId>> =
  Object.freeze({
    "action.rinse.v1": "prepare",
    "action.fill.v1": "prepare",
    "action.select_indicator.v1": "indicator",
    "action.add_indicator.v1": "indicator",
    "action.dispense.v1": "deliver",
    "action.read_volume.v1": "reading"
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
  readonly projectedState: {
    readonly burette: {
      readonly availableML: number;
      readonly capacityML: number;
      readonly deliveredML: number;
      readonly meniscusReadingML: number;
    };
    readonly flask: {
      readonly observableColor: string;
      readonly indicatorAdded: boolean;
    };
  } | null;
}

const LEGACY_SCENE_CONFIGURATION: TitrationSceneConfiguration = Object.freeze({
  mode: "legacy",
  workflowId: null,
  workflowHash: null,
  equipmentInstanceIds: Object.freeze([]),
  equipmentPoses: Object.freeze([]),
  selectableEquipmentIds: EQUIPMENT_IDS,
  availableActionIds: Object.freeze(Object.keys(ACTION_CONTROL_GROUP)),
  availableControlGroups: Object.freeze([
    "prepare",
    "indicator",
    "deliver",
    "reading"
  ] as const),
  minDispenseVolumeML: null,
  maxDispenseVolumeML: null,
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

export function resolveTitrationSceneConfiguration(
  projection: Readonly<SetupDrivenLabProjection> | null
): Readonly<TitrationSceneConfiguration> {
  if (!projection) return LEGACY_SCENE_CONFIGURATION;

  const selectableEquipmentIds: EquipmentId[] = [];
  const equipmentPoses: ResolvedEquipmentPose[] = [];
  let buretteState:
    | NonNullable<TitrationSceneConfiguration["projectedState"]>["burette"]
    | null = null;
  let flaskState:
    | NonNullable<TitrationSceneConfiguration["projectedState"]>["flask"]
    | null = null;
  const equipmentIds = new Set(
    projection.equipment.map(({ instanceId }) => instanceId)
  );
  for (const equipment of projection.equipment) {
    const adapter =
      TITRATION_VISUAL_ADAPTERS[equipment.visualAdapterDefinitionId];
    if (!adapter) {
      throw new SetupDrivenSceneError(
        SETUP_DRIVEN_SCENE_ERROR_CODES.visualAdapterUnknown,
        equipment.visualAdapterDefinitionId,
        `No exact titration visual adapter is registered for ${equipment.visualAdapterDefinitionId}.`
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
    for (const equipmentId of adapter.selectableEquipmentIds) {
      if (!selectableEquipmentIds.includes(equipmentId)) {
        selectableEquipmentIds.push(equipmentId);
      }
    }
    if (adapter.kind === "burette") {
      buretteState = Object.freeze({
        availableML: numberField(equipment, "availableML"),
        capacityML: numberField(equipment, "capacityML"),
        deliveredML: numberField(equipment, "deliveredML"),
        meniscusReadingML: numberField(equipment, "meniscusReadingML")
      });
    }
    if (adapter.kind === "flask") {
      flaskState = Object.freeze({
        observableColor: stringField(equipment, "observableColor"),
        indicatorAdded: booleanField(equipment, "indicatorAdded")
      });
    }
  }
  if (!buretteState || !flaskState) {
    throw new SetupDrivenSceneError(
      SETUP_DRIVEN_SCENE_ERROR_CODES.equipmentStateInvalid,
      projection.workflowId,
      "The titration scene requires exact burette and flask projections."
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
        `No exact titration control adapter is registered for ${action.actionId}.`
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
