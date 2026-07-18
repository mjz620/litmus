import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../src/lab-workflows/evaluation"
);

describe("workflow evaluator import boundaries", () => {
  it("has no chemistry implementation, family dispatch, framework, network, or browser dependencies", () => {
    const source = readdirSync(DIRECTORY)
      .filter((file) => file.endsWith(".ts"))
      .map((file) => readFileSync(join(DIRECTORY, file), "utf8"))
      .join("\n")
      .toLowerCase();
    for (const forbidden of [
      "experiments/titration",
      "chemistry-models/coordinator",
      "family" + "id",
      "react",
      "three",
      "openai",
      "supabase",
      "next/",
      "fetch(",
      "window",
      "document"
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
