import type {
  ComponentRegistryId,
  VisualAdapterDefinitionId
} from "../components";

export type ScenePlacementId =
  | "placement.calorimetry_balance_left.v1"
  | "placement.calorimetry_weighing_boat.v1"
  | "placement.calorimetry_solid_stock_right.v1"
  | "placement.bench_center_stand.v1"
  | "placement.bench_center_stand_reversed.v1"
  | "placement.bench_left_stand.v1"
  | "placement.bench_left_stand_reversed.v1"
  | "placement.under_burette.v1"
  | "placement.under_left_burette.v1"
  | "placement.indicator_shelf.v1"
  | "placement.indicator_shelf_right.v1"
  | "placement.reagent_station.v1"
  | "placement.reagent_station_left.v1"
  | "placement.solution_pipette_stand.v1"
  | "placement.solution_flask_center.v1"
  | "placement.solution_stock_right.v1"
  | "placement.solution_wash_left.v1"
  | "placement.calorimeter_center.v1"
  | "placement.calorimetry_thermometer.v1"
  | "placement.calorimetry_wash_left.v1"
  | "placement.calorimetry_stock_right.v1"
  | "placement.bench_vessel_center.v1"
  | "placement.precipitation_stock_left.v1"
  | "placement.precipitation_stock_right.v1"
  | "placement.precipitation_balance_left.v1"
  | "placement.precipitation_weighing_boat_right.v1";

export type SceneAssemblyId = "assembly.dispense_station.v1";
export type SceneAnchorId =
  | "anchor.calorimetry.balance.v1"
  | "anchor.calorimetry.weighing_boat.v1"
  | "anchor.calorimetry.solid_stock.v1"
  | "anchor.dispense.center.v1"
  | "anchor.dispense.left.v1"
  | "anchor.indicator.left.v1"
  | "anchor.indicator.right.v1"
  | "anchor.reagent.left.v1"
  | "anchor.reagent.right.v1"
  | "anchor.solution.pipette.v1"
  | "anchor.solution.flask.v1"
  | "anchor.solution.stock.v1"
  | "anchor.solution.wash.v1"
  | "anchor.calorimetry.center.v1"
  | "anchor.calorimetry.thermometer.v1"
  | "anchor.calorimetry.wash.v1"
  | "anchor.calorimetry.stock.v1"
  | "anchor.bench.vessel.v1"
  | "anchor.precipitation.stock_left.v1"
  | "anchor.precipitation.stock_right.v1"
  | "anchor.precipitation.balance.v1"
  | "anchor.precipitation.weighing_boat.v1";

export type SceneVector3 = readonly [number, number, number];
export type SceneVector2 = readonly [number, number];

export interface VerifiedScenePlacement {
  readonly id: ScenePlacementId;
  readonly version: "1.0.0";
  readonly displayName: string;
  readonly equipmentDefinitionId: ComponentRegistryId;
  readonly visualAdapterDefinitionId: VisualAdapterDefinitionId;
  readonly anchorId: SceneAnchorId;
  readonly assemblyId: SceneAssemblyId | null;
  /** Code-owned world-space translation from the historical visual pose. */
  readonly translation: SceneVector3;
  /** Code-owned rotation around the vertical axis. */
  readonly yawRadians: number;
  /** World-space footprint center and half extents used by hard validation. */
  readonly footprintCenterXZ: SceneVector2;
  readonly footprintHalfExtentsXZ: SceneVector2;
  readonly rotationOrder: number;
}

export interface ResolvedEquipmentPose {
  readonly equipmentInstanceId: string;
  readonly equipmentDefinitionId: ComponentRegistryId;
  readonly visualAdapterDefinitionId: VisualAdapterDefinitionId;
  readonly placementSlotId: ScenePlacementId;
  readonly anchorId: SceneAnchorId;
  readonly assemblyId: SceneAssemblyId | null;
  readonly translation: SceneVector3;
  readonly yawRadians: number;
  /** World-space footprint center used to seat local-origin native meshes. */
  readonly footprintCenterXZ: SceneVector2;
}
