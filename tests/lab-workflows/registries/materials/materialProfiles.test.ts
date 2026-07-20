import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { capabilityRegistry } from "../../../../src/lab-workflows/capabilities";
import {
  EXAMPLE_STRONG,
  INDICATOR_SPECIFICATIONS,
  titration,
  type IndicatorId
} from "../../../../src/experiments/titration/titration";
import { hashLabWorkflowSpec } from "../../../../src/lab-workflows/hash";
import {
  SupportingRegistryError,
  actionParameterSchemaRegistry,
  createSupportingRegistry
} from "../../../../src/lab-workflows/registries/actions";
import { componentRegistry } from "../../../../src/lab-workflows/registries/components";
import {
  configurationRegistry,
  getConfigurationSchema,
  getQuantityPreset
} from "../../../../src/lab-workflows/registries/configurations";
import { engineRegistry } from "../../../../src/lab-workflows/registries/engines";
import {
  LEGACY_REAGENT_REGISTRY_SNAPSHOT_IDS,
  REAGENT_REGISTRY_ENTRIES,
  materialIsVerified,
  materialRegistry,
  materialSupportsContainerCapabilities,
  reagentRegistry
} from "../../../../src/lab-workflows/registries/reagents";
import { safetyRegistry } from "../../../../src/lab-workflows/registries/safety";
import {
  ENDPOINT_CONTROL_PRELAB_DRAFT,
  ENDPOINT_CONTROL_PRELAB_EXPECTED_HASH,
  ENDPOINT_CONTROL_PRELAB_VALIDATION_TIME
} from "../../../../src/lab-workflows/seeds";
import { validateLabWorkflowSpec } from "../../../../src/lab-workflows/validation";
import { createSchemaValidWorkflowDraft } from "../../schema/fixtures";

