import type { ComponentRegistryId } from "../components";

export type ActionRegistryId =
  | "action.add_indicator.v1"
  | "action.dispense.v1"
  | "action.fill.v1"
  | "action.read_volume.v1"
  | "action.rinse.v1"
  | "action.select_indicator.v1";

export interface ActionParameterDefinition {
  readonly key: string;
  readonly valueType: "enum" | "number" | "string";
  readonly required: boolean;
  readonly unitId?: "unit.ml.v1";
  readonly minimum?: number;
  readonly maximum?: number;
  readonly allowedValues?: readonly string[];
  /** Exact workflow key allowed to narrow this registered lower bound. */
  readonly authoredMinimumKey?: string;
  /** Exact workflow key allowed to narrow this registered upper bound. */
  readonly authoredMaximumKey?: string;
}

export interface ActionRegistryEntry {
  readonly id: ActionRegistryId;
  readonly version: "1.0.0";
  readonly purpose: string;
  readonly engineActionType:
    | "add_titrant"
    | "fill_burette"
    | "read_meniscus"
    | "rinse_burette"
    | "select_indicator";
  readonly actorComponentIds: readonly ComponentRegistryId[];
  readonly targetComponentIds: readonly ComponentRegistryId[];
  readonly requiredReagentRoleIds: readonly string[];
  readonly parameters: readonly ActionParameterDefinition[];
  readonly emittedSemanticEventTypes: readonly string[];
  readonly compatibleEngineIds: readonly ["engine.titration.v1"];
  readonly compatibleFamilyIds: readonly ["family.acid_base_titration.v1"];
}
