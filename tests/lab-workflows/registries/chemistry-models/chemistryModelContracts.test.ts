import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SOURCE_FILES = [
  "entries.ts",
  "errors.ts",
  "index.ts",
  "registry.ts",
  "resolution.ts",
  "types.ts"
] as const;

describe("chemistry model contract dependency boundary", () => {
  it("contains no framework, browser, agent, network, or titration imports", () => {
    for (const file of SOURCE_FILES) {
      const source = readFileSync(
        join(
          process.cwd(),
          "src/lab-workflows/registries/chemistry-models",
          file
        ),
        "utf8"
      );
      expect(source, file).not.toMatch(
        /(?:from|import\s*\()["'][^"']*(?:react|three|next|openai|@supabase|zustand|src\/app|src\/components|src\/stores|titration)[^"']*["']/i
      );
      expect(source, file).not.toContain("window.");
      expect(source, file).not.toContain("document.");
      expect(source, file).not.toContain("fetch(");
    }
  });
});
