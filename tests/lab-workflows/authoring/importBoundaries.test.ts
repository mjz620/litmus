import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("Lab Composer authoring import boundaries", () => {
  it("keeps the shared command layer pure and platform-neutral", () => {
    const source = ["commands.ts", "service.ts", "serialization.ts"]
      .map((file) =>
        readFileSync(
          join(process.cwd(), "src/lab-workflows/authoring", file),
          "utf8"
        )
      )
      .join("\n");
    for (const forbidden of [
      "react",
      "three",
      "zustand",
      "supabase",
      "openai",
      "next/",
      "window.",
      "document.",
      "fetch("
    ]) {
      expect(source.toLowerCase()).not.toContain(forbidden);
    }
  });
});
