import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../src/lab-workflows/replay"
);

describe("generic replay import boundaries", () => {
  it("has no family dispatch, chemistry formulas, framework, persistence, or network dependencies", () => {
    const source = ["genericReplay.ts", "schemas.ts", "types.ts", "errors.ts"]
      .map((file) => readFileSync(join(DIRECTORY, file), "utf8"))
      .join("\n")
      .toLowerCase();
    for (const forbidden of [
      "family" + "id",
      "experiments/titration",
      "chemistry-models/coordinator",
      "supabase",
      "openai",
      "react",
      "three",
      "next/",
      "fetch(",
      "date.now",
      "math.random"
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
