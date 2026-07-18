import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../src/lab-workflows/events"
);

describe("semantic event envelope import boundaries", () => {
  it("contains no family dispatch, chemistry implementation, framework, network, or persistence route", () => {
    const source = readdirSync(DIRECTORY)
      .filter((file) => file.endsWith(".ts"))
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
