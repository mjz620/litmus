import { describe, expect, it } from "vitest";

import { componentRegistry } from "../../../../src/lab-workflows/registries/components";
import { configurationRegistry } from "../../../../src/lab-workflows/registries/configurations";
import { engineRegistry } from "../../../../src/lab-workflows/registries/engines";
import { eventFlagRegistry } from "../../../../src/lab-workflows/registries/event-flags";
import { skillRegistry } from "../../../../src/lab-workflows/registries/skills";

describe("verified skill compatibility", () => {
  it("resolves every capability reference used by verified authoring skills", () => {
    for (const skill of skillRegistry
      .list()
      .filter(({ availability }) => availability === "verified")) {
      expect(
        skill.supportedFamilyIds.some((familyId) =>
          engineRegistry.list().some((engine) => engine.familyId === familyId)
        )
      ).toBe(true);
      for (const componentId of skill.requiredComponentIds) {
        componentRegistry.get(componentId);
      }
      for (const flagId of skill.relevantEventFlagIds) {
        eventFlagRegistry.get(flagId);
      }
      for (const assessmentModeId of skill.assessmentModeIds) {
        configurationRegistry.get(assessmentModeId);
      }
      for (const coachTriggerTypeId of skill.coachTriggerTypeIds) {
        configurationRegistry.get(coachTriggerTypeId);
      }
      for (const retryId of skill.adaptiveRetryPatternIds) {
        configurationRegistry.get(retryId);
      }
    }
  });

  it("keeps planned precipitation and calorimetry skills non-authorable", () => {
    for (const id of [
      "net_ionic_equations",
      "precipitate_observation",
      "heat_transfer",
      "calorimetry_sign_convention"
    ] as const) {
      const skill = skillRegistry.get(id);
      expect(skill.availability).toBe("planned");
      expect(
        skill.supportedFamilyIds.every((familyId) =>
          engineRegistry.list().every((engine) => engine.familyId !== familyId)
        )
      ).toBe(true);
    }
  });
});
