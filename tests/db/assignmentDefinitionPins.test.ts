import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    import.meta.dirname,
    "../../supabase/migrations/202607190002_assignment_definition_pins.sql"
  ),
  "utf8"
);

describe("LC2-801 assignment definition pin migration", () => {
  it("adds nullable pins without dropping legacy experiment columns", () => {
    expect(migration).toContain(
      "add column if not exists lab_definition_version_id uuid"
    );
    expect(migration).toContain("lab_definition_canonical_hash text");
    expect(migration).toContain("assign_idempotency_key uuid");
    expect(migration).toContain("alter table public.assignments");
    expect(migration).toContain("alter table public.sessions");
    expect(migration).not.toMatch(/drop column/i);
    expect(migration).toContain("legacy experiment_id");
  });

  it("enforces pin-pair consistency and class-scoped idempotency", () => {
    expect(migration).toContain("assignments_pin_pair_consistent");
    expect(migration).toContain("sessions_pin_pair_consistent");
    expect(migration).toContain(
      "assignments_class_assign_idempotency_uidx"
    );
  });
});
