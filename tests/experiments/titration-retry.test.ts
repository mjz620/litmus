import { describe, expect, it } from "vitest";

import {
  createTitrationRetryScenario,
  validateTitrationRetryScenario
} from "../../src/experiments/titration/retry";

describe("titration retry seeds", () => {
  it("creates a validated near-endpoint seed three milliliters before equivalence", () => {
    const scenario = createTitrationRetryScenario(
      "endpoint_control",
      "retry-seed"
    );
    expect(scenario.seed.titrantAddedML).toBe(22);
    expect(scenario.seed.fillHistory).toEqual([
      expect.objectContaining({ kind: "initial", requestedML: 50 })
    ]);
    expect(validateTitrationRetryScenario(scenario)).toBe(true);
  });

  it("creates a pre-fill conditioning seed and rejects invalid state", () => {
    const scenario = createTitrationRetryScenario(
      "burette_conditioning",
      "conditioning-seed"
    );
    expect(scenario.seed.buretteAvailableML).toBeUndefined();
    expect(
      validateTitrationRetryScenario({
        ...scenario,
        seed: { buretteAvailableML: 51 }
      })
    ).toBe(false);
  });
});
