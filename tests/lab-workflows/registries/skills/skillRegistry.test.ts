import { describe, expect, it } from "vitest";

import {
  createSkillRegistry,
  SKILL_REGISTRY_DEFINITIONS,
  skillRegistry,
  SkillRegistryError,
  type SkillRegistryDefinition
} from "../../../../src/lab-workflows/registries/skills";

describe("canonical Lab Composer skill registry", () => {
  it("derives verified availability only from backed family and component capability", () => {
    const verified = skillRegistry
      .list()
      .filter(({ availability }) => availability === "verified")
      .map(({ id }) => id);
    const planned = skillRegistry
      .list()
      .filter(({ availability }) => availability === "planned")
      .map(({ id }) => id);

    expect(verified).toEqual([
      "endpoint_control",
      "meniscus_reading",
      "burette_conditioning",
      "stoichiometry",
      "significant_figures",
      "volumetric_transfer",
      "solution_dilution",
      "procedural_safety",
      "data_recording"
    ]);
    expect(planned).toEqual([
      "net_ionic_equations",
      "precipitate_observation",
      "heat_transfer",
      "calorimetry_sign_convention"
    ]);
  });

  it("publishes a versioned snapshot for family-neutral verified skills", () => {
    expect(skillRegistry.snapshotId).toBe("skills.2.0.0");
    expect(skillRegistry.get("volumetric_transfer")).toMatchObject({
      supportedFamilyIds: [],
      availability: "verified"
    });
    expect(skillRegistry.get("solution_dilution")).toMatchObject({
      supportedFamilyIds: [],
      availability: "verified"
    });
  });

  it("resolves every documented legacy alias to one canonical authoring ID", () => {
    expect(skillRegistry.resolve("volumetric_reading")).toMatchObject({
      status: "resolved",
      canonicalId: "meniscus_reading",
      source: "alias"
    });
    expect(skillRegistry.resolve("sig_figs")).toMatchObject({
      status: "resolved",
      canonicalId: "significant_figures",
      source: "alias"
    });
    expect(skillRegistry.resolve("net_ionic_equation")).toMatchObject({
      status: "resolved",
      canonicalId: "net_ionic_equations",
      source: "alias"
    });
    expect(skillRegistry.resolve("sign_convention")).toMatchObject({
      status: "resolved",
      canonicalId: "calorimetry_sign_convention",
      source: "alias"
    });
    expect(skillRegistry.resolve("endpoint_control")).toMatchObject({
      status: "resolved",
      canonicalId: "endpoint_control",
      source: "canonical"
    });
  });

  it("does not fuzzy-match IDs and reports unknown and ambiguous discovery explicitly", () => {
    expect(skillRegistry.resolve("endpoint controls")).toEqual({
      status: "unknown",
      inputId: "endpoint controls"
    });
    expect(skillRegistry.search("not a chemistry objective")).toEqual({
      status: "none",
      query: "not a chemistry objective",
      matches: []
    });
    expect(skillRegistry.search("titration")).toMatchObject({
      status: "ambiguous"
    });
    expect(skillRegistry.search("meniscus reading")).toMatchObject({
      status: "single",
      matches: [{ id: "meniscus_reading" }]
    });
  });

  it("rejects duplicate canonical IDs and alias conflicts", () => {
    const first = SKILL_REGISTRY_DEFINITIONS[0];
    expect(() => createSkillRegistry([first, { ...first }])).toThrowError(
      new SkillRegistryError("skill_registry.duplicate_id", first.id)
    );

    const conflict = {
      ...SKILL_REGISTRY_DEFINITIONS[1],
      id: "data_recording",
      aliases: ["volumetric_reading"]
    } satisfies SkillRegistryDefinition;
    expect(() =>
      createSkillRegistry([SKILL_REGISTRY_DEFINITIONS[1], conflict])
    ).toThrowError(
      new SkillRegistryError(
        "skill_registry.alias_conflict",
        "volumetric_reading"
      )
    );
  });

  it("returns deeply read-only canonical metadata", () => {
    const entry = skillRegistry.get("endpoint_control");
    expect(Object.isFrozen(skillRegistry.list())).toBe(true);
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.requiredComponentIds)).toBe(true);
    expect(Object.isFrozen(entry.examplePrompts)).toBe(true);
  });
});
