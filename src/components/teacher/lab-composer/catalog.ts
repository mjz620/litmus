import { materialSupportsContainerCapabilities } from "../../../lab-workflows/registries/reagents";
import { actionRegistry } from "../../../lab-workflows/registries/actions";
import { componentRegistry } from "../../../lab-workflows/registries/components";
import { configurationRegistry } from "../../../lab-workflows/registries/configurations";
import { materialRegistry } from "../../../lab-workflows/registries/reagents";
import { skillRegistry } from "../../../lab-workflows/registries/skills";
import { BLANK_LAB_V2_DRAFT } from "../../../lab-workflows/definitions/blank-lab";
import { SOLUTION_PREPARATION_V2_DRAFT } from "../../../lab-workflows/definitions/solution-preparation";
import { NATIVE_TITRATION_V2_DRAFT } from "../../../lab-workflows/definitions/titration/native-endpoint-control";
import type { LabWorkflowDraftV2 } from "../../../lab-workflows/schema/v2";

export type ComposerLabTemplateId =
  | "blank"
  | "solution_preparation"
  | "titration";

export interface ComposerLabTemplate {
  readonly id: ComposerLabTemplateId;
  readonly title: string;
  readonly description: string;
  readonly draft: Readonly<LabWorkflowDraftV2>;
}

export const composerLabTemplateCatalog: readonly ComposerLabTemplate[] =
  Object.freeze([
    Object.freeze({
      id: "blank" as const,
      title: "Start from scratch",
      description: "Build a lab from verified equipment and actions.",
      draft: BLANK_LAB_V2_DRAFT
    }),
    Object.freeze({
      id: "titration" as const,
      title: "Acid–base titration",
      description: "Practice endpoint control and precise meniscus reading.",
      draft: NATIVE_TITRATION_V2_DRAFT
    }),
    Object.freeze({
      id: "solution_preparation" as const,
      title: "Prepare a solution",
      description:
        "Measure an aliquot, dilute to the mark, and mix a verified solution.",
      draft: SOLUTION_PREPARATION_V2_DRAFT
    })
  ]);

export const composerEquipmentCatalog = componentRegistry
  .list()
  .filter(
    (entry) =>
      entry.performanceTier !== "restricted" &&
      entry.visualAdapterDefinitionAvailability === "verified" &&
      entry.mechanicalAdapterAvailability === "verified"
  );

export const composerMaterialCatalog = materialRegistry
  .list()
  .filter(
    (entry) =>
      entry.availability === "verified" &&
      entry.usageModes.includes("material_binding")
  );

export const composerActionCatalog = actionRegistry.list();
export const composerObjectiveCatalog = skillRegistry
  .list()
  .filter((entry) => entry.availability === "verified");
export const composerPlacementCatalog = configurationRegistry
  .list()
  .filter(
    (entry) =>
      entry.category === "placement" && entry.availability === "verified"
  );
export const composerEquipmentConfigurationCatalog = configurationRegistry
  .list()
  .filter(
    (entry) =>
      entry.category === "component_configuration" &&
      entry.availability === "verified"
  );
export const composerObservableCatalog = configurationRegistry
  .list()
  .filter(
    (entry) =>
      entry.category === "observable" &&
      entry.id === "observable.burette_reading_ml.v1"
  );

export function compatibleContainers<
  Equipment extends {
    readonly instanceId: string;
    readonly equipmentDefinitionId: string;
  }
>(
  materialProfileId: string,
  equipment: readonly Equipment[]
): readonly Equipment[] {
  const material = materialRegistry.get(materialProfileId);
  return equipment.filter(({ equipmentDefinitionId }) => {
    const definition = componentRegistry.get(equipmentDefinitionId);
    return materialSupportsContainerCapabilities(
      material,
      definition.capabilityIds
    );
  });
}

export function quantityPresetsFor(materialProfileId: string) {
  const material = materialRegistry.get(materialProfileId);
  return material.quantityPresetIds.map((id) => configurationRegistry.get(id));
}

export function placementSupportsEquipment(
  placementSlotId: string,
  equipmentDefinitionId: string
): boolean {
  const placement = configurationRegistry.get(placementSlotId);
  return placement.compatibleComponentIds.includes(equipmentDefinitionId);
}
