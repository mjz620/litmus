import { materialSupportsContainerCapabilities } from "../../../lab-workflows/registries/reagents";
import { actionRegistry } from "../../../lab-workflows/registries/actions";
import { componentRegistry } from "../../../lab-workflows/registries/components";
import {
  configurationRegistry,
  type QuantityPresetRegistryEntry
} from "../../../lab-workflows/registries/configurations";
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
      title: "Dilute 2.000 M Cu(NO₃)₂ → 0.2000 M",
      description:
        "Measure a 10.00 mL aliquot, dilute to 100.00 mL, and mix a verified 0.2000 mol/L solution.",
      draft: SOLUTION_PREPARATION_V2_DRAFT
    }),
    Object.freeze({
      id: "solution_preparation_stock_1m" as const,
      title: "Dilute 1.000 M Cu(NO₃)₂ → 0.1000 M",
      description:
        "Practice a tenfold dilution from a 1.000 M stock into a 100.00 mL volumetric flask.",
      draft: SOLUTION_PREPARATION_STOCK_1M_V2_DRAFT
    }),
    Object.freeze({
      id: "solution_preparation_quarter" as const,
      title: "Dilute 0.5000 M Cu(NO₃)₂ → 0.0500 M",
      description:
        "Prepare a more dilute product from a teacher-authored 0.5000 mol/L stock.",
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

/**
 * Registered unit for each numeric observable a tolerance range can bound.
 * Observables absent from this map are either non-numeric (booleans, colours)
 * or dimensionless ratios with no registered unit, so they cannot carry a
 * tolerance range and are kept out of the authoring picker entirely.
 */
const observableUnitIds: Readonly<Record<string, string>> = Object.freeze({
  "observable.burette_reading_ml.v1": "unit.ml.v1",
  "observable.solution_volume_ml.v1": "unit.ml.v1",
  "observable.calorimeter_volume_ml.v1": "unit.ml.v1",
  "observable.solution_ph.v1": "unit.ph.v1",
  "observable.solution_concentration_m.v1": "unit.mol_per_l.v1",
  "observable.dissolved_silver_m.v1": "unit.mol_per_l.v1",
  "observable.dissolved_chloride_m.v1": "unit.mol_per_l.v1",
  "observable.precipitate_amount_mol.v1": "unit.mol.v1",
  "observable.reacted_amount_mol.v1": "unit.mol.v1",
  "observable.precipitate_mass_g.v1": "unit.g.v1",
  "observable.balance_reading_g.v1": "unit.g.v1",
  "observable.calorimeter_temperature_c.v1": "unit.celsius.v1",
  "observable.calorimeter_heat_content_j.v1": "unit.joule.v1",
  "observable.reaction_heat_j.v1": "unit.joule.v1",
  "observable.measured_molar_enthalpy_kj_per_mol.v1": "unit.kj_per_mol.v1"
});

export function composerObservableUnitId(
  observableId: string
): string | undefined {
  return observableUnitIds[observableId];
}

/** Observables a teacher can bound with a tolerance range, with their unit. */
export const composerToleranceObservableCatalog = composerObservableCatalog
  .filter((entry) => observableUnitIds[entry.id] !== undefined)
  .map((entry) =>
    Object.freeze({ ...entry, unitId: observableUnitIds[entry.id]! })
  );

const unitSuffixes: Readonly<Record<string, string>> = Object.freeze({
  "unit.ml.v1": "mL",
  "unit.g.v1": "g",
  "unit.mol.v1": "mol",
  "unit.mol_per_l.v1": "mol/L",
  "unit.celsius.v1": "°C",
  "unit.joule.v1": "J",
  "unit.kj_per_mol.v1": "kJ/mol",
  "unit.ph.v1": "pH",
  "unit.drop.v1": "drops"
});

export function composerUnitSuffix(unitId: string): string {
  return unitSuffixes[unitId] ?? "";
}

/**
 * Human label for a permitted action. Labs routinely permit the same action on
 * different equipment (pouring from two reagent bottles), so the action purpose
 * alone cannot tell two permissions apart — the equipment has to be named.
 */
export function composerPermissionLabel(
  permission: LabWorkflowDraftV2["permittedActions"][number],
  equipment: LabWorkflowDraftV2["equipment"]
): string {
  const purpose =
    composerActionCatalog.find(({ id }) => id === permission.actionId)
      ?.purpose ?? permission.actionId;
  const labelFor = (instanceId: string) =>
    equipment.find((item) => item.instanceId === instanceId)?.label ??
    instanceId;
  const source = permission.sourceEquipmentInstanceId
    ? labelFor(permission.sourceEquipmentInstanceId)
    : null;
  const targets = permission.targetEquipmentInstanceIds.map(labelFor);
  const where = [
    source ? `from ${source}` : null,
    targets.length > 0 ? `into ${targets.join(" and ")}` : null
  ]
    .filter((part): part is string => part !== null)
    .join(" ");
  return where ? `${purpose} — ${where}` : purpose;
}

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

/**
 * The verified quantity presets a material may be bound with. Narrowed to the
 * quantity category so callers can read `amount`/`unitId` — the registry's
 * `get` returns the whole configuration union.
 */
export function quantityPresetsFor(
  materialProfileId: string
): readonly QuantityPresetRegistryEntry[] {
  const material = materialRegistry.get(materialProfileId);
  return material.quantityPresetIds.flatMap((id) => {
    const entry = configurationRegistry.get(id);
    return entry.category === "quantity_preset" ? [entry] : [];
  });
}

export function placementSupportsEquipment(
  placementSlotId: string,
  equipmentDefinitionId: string
): boolean {
  const placement = configurationRegistry.get(placementSlotId);
  return placement.compatibleComponentIds.includes(equipmentDefinitionId);
}
