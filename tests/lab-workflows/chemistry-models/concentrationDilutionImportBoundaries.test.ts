import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../src/lab-workflows/chemistry-models/concentration-dilution"
);

describe("concentration/dilution chemistry import boundaries", () => {
  it("contains no UI, network, persistence, family dispatch, or alternate engine", () => {
    const source = readdirSync(DIRECTORY)
      .filter((file) => file.endsWith(".ts"))
      .map((file) => readFileSync(join(DIRECTORY, file), "utf8"))
      .join("\n")
      .toLowerCase();

    for (const forbidden of [
      "family" + "id",
      "engine.dilution",
      "experiments/",
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
