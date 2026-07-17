import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { computeClassAnalytics } from "../../src/lib/analytics/classAnalytics";
import { demoAnalyticsFixture } from "../../src/lib/analytics/demoFixture";

describe("demo seed data", () => {
  it("contains schema rows rather than hard-coded dashboard metrics", () => {
    const sql = readFileSync(
      resolve(import.meta.dirname, "../../supabase/seed.sql"),
      "utf8"
    );
    for (const table of [
      "profiles",
      "classes",
      "class_members",
      "sessions",
      "events",
      "skill_estimates",
      "reports"
    ]) {
      expect(sql).toContain(`public.${table}`);
    }
    expect(sql).not.toContain("readiness_score");
  });

  it("derives demo metrics from fixture rows", () => {
    expect(computeClassAnalytics(demoAnalyticsFixture).completedSessions).toBe(
      2
    );
  });
});
