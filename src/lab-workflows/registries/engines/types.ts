import type { ActionRegistryId } from "../actions";
import type { ComponentRegistryId } from "../components";
import type { ReagentRegistryId } from "../reagents";

export type EngineRegistryId = "engine.titration.v1";

export interface EngineRegistryEntry {
  readonly id: EngineRegistryId;
  readonly version: "1.0.0";
  readonly experimentDefinitionId: "acid_base_titration";
  readonly experimentDefinitionVersion: "1.0.0";
  readonly familyId: "family.acid_base_titration.v1";
  readonly availability: "verified";
  readonly deterministic: true;
  readonly supportsSeededState: true;
  readonly componentIds: readonly ComponentRegistryId[];
  readonly actionIds: readonly ActionRegistryId[];
  readonly reagentIds: readonly ReagentRegistryId[];
  readonly engineConfigIds: readonly string[];
  readonly seedTemplateIds: readonly string[];
  readonly semanticEventTypes: readonly string[];
  readonly workflowEventTypeIds: readonly string[];
  readonly semanticFlags: readonly string[];
}
