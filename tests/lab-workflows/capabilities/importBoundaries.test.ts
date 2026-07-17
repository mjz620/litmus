import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOTS = [
  join(process.cwd(), "src/lab-workflows/capabilities"),
  join(process.cwd(), "src/lab-workflows/registries/components")
];

function filesUnder(path: string): readonly string[] {
  return readdirSync(path).flatMap((name) => {
    const child = join(path, name);
    return statSync(child).isDirectory() ? filesUnder(child) : [child];
  });
}

describe("capability contract import boundary", () => {
  it("does not import UI, browser, network, persistence, or agent modules", () => {
    const forbidden = [
      /from\s+["']react(?:\/[^"']*)?["']/,
      /from\s+["'](?:@react-three|three)(?:\/[^"']*)?["']/,
      /from\s+["']zustand(?:\/[^"']*)?["']/,
      /from\s+["']openai(?:\/[^"']*)?["']/,
      /from\s+["']@supabase(?:\/[^"']*)?["']/,
      /from\s+["']next(?:\/[^"']*)?["']/,
      /from\s+["'][^"']*src\/components[^"']*["']/,
      /from\s+["'][^"']*src\/app[^"']*["']/,
      /\bwindow\s*\./,
      /\bdocument\s*\./
    ];
    const sources = ROOTS.flatMap(filesUnder).map((path) => ({
      path,
      source: readFileSync(path, "utf8").toLowerCase()
    }));

    for (const { path, source } of sources) {
      for (const pattern of forbidden) {
        expect(source, `${path} matches forbidden ${pattern}`).not.toMatch(
          pattern
        );
      }
    }
  });
});
