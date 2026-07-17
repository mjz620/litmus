import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("Supabase migrations", () => {
  it("defines the required constrained persistence tables and idempotency key", () => {
    const sql = readFileSync(
      resolve(root, "supabase/migrations/202607170001_initial_schema.sql"),
      "utf8"
    );
    for (const table of [
      "profiles",
      "classes",
      "class_members",
      "sessions",
      "events",
      "skill_estimates",
      "coach_interventions",
      "reports"
    ]) {
      expect(sql).toContain(`create table public.${table}`);
    }
    expect(sql).toContain("unique (session_id, client_event_id)");
    expect(sql).toContain("workflow_version_id text");
  });

  it("enables RLS for every student/teacher data table without anonymous demo reads", () => {
    const sql = readFileSync(
      resolve(root, "supabase/migrations/202607170002_rls_policies.sql"),
      "utf8"
    );
    expect(sql.match(/enable row level security/g)).toHaveLength(9);
    expect(sql).toContain("teachers read owned class sessions");
    expect(sql).toContain("students manage own sessions");
    expect(sql).not.toMatch(/to\s+anon/i);
  });

  it("ships a runnable role-isolation fixture", () => {
    const sql = readFileSync(
      resolve(root, "supabase/tests/rls_isolation.sql"),
      "utf8"
    );
    expect(sql).toContain("set local role authenticated");
    expect(sql).toContain("student reads only their own session");
    expect(sql).toContain("outsider cannot read an unjoined class");
    expect(sql).toContain("teacher reads only sessions in their class");
    expect(sql).toContain("rollback;");
  });
});
