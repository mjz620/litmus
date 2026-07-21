import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { componentRegistry } from "../../src/lab-workflows/registries/components";
import { LAB_VISUAL_ADAPTERS } from "../../src/components/lab/titration/setupDrivenScene";
import {
  RENDERABLE_VISUAL_ADAPTER_IDS,
  findMisseatedAdapters,
  findVisualAdapterWiringGaps
} from "../../src/components/lab/three/renderableAdapters";
import { COMPOSER_RENDERABLE_VISUAL_ADAPTER_IDS } from "../../src/components/teacher/lab-composer/Composer3DSetupEditor";

const LAB_SCENE_SOURCE = readFileSync(
  "src/components/lab/three/LabScene.tsx",
  "utf8"
);

const COMPOSER_EDITOR_SOURCE = readFileSync(
  "src/components/teacher/lab-composer/Composer3DSetupEditor.tsx",
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
      expect(LAB_SCENE_SOURCE).toContain(
        `poseFor("${visualAdapterDefinitionId}")`
      );
    }
  });

  it("has a scene registration for every renderable adapter", () => {
    for (const visualAdapterDefinitionId of RENDERABLE_VISUAL_ADAPTER_IDS) {
      expect(LAB_VISUAL_ADAPTERS[visualAdapterDefinitionId]).toBeDefined();
    }
  });

  /*
   * The composer bench is a second, independent render switch. An adapter
   * missing there draws nothing *and* leaves no mesh to grab, so the equipment
   * is invisible and un-arrangeable — which is exactly how the balance,
   * weighing boat, and beaker went missing from the composer while rendering
   * correctly for students.
   */
  it("draws every student-renderable adapter in the composer bench too", () => {
    expect(
      RENDERABLE_VISUAL_ADAPTER_IDS.filter(
        (visualAdapterDefinitionId) =>
          !COMPOSER_RENDERABLE_VISUAL_ADAPTER_IDS.includes(
            visualAdapterDefinitionId
          )
      )
    ).toEqual([]);
  });

  it("keeps the composer renderable list honest against its own switch", () => {
    for (const visualAdapterDefinitionId of COMPOSER_RENDERABLE_VISUAL_ADAPTER_IDS) {
      expect(COMPOSER_EDITOR_SOURCE).toContain(
        `case "${visualAdapterDefinitionId}":`
      );
    }
  });
});
