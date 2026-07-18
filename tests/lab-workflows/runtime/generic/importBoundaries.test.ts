import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SOURCE_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../src/lab-workflows/runtime/generic"
);
const SOURCE_FILES = [
  "compile.ts",
  "definition.ts",
  "errors.ts",
  "index.ts",
  "runtime.ts",
  "schemas.ts",
  "types.ts",
  "utils.ts"
];
const COORDINATOR_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../src/lab-workflows/chemistry-models/coordinator"
);
const COORDINATOR_FILES = [
  "coordinator.ts",
  "errors.ts",
  "index.ts",
  "types.ts"
];

describe("generic runtime import and dispatch boundaries", () => {
  it("contains no legacy dispatch metadata, dynamic imports, framework, network, or browser dependencies", () => {
    const source = SOURCE_FILES.map((file) =>
      readFileSync(join(SOURCE_DIRECTORY, file), "utf8")
    )
      .concat(
        COORDINATOR_FILES.map((file) =>
          readFileSync(join(COORDINATOR_DIRECTORY, file), "utf8")
        )
      )
      .join("\n");
    const forbidden = [
      "family" + "Id",
      "compatible" + "FamilyIds",
      "compatible" + "EngineIds",
      "engine" + "ActionType",
      "react",
      "three",
      "zustand",
      "supabase",
      "openai",
      "next/",
      "window",
      "document",
      "fetch(",
      "import("
    ];

    for (const value of forbidden)
      expect(source.toLowerCase()).not.toContain(value.toLowerCase());
  });
});
