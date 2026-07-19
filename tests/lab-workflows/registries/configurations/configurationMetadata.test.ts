import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  SupportingRegistryError,
  actionParameterSchemaRegistry,
  createSupportingRegistry
} from "../../../../src/lab-workflows/registries/actions";
import {
  CONFIGURATION_REGISTRY_ENTRIES,
  ConfigurationMetadataError,
  LEGACY_CONFIGURATION_REGISTRY_SNAPSHOT_IDS,
  configurationRegistry,
  getConfigurationSchema,
  getQuantityPreset,
  requireVerifiedConfigurationEntry
} from "../../../../src/lab-workflows/registries/configurations";

describe("LC2-102 configuration metadata", () => {
  it("bumps the semantic snapshot and retains its legacy provenance ID", () => {
    expect(configurationRegistry.snapshotId).toBe("configurations.5.2.0");
    expect(LEGACY_CONFIGURATION_REGISTRY_SNAPSHOT_IDS).toEqual([
      "configurations.1.0.0",
      "configurations.2.0.0",
      "configurations.2.1.0",
      "configurations.2.2.0",
      "configurations.2.3.0",
      "configurations.2.4.0",
      "configurations.3.0.0",
      "configurations.3.1.0",
      "configurations.4.0.0",
      "configurations.5.0.0",
      "configurations.5.1.0"
    ]);
  });

  it("registers exact solution observables and units with documented precision", () => {
    expect(
      configurationRegistry.get("observable.solution_concentration_m.v1")
    ).toMatchObject({
      category: "observable",
      availability: "verified",
      adapterKey: "solutionConcentrationM",
      compatibleFamilyIds: []
    });
    expect(
      configurationRegistry.get("observable.solution_volume_ml.v1")
    ).toMatchObject({
      category: "observable",
      availability: "verified",
      adapterKey: "solutionVolumeML",
      compatibleFamilyIds: []
    });
    expect(configurationRegistry.get("unit.mol_per_l.v1")).toMatchObject({
      category: "unit",
      availability: "verified",
      compatibleFamilyIds: []
    });
  });

  it("registers the strict bounded material-initialization contract", () => {
    expect(
      configurationRegistry.get(
        "schema.material_initialization.bounded_concentration.v1"
      )
    ).toMatchObject({
      category: "configuration_schema",
      scope: "material_initialization",
      strict: true,
      availability: "verified"
    });
    expect(
      configurationRegistry.get(
        "quantity-preset.sodium_chloride_solution_50ml.v1"
      )
    ).toMatchObject({
      category: "quantity_preset",
      amount: 50,
      unitId: "unit.ml.v1",
      compatibleMaterialProfileIds: ["reagent.sodium_chloride_aqueous.v1"],
      availability: "verified"
    });
  });

  it("rejects duplicate configuration metadata IDs deterministically", () => {
    const duplicate = CONFIGURATION_REGISTRY_ENTRIES.find(
      ({ category }) => category === "quantity_preset"
    )!;
    expect(() =>
      createSupportingRegistry("configuration", "configurations.test", [
        duplicate,
        { ...duplicate }
      ])
    ).toThrowError(
      new SupportingRegistryError(
        "registry.duplicate_id",
        "configuration",
        duplicate.id
      )
    );
  });

  it("registers exact schema metadata for every future preset scope", () => {
    const expected = {
      equipment: "schema.equipment_configuration.burette.v1",
      layout: "schema.layout_configuration.titration_bench.v1",
      material_initialization:
        "schema.material_initialization.aqueous_solution.v1",
      model: "schema.model_configuration.strong_acid_strong_base_25ml.v1",
      quantity: "schema.quantity.volume_ml.v1"
    } as const;

    for (const [scope, id] of Object.entries(expected)) {
      expect(getConfigurationSchema(id)).toMatchObject({
        id,
        category: "configuration_schema",
        scope,
        strict: true,
        availability: "declared"
      });
    }
  });

  it("links current equipment, action, model, and layout presets to exact schemas", () => {
    const expected = [
      [
        "component_config.burette.50ml.v1",
        "schema.equipment_configuration.burette.v1"
      ],
      [
        "component_config.erlenmeyer.125ml.v1",
        "schema.equipment_configuration.erlenmeyer_flask.v1"
      ],
      [
        "component_config.indicator_dropper.v1",
        "schema.equipment_configuration.indicator_bottle.v1"
      ],
      [
        "action_params.burette_reading.v1",
        "schema.action_parameters.read_volume.v1"
      ],
      [
        "action_params.titration_dropwise_or_slow.v1",
        "schema.action_parameters.dispense.v1"
      ],
      [
        "engine_config.titration.strong_acid_strong_base_25ml.v1",
        "schema.model_configuration.strong_acid_strong_base_25ml.v1"
      ],
      [
        "placement.under_burette.v1",
        "schema.layout_configuration.titration_bench.v1"
      ]
    ] as const;

    for (const [presetId, schemaId] of expected) {
      const preset = configurationRegistry.get(presetId);
      expect(preset.schemaId).toBe(schemaId);
      if (preset.scope === "action") {
        expect(actionParameterSchemaRegistry.get(schemaId).id).toBe(schemaId);
      } else {
        expect(getConfigurationSchema(schemaId).id).toBe(schemaId);
      }
    }
  });

  it("promotes the reagent-bottle configuration with executable liquid mechanics", () => {
    const preset = configurationRegistry.get(
      "component_config.reagent_bottle.titrant_source.v1"
    );
    expect(preset).toMatchObject({
      category: "component_configuration",
      availability: "verified",
      compatibleComponentIds: ["component.reagent_bottle.v1"],
      compatibleFamilyIds: [],
      scope: "equipment",
      schemaId: "schema.equipment_configuration.reagent_bottle.v1"
    });
    expect(requireVerifiedConfigurationEntry(preset.id)).toBe(preset);
  });

  it("resolves only exact quantity preset IDs and fixed code-owned values", () => {
    const expected = [
      [
        "quantity-preset.hydrochloric_acid_0_100m_25ml.v1",
        25,
        "unit.ml.v1",
        "reagent.hydrochloric_acid_0_100m.v1"
      ],
      [
        "quantity-preset.sodium_hydroxide_0_100m_25ml.v1",
        25,
        "unit.ml.v1",
        "reagent.sodium_hydroxide_0_100m.v1"
      ],
      [
        "quantity-preset.sodium_hydroxide_0_100m_50ml.v1",
        50,
        "unit.ml.v1",
        "reagent.sodium_hydroxide_0_100m.v1"
      ],
      [
        "quantity-preset.phenolphthalein_1_drop.v1",
        1,
        "unit.drop.v1",
        "reagent.phenolphthalein.v1"
      ],
      [
        "quantity-preset.phenolphthalein_2_drops.v1",
        2,
        "unit.drop.v1",
        "reagent.phenolphthalein.v1"
      ],
      [
        "quantity-preset.bromothymol_blue_1_drop.v1",
        1,
        "unit.drop.v1",
        "reagent.bromothymol_blue.v1"
      ],
      [
        "quantity-preset.bromothymol_blue_2_drops.v1",
        2,
        "unit.drop.v1",
        "reagent.bromothymol_blue.v1"
      ],
      [
        "quantity-preset.methyl_orange_1_drop.v1",
        1,
        "unit.drop.v1",
        "reagent.methyl_orange.v1"
      ],
      [
        "quantity-preset.methyl_orange_2_drops.v1",
        2,
        "unit.drop.v1",
        "reagent.methyl_orange.v1"
      ],
      [
        "quantity-preset.distilled_water_50ml.v1",
        50,
        "unit.ml.v1",
        "reagent.distilled_water.v1"
      ]
    ] as const;

    for (const [id, amount, unitId, materialProfileId] of expected) {
      const preset = getQuantityPreset(id);
      expect(preset).toMatchObject({
        amount,
        unitId,
        compatibleMaterialProfileIds: [materialProfileId],
        availability: "verified"
      });
      expect(preset).not.toHaveProperty("concentrationM");
      expect(preset).not.toHaveProperty("formula");
    }

    expect(() =>
      getQuantityPreset("quantity-preset.sodium_hydroxide_47ml.v1")
    ).toThrowError(
      expect.objectContaining({
        code: "registry.unknown_id",
        registryKind: "configuration"
      })
    );
  });

  it("distinguishes category mismatch from unknown and unavailable entries", () => {
    expect(() => getQuantityPreset("unit.ml.v1")).toThrowError(
      new ConfigurationMetadataError(
        "configuration_registry.category_mismatch",
        "unit.ml.v1"
      )
    );
    expect(() => getConfigurationSchema("unit.ml.v1")).toThrowError(
      new ConfigurationMetadataError(
        "configuration_registry.category_mismatch",
        "unit.ml.v1"
      )
    );
    expect(requireVerifiedConfigurationEntry("unit.ml.v1").id).toBe(
      "unit.ml.v1"
    );
  });

  it("returns deeply immutable configuration and quantity metadata", () => {
    const quantity = getQuantityPreset(
      "quantity-preset.sodium_hydroxide_0_100m_50ml.v1"
    );
    expect(Object.isFrozen(configurationRegistry.list())).toBe(true);
    expect(Object.isFrozen(quantity)).toBe(true);
    expect(Object.isFrozen(quantity.compatibleMaterialProfileIds)).toBe(true);
  });

  it("keeps deterministic configuration contracts free of forbidden imports", () => {
    for (const file of ["types.ts", "entries.ts", "index.ts"]) {
      const source = readFileSync(
        new URL(
          `../../../../src/lab-workflows/registries/configurations/${file}`,
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