describe("LC2-102 material profiles", () => {
  it("evolves the exact reagent entries through one material facade", () => {
    expect(materialRegistry).toBe(reagentRegistry);
    expect(reagentRegistry.snapshotId).toBe("reagents.5.2.0");
    expect(LEGACY_REAGENT_REGISTRY_SNAPSHOT_IDS).toEqual([
      "reagents.1.0.0",
      "reagents.2.0.0",
      "reagents.2.1.0",
      "reagents.2.2.0",
      "reagents.3.0.0",
      "reagents.3.1.0",
      "reagents.4.0.0",
      "reagents.5.0.0",
      "reagents.5.1.0"
    ]);
    expect(materialRegistry.list().map(({ id }) => id)).toEqual([
      "reagent.hydrochloric_acid_0_100m.v1",
      "reagent.sodium_hydroxide_0_100m.v1",
      "reagent.hydrochloric_acid_aqueous.v1",
      "reagent.sodium_hydroxide_aqueous.v1",
      "reagent.phenolphthalein.v1",
      "reagent.bromothymol_blue.v1",
      "reagent.methyl_orange.v1",
      "reagent.distilled_water.v1",
      "reagent.distilled_water_cold_20c.v1",
      "reagent.distilled_water_hot_60c.v1",
      "reagent.sodium_chloride_aqueous.v1",
      "reagent.silver_nitrate_0_100m.v1",
      "reagent.sodium_chloride_0_100m.v1",
      "reagent.sodium_chloride_1_000m.v1"
    ]);
    expect(materialRegistry.has("reagent.stock_solution.v1")).toBe(false);
  });

  it("separates authorable aqueous acid/base identity from fixed 0.100 M profiles", () => {
    expect(
      materialRegistry.get("reagent.hydrochloric_acid_aqueous.v1")
    ).toMatchObject({
      displayName: "Hydrochloric acid solution",
      phase: "aqueous_solution",
      concentrationM: null,
      availability: "verified",
      concentrationAuthoring: {
        configurationSchemaId:
          "schema.material_initialization.bounded_concentration.v1",
        unitId: "unit.mol_per_l.v1",
        minimumDecimalValue: "0.05",
        maximumDecimalValue: "0.25",
        maximumDecimalPlaces: 4,
        requiredChemistryCapabilityId: "chemistry.acid_base_equilibrium.v1",
        safetyPolicyIds: ["safety.virtual_titration_ppe_notice.v1"]
      }
    });
    expect(
      materialRegistry.get("reagent.sodium_hydroxide_aqueous.v1")
    ).toMatchObject({
      concentrationM: null,
      concentrationAuthoring: {
        minimumDecimalValue: "0.05",
        maximumDecimalValue: "0.25",
        requiredChemistryCapabilityId: "chemistry.acid_base_equilibrium.v1"
      }
    });
    expect(
      materialRegistry.get("reagent.hydrochloric_acid_0_100m.v1")
    ).not.toHaveProperty("concentrationAuthoring");
  });

  it("separates authorable sodium chloride identity from its bounded initialization", () => {
    expect(
      materialRegistry.get("reagent.sodium_chloride_aqueous.v1")
    ).toMatchObject({
      displayName: "Sodium chloride solution",
      phase: "aqueous_solution",
      concentrationM: null,
      availability: "verified",
      concentrationAuthoring: {
        configurationSchemaId:
          "schema.material_initialization.bounded_concentration.v1",
        unitId: "unit.mol_per_l.v1",
        minimumDecimalValue: "0.1",
        maximumDecimalValue: "1",
        maximumDecimalPlaces: 4,
        requiredChemistryCapabilityId: "chemistry.concentration_dilution.v1",
        safetyPolicyIds: ["safety.virtual_solution_preparation_ppe_notice.v1"]
      }
    });
    expect(
      materialRegistry.get("reagent.sodium_chloride_1_000m.v1")
    ).not.toHaveProperty("concentrationAuthoring");
  });

  it("fails exact unknown and duplicate material lookup closed", () => {
    expect(() => materialRegistry.get("reagent.water.v1")).toThrowError(
      expect.objectContaining({
        code: "registry.unknown_id",
        registryKind: "reagent",
        registryId: "reagent.water.v1"
      })
    );

    const duplicate = REAGENT_REGISTRY_ENTRIES[0];
    expect(() =>
      createSupportingRegistry("material", "materials.test", [
        duplicate,
        { ...duplicate }
      ])
    ).toThrowError(
      new SupportingRegistryError(
        "registry.duplicate_id",
        "material",
        duplicate.id
      )
    );
  });

  it("preserves every v1 scientific, amount, role, container, and safety value", () => {
    const legacyIds = [
      "reagent.hydrochloric_acid_0_100m.v1",
      "reagent.sodium_hydroxide_0_100m.v1",
      "reagent.phenolphthalein.v1"
    ] as const;
    const legacyProjection = legacyIds.map((id) => {
      const entry = materialRegistry.get(id);
      return {
        id: entry.id,
        version: entry.version,
        displayName: entry.displayName,
        profileKind: entry.profileKind,
        concentrationM: entry.concentrationM,
        compatibleContainerComponentIds: entry.compatibleContainerComponentIds,
        compatibleEngineIds: entry.compatibleEngineIds,
        compatibleFamilyIds: entry.compatibleFamilyIds,
        allowedRoleIds: entry.allowedRoleIds,
        requestedAmountLimits: entry.requestedAmountLimits,
        safetyConstraintIds: entry.safetyConstraintIds,
        availability: entry.availability
      };
    });

    expect(legacyProjection).toEqual([
      {
        id: "reagent.hydrochloric_acid_0_100m.v1",
        version: "1.0.0",
        displayName: "0.100 M hydrochloric acid",
        profileKind: "aqueous_solution",
        concentrationM: 0.1,
        compatibleContainerComponentIds: ["component.erlenmeyer_flask.v1"],
        compatibleEngineIds: ["engine.titration.v1"],
        compatibleFamilyIds: ["family.acid_base_titration.v1"],
        allowedRoleIds: ["analyte"],
        requestedAmountLimits: [
          { unitId: "unit.ml.v1", minimum: 0.01, maximum: 125 }
        ],
        safetyConstraintIds: ["safety.virtual_titration_ppe_notice.v1"],
        availability: "verified"
      },
      {
        id: "reagent.sodium_hydroxide_0_100m.v1",
        version: "1.0.0",
        displayName: "0.100 M sodium hydroxide",
        profileKind: "aqueous_solution",
        concentrationM: 0.1,
        compatibleContainerComponentIds: [
          "component.reagent_bottle.v1",
          "component.burette.v1"
        ],
        compatibleEngineIds: ["engine.titration.v1"],
        compatibleFamilyIds: ["family.acid_base_titration.v1"],
        allowedRoleIds: ["titrant"],
        requestedAmountLimits: [
          { unitId: "unit.ml.v1", minimum: 0.01, maximum: 50 }
        ],
        safetyConstraintIds: ["safety.virtual_titration_ppe_notice.v1"],
        availability: "verified"
      },
      {
        id: "reagent.phenolphthalein.v1",
        version: "1.0.0",
        displayName: "Phenolphthalein indicator",
        profileKind: "indicator",
        concentrationM: null,
        compatibleContainerComponentIds: ["component.indicator_bottle.v1"],
        compatibleEngineIds: ["engine.titration.v1"],
        compatibleFamilyIds: ["family.acid_base_titration.v1"],
        allowedRoleIds: ["indicator"],
        requestedAmountLimits: [
          { unitId: "unit.drop.v1", minimum: 1, maximum: 2 }
        ],
        safetyConstraintIds: ["safety.virtual_titration_ppe_notice.v1"],
        availability: "verified"
      }
    ]);
  });

  it("registers every deterministic indicator exposed by the engine and UI contract", () => {
    const indicatorMaterialIds: Readonly<Record<IndicatorId, string>> = {
      phenolphthalein: "reagent.phenolphthalein.v1",
      bromothymol_blue: "reagent.bromothymol_blue.v1",
      methyl_orange: "reagent.methyl_orange.v1"
    };

    expect(Object.keys(indicatorMaterialIds).sort()).toEqual(
      Object.keys(INDICATOR_SPECIFICATIONS).sort()
    );
    const indicatorParameter = actionParameterSchemaRegistry
      .get("schema.action_parameters.select_indicator.v1")
      .parameters.find(({ key }) => key === "indicator");
    if (!indicatorParameter || !("allowedValues" in indicatorParameter)) {
      throw new Error("Indicator parameter enum is not registered");
    }
    expect(indicatorParameter.allowedValues).toEqual(
      Object.keys(indicatorMaterialIds)
    );
    for (const [indicatorId, materialId] of Object.entries(
      indicatorMaterialIds
    ) as [IndicatorId, string][]) {
      const material = materialRegistry.get(materialId);
      expect(material).toMatchObject({
        phase: "indicator",
        usageModes: ["material_binding", "legacy_action_parameter"],
        availability: "verified",
        allowedRoleIds: ["indicator"],
        compatibleContainerComponentIds: ["component.indicator_bottle.v1"],
        providedChemistryCapabilityIds: ["chemistry.indicator_response.v1"]
      });
      expect(material.quantityPresetIds).toHaveLength(2);
      expect(engineRegistry.get("engine.titration.v1").reagentIds).toContain(
        material.id
      );
      expect(INDICATOR_SPECIFICATIONS[indicatorId]).toBeDefined();
    }
  });

  it.each([
    ["reagent.bromothymol_blue.v1", "Bromothymol blue indicator"],
    ["reagent.methyl_orange.v1", "Methyl orange indicator"]
  ] as const)(
    "keeps a v1 workflow using %s deterministically runnable",
    (reagentId, displayLabel) => {
      const draft = {
        ...ENDPOINT_CONTROL_PRELAB_DRAFT,
        reagents: ENDPOINT_CONTROL_PRELAB_DRAFT.reagents.map((reagent) =>
          reagent.role === "indicator"
            ? { ...reagent, reagentId, displayLabel }
            : reagent
        )
      };
      const outcome = validateLabWorkflowSpec(draft, {
        checkedAt: ENDPOINT_CONTROL_PRELAB_VALIDATION_TIME
      });
      expect(outcome.schemaValid).toBe(true);
      if (!outcome.schemaValid)
        throw new Error("Expected schema-valid workflow");
      expect(outcome.validation).toMatchObject({
        status: "runnable",
        runnable: true,
        issues: []
      });
    }
  );

  it("registers exact consumable water without inventing a rinse volume", () => {
    const water = materialRegistry.get("reagent.distilled_water.v1");
    expect(water).toMatchObject({
      displayName: "Distilled water",
      phase: "pure_liquid",
      usageModes: ["material_binding", "legacy_action_parameter"],
      initializationPresetSchemaId:
        "schema.material_initialization.pure_liquid.v1",
      compatibleContainerComponentIds: [
        "component.reagent_bottle.v1",
        "component.wash_bottle.v1"
      ],
      compatibleContainerCapabilityIds: [
        "capability.contain_liquid.v1",
        "capability.dispense_liquid.v1"
      ],
      compatibleEngineIds: ["engine.titration.v1"],
      allowedRoleIds: ["rinse_solvent", "diluent"],
      availability: "verified"
    });
    expect(water.quantityPresetIds).toEqual([
      "quantity-preset.distilled_water_250ml.v1",
      "quantity-preset.distilled_water_50ml.v1"
    ]);
    expect(water.requestedAmountLimits).toEqual([
      { unitId: "unit.ml.v1", minimum: 0.01, maximum: 250 }
    ]);
    expect(getQuantityPreset(water.quantityPresetIds[0]!)).toMatchObject({
      amount: 250,
      unitId: "unit.ml.v1",
      compatibleMaterialProfileIds: [water.id]
    });
    expect(water.safetyPolicyIds).toEqual([]);
    expect(engineRegistry.get("engine.titration.v1").reagentIds).toContain(
      water.id
    );
    const rinseSolventParameter = actionParameterSchemaRegistry
      .get("schema.action_parameters.rinse.v1")
      .parameters.find(({ key }) => key === "solvent");
    if (!rinseSolventParameter || !("allowedValues" in rinseSolventParameter)) {
      throw new Error("Rinse solvent parameter enum is not registered");
    }
    expect(rinseSolventParameter.allowedValues).toContain("water");

    const transition = titration.step(
      titration.createInitialState(EXAMPLE_STRONG),
      {
        type: "rinse_burette",
        solvent: "water"
      }
    );
    expect(transition.state.titrantDilutionFactor).toBeLessThan(1);
    expect(transition.events[0]?.observation).toMatchObject({
      solvent: "water"
    });
  });

  it("resolves bounded capabilities, schemas, quantities, and safety exactly", () => {
    for (const material of materialRegistry.list()) {
      expect(material.phase).toBe(material.profileKind);
      expect(material.safetyPolicyIds).toEqual(material.safetyConstraintIds);
      for (const capabilityId of material.providedChemistryCapabilityIds) {
        expect(capabilityRegistry.getChemistry(capabilityId).availability).toBe(
          "verified"
        );
      }
      for (const capabilityId of material.compatibleContainerCapabilityIds) {
        expect(capabilityRegistry.getEquipment(capabilityId).id).toBe(
          capabilityId
        );
      }
      expect(
        getConfigurationSchema(material.initializationPresetSchemaId).scope
      ).toBe("material_initialization");
      for (const quantityPresetId of material.quantityPresetIds) {
        const quantity = getQuantityPreset(quantityPresetId);
        expect(quantity.compatibleMaterialProfileIds).toContain(material.id);
        expect(configurationRegistry.get(quantity.unitId).category).toBe(
          "unit"
        );
      }
      for (const safetyPolicyId of material.safetyPolicyIds) {
        expect(safetyRegistry.get(safetyPolicyId).id).toBe(safetyPolicyId);
      }
    }
  });

  it("requires every declared container capability without changing v1 component compatibility", () => {
    const acid = materialRegistry.get("reagent.hydrochloric_acid_0_100m.v1");
    const flask = componentRegistry.get("component.erlenmeyer_flask.v1");
    const indicatorBottle = componentRegistry.get(
      "component.indicator_bottle.v1"
    );

    expect(
      materialSupportsContainerCapabilities(acid, flask.capabilityIds)
    ).toBe(true);
    expect(
      materialSupportsContainerCapabilities(acid, indicatorBottle.capabilityIds)
    ).toBe(false);
    expect(acid.compatibleContainerComponentIds).toEqual([
      "component.erlenmeyer_flask.v1"
    ]);
  });

  it("distinguishes verified profiles from declared metadata", () => {
    expect(
      materialIsVerified(
        materialRegistry.get("reagent.sodium_hydroxide_0_100m.v1")
      )
    ).toBe(true);
    expect(materialIsVerified({ availability: "declared" })).toBe(false);
    expect(materialIsVerified({ availability: "restricted" })).toBe(false);
  });

  it("returns deeply immutable profile metadata", () => {
    const acid = materialRegistry.get("reagent.hydrochloric_acid_0_100m.v1");
    expect(Object.isFrozen(materialRegistry.list())).toBe(true);
    expect(Object.isFrozen(acid)).toBe(true);
    expect(Object.isFrozen(acid.usageModes)).toBe(true);
    expect(Object.isFrozen(acid.providedChemistryCapabilityIds)).toBe(true);
    expect(Object.isFrozen(acid.compatibleContainerCapabilityIds)).toBe(true);
    expect(Object.isFrozen(acid.quantityPresetIds)).toBe(true);
    expect(Object.isFrozen(acid.requestedAmountLimits)).toBe(true);
  });

  it("keeps v1 hashes and deterministic validation behavior unchanged", () => {
    expect(hashLabWorkflowSpec(createSchemaValidWorkflowDraft())).toBe(
      "sha256:adc83cc11fc51b63b8481716c605dfbf9859adb31e7c0f0e8b943031457ab1ff"
    );
    const outcome = validateLabWorkflowSpec(ENDPOINT_CONTROL_PRELAB_DRAFT, {
      checkedAt: ENDPOINT_CONTROL_PRELAB_VALIDATION_TIME
    });
    expect(outcome.schemaValid).toBe(true);
    if (!outcome.schemaValid) throw new Error("Expected schema-valid workflow");
    expect(outcome.validation).toMatchObject({
      status: "runnable",
      runnable: true,
      issues: []
    });
    expect(outcome.validation.canonicalSpecHash).toBe(
      ENDPOINT_CONTROL_PRELAB_EXPECTED_HASH
    );
    expect(outcome.validation.registrySnapshotIds.reagents).toBe(
      "reagents.5.2.0"
    );
  });

  it("keeps deterministic material contracts free of forbidden imports", () => {
    for (const file of ["types.ts", "entries.ts", "index.ts"]) {
      const source = readFileSync(
        new URL(
          `../../../../src/lab-workflows/registries/reagents/${file}`,
          import.meta.url
        ),
        "utf8"
      );
      expect(source).not.toMatch(
        /(?:from|import\()\s*["'][^"']*(?:react|three|zustand|supabase|openai|next\/|node:fs|window|document)/
      );
    }
  });
});
