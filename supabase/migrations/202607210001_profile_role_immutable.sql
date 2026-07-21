/*
 * An account is a student or a teacher, never both.
 *
 * Until now the only thing standing between a student and the teacher role was
 * application code: "profiles update self" lets a profile update its own row,
 * and role is a plain text column on that row. Any authenticated caller holding
 * an anon key could update profiles set role = 'teacher' where id = auth.uid()
 * and pass every teacher gate in the product — is_teacher(), the class insert
 * policy, and the Composer cloud-save check all read this column.
 *
 * The role is therefore fixed at signup and changed only by an operator with
 * service-role access, who is not subject to this trigger's callers.
 */
create or replace function public.reject_profile_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'A profile role cannot be changed once it is set.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

/*
 * `update of role` narrows the trigger to statements that name the column, and
 * `is distinct from` above lets an unchanged value through — the sign-up path
 * upserts the whole row, including a role identical to the stored one.
 *
 * Dropped first so the file can be re-applied. This project has no migration
 * ledger — scripts/apply-remote-db.mjs replays whole files — and a bare
 * `create trigger` fails the second time, which would leave a re-run looking
 * like a broken migration rather than a no-op.
 */
drop trigger if exists profiles_reject_role_change on public.profiles;
create trigger profiles_reject_role_change
before update of role on public.profiles
for each row execute function public.reject_profile_role_change();

revoke all on function public.reject_profile_role_change()
  from public, anon, authenticated;
