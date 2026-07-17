import { describe, expect, it } from "vitest";

import { generateTitrationSessionConfig } from "../../src/experiments/titration/sessionConfig";
import { equivalenceVolumeML } from "../../src/experiments/titration/titration";

describe("seeded titration session configuration", () => {
  it("reproduces the same configuration for the same seed", () => {
    expect(generateTitrationSessionConfig("replay-alpha")).toEqual(
      generateTitrationSessionConfig("replay-alpha")
    );
  });

  it("varies representative sessions", () => {
    const first = generateTitrationSessionConfig("replay-alpha");
    const second = generateTitrationSessionConfig("replay-beta");

    expect(second).not.toEqual(first);
  });

  it("keeps every generated equivalence point within two fills", () => {
    const configurations = Array.from({ length: 250 }, (_, index) =>
      generateTitrationSessionConfig(`validity-seed-${index}`)
    );

    for (const config of configurations) {
      const equivalenceML = equivalenceVolumeML(config);

      expect(config.analyte.volumeML).toBeGreaterThan(0);
      expect(config.analyte.concentrationM).toBeGreaterThan(0);
      expect(config.titrant.concentrationM).toBeGreaterThan(0);
      expect(Number.isFinite(equivalenceML)).toBe(true);
      expect(equivalenceML).toBeGreaterThan(0);
      expect(equivalenceML).toBeLessThanOrEqual(config.buretteCapacityML * 2);
    }

    expect(
      new Set(configurations.map((config) => JSON.stringify(config))).size
    ).toBeGreaterThan(1);
    expect(
      configurations.some(
        (config) => equivalenceVolumeML(config) > config.buretteCapacityML
      )
    ).toBe(true);
  });
});
