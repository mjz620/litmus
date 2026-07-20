import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const INTERACTABLE_SOURCE = readFileSync(
  "src/components/lab/three/Interactable.tsx",
  "utf8"
);

/**
 * Pointer handlers must stay on the wrapping group, not on the collider.
 *
 * The collider volumes are much smaller than the meshes they stand in for, so
 * scoping events to them leaves only a few pixels of each item responsive and
 * hovering appears not to work at all. This shipped once; a browser test
 * (tests/e2e/equipment-hover.spec.ts) covers the behaviour, this covers the
 * structure.
 */
describe("Interactable pointer wiring", () => {
  const groupOpen = INTERACTABLE_SOURCE.slice(
    INTERACTABLE_SOURCE.lastIndexOf("  return (\n    <group"),
    INTERACTABLE_SOURCE.indexOf("<group ref={pulseGroupRef}>")
  );
  const hitAnchor = INTERACTABLE_SOURCE.indexOf("position={hit.position}");
  const hitMesh = INTERACTABLE_SOURCE.slice(
    INTERACTABLE_SOURCE.lastIndexOf("<mesh", hitAnchor),
    INTERACTABLE_SOURCE.indexOf("</mesh>", hitAnchor)
  ).replace(/\/\*[\s\S]*?\*\//g, "");

  it("attaches pointer handlers to the wrapping group", () => {
    expect(groupOpen).toContain("onPointerOver");
    expect(groupOpen).toContain("onPointerOut");
    expect(groupOpen).toContain("onClick");
  });

  it("keeps the collider additive rather than the sole hit surface", () => {
    expect(hitMesh).not.toContain("onPointerOver");
  });

  it("keeps the collider non-rendering", () => {
    // A rendered, double-sided collider intercepts rays it used to pass
    // through, which can steal pointerdown from nested controls such as the
    // burette stopcock handle.
    expect(hitMesh).toContain("visible={false}");
    expect(hitMesh).not.toContain("DoubleSide");
  });
});
