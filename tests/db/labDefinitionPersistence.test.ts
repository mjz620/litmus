import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    import.meta.dirname,
    "../../supabase/migrations/202607190001_lab_definition_persistence.sql"
  ),
  "utf8"
);

describe("LC2-800 lab-definition persistence migration", () => {
  it("adds mutable drafts and immutable versions without changing assignments or sessions", () => {
    expect(migration).toContain("create table public.lab_definition_drafts");
    expect(migration).toContain("create table public.lab_definition_versions");
    expect(migration).toContain("source_draft_revision integer not null");
    expect(migration).not.toMatch(/alter table public\.(assignments|sessions)/);
  });

  it("stores strict unvalidated drafts and matching runnable validation provenance", () => {
    expect(migration).toContain("lab_definition_drafts_unvalidated_spec_check");
    expect(migration).toContain("'supportStatus' = 'draft_unvalidated'");
    expect(migration).toContain("jsonb_typeof(draft_spec -> 'validation')");
    expect(migration).toContain("lab_definition_versions_validated_spec_check");
    expect(migration).toContain("spec -> 'validation' = validation_artifact");
    expect(migration).toContain(
      "validation_artifact ->> 'canonicalSpecHash' = canonical_hash"
    );
    expect(migration).toContain("support_status = 'runnable'");
  });

  it("uses owner-scoped idempotency keys and locks the draft before approval", () => {
    expect(migration).toContain("unique (owner_id, last_save_request_id)");
    expect(migration).toContain("unique (owner_id, approval_request_id)");
    expect(migration).toContain(
      "create or replace function public.save_lab_definition_draft"
    );
    expect(migration).toContain(
      "create or replace function public.approve_lab_definition_version"
    );
    expect(migration).toContain(
      "expected_storage_revision <> current_draft.storage_revision"
    );
    expect(migration.match(/for update;/g)).toHaveLength(2);
    expect(migration).toContain("lab_definition_revision_conflict");
  });

  it("keeps server mutations service-role-only while RLS limits direct reads and draft writes", () => {
    expect(migration).toContain(
      'create policy "teachers read owned lab definition drafts"'
    );
    expect(migration).toContain(
      'create policy "teachers update owned lab definition drafts"'
    );
    expect(migration).toContain(
      'create policy "teachers read owned lab definition versions"'
    );
    expect(migration).not.toMatch(
      /create policy "[^"]+"[\s\S]{0,100}lab_definition_versions[\s\S]{0,100}for (insert|update|delete)/
    );
    expect(migration).toContain(
      ") from public, anon, authenticated;\ngrant execute on function public.approve_lab_definition_version("
    );
    expect(migration).toContain(") to service_role;");
  });

  it("rejects every update or delete of an approved version", () => {
    expect(migration).toContain(
      "create trigger lab_definition_versions_reject_update_or_delete"
    );
    expect(migration).toContain(
      "before update or delete on public.lab_definition_versions"
    );
    expect(migration).toContain(
      "Approved lab definition versions are immutable."
    );
  });
});
