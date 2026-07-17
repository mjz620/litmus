import { describe, expect, it } from "vitest";

import {
  getExperimentManifest,
  listExperimentManifests,
  loadExperimentDefinition,
  UnknownExperimentError
} from "../../src/experiments/registry";

describe("experiment registry", () => {
  it("exposes titration discovery metadata without loading the engine", () => {
    const manifest = getExperimentManifest("acid_base_titration");

    expect(manifest).toMatchObject({
      id: "acid_base_titration",
      title: "Acid–Base Titration",
      version: "1.0.0",
      metadata: {
        estimatedMinutes: 20,
        difficulty: "intermediate",
        readinessWeights: {
          burette_conditioning: 0.25,
          endpoint_control: 0.3,
          volumetric_reading: 0.2,
          stoichiometry: 0.25
        }
      }
    });
    expect(manifest.loadDefinition).toBeTypeOf("function");
  });

  it("lists both independently registered experiment manifests", () => {
    expect(listExperimentManifests().map(({ id }) => id)).toEqual([
      "acid_base_titration",
      "precipitation_solubility"
    ]);
  });

  it("lazily loads the precipitation definition by ID", async () => {
    const definition = await loadExperimentDefinition(
      "precipitation_solubility"
    );
    expect(definition.id).toBe("precipitation_solubility");
    expect(definition.step).toBeTypeOf("function");
  });

  it("lazily loads the titration definition by ID", async () => {
    const definition = await loadExperimentDefinition("acid_base_titration");

    expect(definition.id).toBe("acid_base_titration");
    expect(definition.title).toBe("Acid–Base Titration");
    expect(definition.step).toBeTypeOf("function");
    expect(definition.createInitialState).toBeTypeOf("function");
  });

  it("throws a specific error for an unknown experiment ID", async () => {
    expect(() => getExperimentManifest("not_registered")).toThrow(
      new UnknownExperimentError("not_registered")
    );
    await expect(
      loadExperimentDefinition("not_registered")
    ).rejects.toBeInstanceOf(UnknownExperimentError);
  });
});
