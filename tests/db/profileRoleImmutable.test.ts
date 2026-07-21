import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    import.meta.dirname,
    "../../supabase/migrations/202607210001_profile_role_immutable.sql"
  ),
  "utf8"
);

describe("profile role immutability migration", () => {
  /*
   * "profiles update self" lets a profile update its own row, and role is a
   * plain column on that row — so without a trigger any authenticated caller
   * holding the anon key could promote itself to teacher and pass is_teacher(),
   * the class insert policy, and the Composer cloud-save check.
   */
  it("rejects a role change on update", () => {
    expect(migration).toContain(
      "create or replace function public.reject_profile_role_change()"
    );
    expect(migration).toContain("new.role is distinct from old.role");
    expect(migration).toContain("raise exception");
    expect(migration).toContain("42501");
  });

  it("fires before the write lands", () => {
    expect(migration).toContain("before update of role on public.profiles");
    expect(migration).toContain("for each row execute function");
    expect(migration).toContain("create trigger profiles_reject_role_change");
  });

  /*
   * The sign-up path upserts the whole profile row, including a role equal to
   * the stored one. `is distinct from` has to let that through or a returning
   * user's own re-save would fail.
   */
  it("allows an unchanged role to be rewritten", () => {
    expect(migration).not.toMatch(/if\s+new\.role\s*!=\s*old\.role/i);
    expect(migration).toContain("is distinct from");
  });

  it("pins the search path and revokes the function from callers", () => {
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain(
      "revoke all on function public.reject_profile_role_change()"
    );
    expect(migration).toContain("from public, anon, authenticated");
  });

  /*
   * There is no migration ledger here — apply-remote-db.mjs replays whole
   * files — so a second application has to be a no-op rather than an error.
   */
  it("can be applied twice", () => {
    expect(migration).toContain(
      "drop trigger if exists profiles_reject_role_change on public.profiles"
    );
    expect(migration).toContain("create or replace function");
  });

  it("leaves the role column and existing rows alone", () => {
    expect(migration).not.toMatch(/drop\s+(column|table|policy)/i);
    expect(migration).not.toMatch(/^\s*update\s+public\.profiles/im);
  });
});
