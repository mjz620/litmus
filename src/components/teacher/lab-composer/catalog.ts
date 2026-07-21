import { materialSupportsContainerCapabilities } from "../../../lab-workflows/registries/reagents";
import { actionRegistry } from "../../../lab-workflows/registries/actions";
import { componentRegistry } from "../../../lab-workflows/registries/components";
import { configurationRegistry } from "../../../lab-workflows/registries/configurations";
import { materialRegistry } from "../../../lab-workflows/registries/reagents";
import { skillRegistry } from "../../../lab-workflows/registries/skills";
import { BLANK_LAB_V2_DRAFT } from "../../../lab-workflows/definitions/blank-lab";
import {
  CALORIMETRY_V2_DRAFT,
  DISSOLUTION_CALORIMETRY_V2_DRAFT
} from "../../../lab-workflows/definitions/calorimetry";
import {
  SOLUTION_PREPARATION_QUARTER_V2_DRAFT,
  SOLUTION_PREPARATION_STOCK_1M_V2_DRAFT,
  SOLUTION_PREPARATION_V2_DRAFT
} from "../../../lab-workflows/definitions/solution-preparation";
import { NATIVE_TITRATION_V2_DRAFT } from "../../../lab-workflows/definitions/titration/native-endpoint-control";
import { WEAK_ACID_TITRATION_V1_DRAFT } from "../../../lab-workflows/definitions/titration/weak-acid-titration";
import type { LabWorkflowDraftV2 } from "../../../lab-workflows/schema/v2";

export type ComposerLabTemplateId =
  | "blank"
  | "solution_preparation"
  | "solution_preparation_stock_1m"
  | "solution_preparation_quarter"
  | "calorimetry"
  | "dissolution_calorimetry"
  | "weak_acid_titration"
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
      id: "weak_acid_titration" as const,
      title: "Acetic acid titration",
      description:
        "Titrate a weak acid with sodium hydroxide and use the phenolphthalein endpoint.",
      draft: WEAK_ACID_TITRATION_V1_DRAFT
    }),
    Object.freeze({
      id: "solution_preparation" as const,
      title: "Dilute 0.5000 M NaCl → 0.0500 M",
      description:
        "Measure a 10.00 mL aliquot, dilute to 100.00 mL, and mix a verified 0.0500 mol/L solution.",
      draft: SOLUTION_PREPARATION_V2_DRAFT
    }),
    Object.freeze({
      id: "solution_preparation_stock_1m" as const,
      title: "Dilute 1.000 M NaCl → 0.1000 M",
      description:
        "Practice a tenfold dilution from a 1.000 M stock into a 100.00 mL volumetric flask.",
      draft: SOLUTION_PREPARATION_STOCK_1M_V2_DRAFT
    }),
    Object.freeze({
      id: "solution_preparation_quarter" as const,
      title: "Dilute 0.2500 M NaCl → 0.0250 M",
      description:
        "Prepare a more dilute product from a teacher-authored 0.2500 mol/L stock.",
      draft: SOLUTION_PREPARATION_QUARTER_V2_DRAFT
    }),
    Object.freeze({
      id: "calorimetry" as const,
      title: "Hot/cold water calorimetry",
      description:
        "Pour equal registered hot and cold volumes, mix, and read the equilibrium temperature.",
      draft: CALORIMETRY_V2_DRAFT
    }),
    Object.freeze({
      id: "dissolution_calorimetry" as const,
      title: "Ammonium nitrate dissolution calorimetry",
      description:
        "Tare a balance, weigh a solid sample, observe cooling, and measure molar enthalpy.",
      draft: DISSOLUTION_CALORIMETRY_V2_DRAFT
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
      entry.category === "observable" && entry.availability === "verified"
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
