import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { componentRegistry } from "../../src/lab-workflows/registries/components";
import { LAB_VISUAL_ADAPTERS } from "../../src/components/lab/titration/setupDrivenScene";
import {
  RENDERABLE_VISUAL_ADAPTER_IDS,
  findMisseatedAdapters,
  findVisualAdapterWiringGaps
} from "../../src/components/lab/three/renderableAdapters";

const LAB_SCENE_SOURCE = readFileSync(
  "src/components/lab/three/LabScene.tsx",
  "utf8"
);

/**
 * Adding equipment means updating several maps, and two of them fail silently.
 * These assertions turn "the beaker is invisible" and "the beaker is floating
 * at the origin" into build-time failures.
 */
describe("visual adapter wiring", () => {
  const registeredAdapterIds = componentRegistry
    .list()
    .map(({ visualAdapterDefinitionId }) => visualAdapterDefinitionId);

  it("registers and renders every component's visual adapter", () => {
    expect(findVisualAdapterWiringGaps(registeredAdapterIds)).toEqual([]);
  });

  it("seats every rendered adapter from its local origin", () => {
    expect(findMisseatedAdapters(registeredAdapterIds)).toEqual([]);
  });

  it("keeps the renderable list honest against LabScene itself", () => {
    // Guards the list from drifting into a claim LabScene does not back up.
    for (const visualAdapterDefinitionId of RENDERABLE_VISUAL_ADAPTER_IDS) {
      expect(LAB_SCENE_SOURCE).toContain(`poseFor("${visualAdapterDefinitionId}")`);
    }
  });

  it("has a scene registration for every renderable adapter", () => {
    for (const visualAdapterDefinitionId of RENDERABLE_VISUAL_ADAPTER_IDS) {
      expect(LAB_VISUAL_ADAPTERS[visualAdapterDefinitionId]).toBeDefined();
    }
  });
});
