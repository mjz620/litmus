-- LC2-800: mutable teacher drafts and immutable approved definition versions.
-- This migration is additive: assignments, sessions, and all legacy columns are
-- intentionally unchanged until LC2-801.

create table public.lab_definition_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  storage_revision integer not null default 1 check (storage_revision >= 1),
  schema_version text not null check (schema_version in ('2.0.0', '2.1.0')),
  draft_spec jsonb not null,
  last_save_request_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  unique (owner_id, last_save_request_id),
  constraint lab_definition_drafts_unvalidated_spec_check check (
    jsonb_typeof(draft_spec) = 'object'
    and draft_spec ->> 'schemaVersion' = schema_version
    and draft_spec ->> 'supportStatus' = 'draft_unvalidated'
    and jsonb_typeof(draft_spec -> 'validation') = 'null'
    and jsonb_typeof(draft_spec -> 'judgeCritique') = 'null'
  )
);

create table public.lab_definition_versions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  source_draft_revision integer not null check (source_draft_revision >= 1),
  schema_version text not null check (schema_version in ('2.0.0', '2.1.0')),
  canonical_hash text not null check (
    canonical_hash ~ '^sha256:[0-9a-f]{64}$'
  ),
  spec jsonb not null,
  validation_artifact jsonb not null,
  registry_snapshot_ids jsonb not null,
  resolved_adapters jsonb not null,
  resolved_chemistry_models jsonb not null,
  migration_provenance jsonb,
  support_status text not null check (support_status = 'runnable'),
  creator_id uuid not null references public.profiles(id) on delete restrict,
  approver_id uuid not null references public.profiles(id) on delete restrict,
  approval_request_id uuid not null,
  approved_at timestamptz not null,
  advisory_critique jsonb,
  created_at timestamptz not null default now(),
  foreign key (draft_id, owner_id)
    references public.lab_definition_drafts(id, owner_id) on delete restrict,
  unique (owner_id, approval_request_id),
  constraint lab_definition_versions_teacher_authority_check check (
    creator_id = owner_id and approver_id = owner_id
  ),
  constraint lab_definition_versions_validated_spec_check check (
    jsonb_typeof(spec) = 'object'
    and spec ->> 'schemaVersion' = schema_version
    and spec ->> 'supportStatus' = support_status
    and jsonb_typeof(spec -> 'validation') = 'object'
    and spec -> 'validation' = validation_artifact
    and validation_artifact ->> 'validatedSchemaVersion' = schema_version
    and validation_artifact ->> 'canonicalSpecHash' = canonical_hash
    and validation_artifact ->> 'status' = 'runnable'
    and validation_artifact ->> 'runnable' = 'true'
    and validation_artifact ->> 'previewEligible' = 'true'
    and jsonb_typeof(registry_snapshot_ids) = 'object'
    and registry_snapshot_ids = validation_artifact -> 'registrySnapshotIds'
    and jsonb_typeof(resolved_adapters) = 'array'
    and resolved_adapters = validation_artifact -> 'resolvedAdapters'
    and jsonb_typeof(resolved_chemistry_models) = 'array'
    and resolved_chemistry_models =
      validation_artifact -> 'resolvedChemistryModels'
    and (
      (migration_provenance is null and not (spec ? 'provenance'))
      or migration_provenance = spec -> 'provenance'
    )
    and (
      (
        advisory_critique is null
        and jsonb_typeof(spec -> 'judgeCritique') = 'null'
      )
      or advisory_critique = spec -> 'judgeCritique'
    )
  )
);

create index lab_definition_drafts_owner_updated_idx
  on public.lab_definition_drafts (owner_id, updated_at desc);
create index lab_definition_versions_owner_approved_idx
  on public.lab_definition_versions (owner_id, approved_at desc);
create index lab_definition_versions_draft_idx
  on public.lab_definition_versions (draft_id);

alter table public.lab_definition_drafts enable row level security;
alter table public.lab_definition_versions enable row level security;
alter table public.lab_definition_drafts force row level security;
alter table public.lab_definition_versions force row level security;

create policy "teachers read owned lab definition drafts"
  on public.lab_definition_drafts
  for select
  to authenticated
  using (owner_id = auth.uid() and public.is_teacher());

create policy "teachers create owned lab definition drafts"
  on public.lab_definition_drafts
  for insert
  to authenticated
  with check (owner_id = auth.uid() and public.is_teacher());

create policy "teachers update owned lab definition drafts"
  on public.lab_definition_drafts
  for update
  to authenticated
  using (owner_id = auth.uid() and public.is_teacher())
  with check (owner_id = auth.uid() and public.is_teacher());

-- Approved rows are read-only to authenticated clients. A server route must
-- authenticate the teacher, reparse/revalidate the current draft, and then use
-- the server-only service role for the insert.
create policy "teachers read owned lab definition versions"
  on public.lab_definition_versions
  for select
  to authenticated
  using (owner_id = auth.uid() and public.is_teacher());

revoke all on table public.lab_definition_drafts from anon, authenticated;
revoke all on table public.lab_definition_versions from anon, authenticated;
grant select, insert, update on table public.lab_definition_drafts
  to authenticated;
grant select on table public.lab_definition_versions to authenticated;
grant select, insert, update on table public.lab_definition_drafts
  to service_role;
grant select, insert on table public.lab_definition_versions to service_role;

create or replace function public.save_lab_definition_draft(
  requested_owner_id uuid,
  request_id uuid,
  requested_draft_id uuid,
  expected_storage_revision integer,
  requested_name text,
  requested_schema_version text,
  requested_draft_spec jsonb,
  requested_saved_at timestamptz
)
returns setof public.lab_definition_drafts
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_draft public.lab_definition_drafts%rowtype;
  saved_draft public.lab_definition_drafts%rowtype;
begin
  if requested_owner_id is null or not exists (
    select 1
    from public.profiles
    where id = requested_owner_id and role = 'teacher'
  ) then
    raise exception 'lab_definition_teacher_required'
      using errcode = '42501';
  end if;

  if requested_draft_id is null then
    select * into current_draft
    from public.lab_definition_drafts
    where owner_id = requested_owner_id
      and last_save_request_id = request_id;

    if found then
      return next current_draft;
      return;
    end if;

    insert into public.lab_definition_drafts (
      owner_id,
      name,
      storage_revision,
      schema_version,
      draft_spec,
      last_save_request_id,
      created_at,
      updated_at
    )
    values (
      requested_owner_id,
      requested_name,
      1,
      requested_schema_version,
      requested_draft_spec,
      request_id,
      requested_saved_at,
      requested_saved_at
    )
    on conflict (owner_id, last_save_request_id) do nothing
    returning * into saved_draft;

    if found then
      return next saved_draft;
      return;
    end if;

    select * into current_draft
    from public.lab_definition_drafts
    where owner_id = requested_owner_id
      and last_save_request_id = request_id;
    return next current_draft;
    return;
  end if;

  select * into current_draft
  from public.lab_definition_drafts
  where id = requested_draft_id and owner_id = requested_owner_id
  for update;

  if not found then
    if expected_storage_revision is not null then
      raise exception 'lab_definition_not_found' using errcode = 'P0002';
    end if;

    select * into current_draft
    from public.lab_definition_drafts
    where owner_id = requested_owner_id
      and last_save_request_id = request_id;

    if found then
      return next current_draft;
      return;
    end if;

    insert into public.lab_definition_drafts (
      id,
      owner_id,
      name,
      storage_revision,
      schema_version,
      draft_spec,
      last_save_request_id,
      created_at,
      updated_at
    )
    values (
      requested_draft_id,
      requested_owner_id,
      requested_name,
      1,
      requested_schema_version,
      requested_draft_spec,
      request_id,
      requested_saved_at,
      requested_saved_at
    )
    on conflict do nothing
    returning * into saved_draft;

    if found then
      return next saved_draft;
      return;
    end if;

    select * into current_draft
    from public.lab_definition_drafts
    where owner_id = requested_owner_id
      and last_save_request_id = request_id;

    if found then
      return next current_draft;
      return;
    end if;

    raise exception 'lab_definition_not_found' using errcode = 'P0002';
  end if;

  if current_draft.last_save_request_id = request_id then
    return next current_draft;
    return;
  end if;

  if expected_storage_revision is null
    or expected_storage_revision <> current_draft.storage_revision then
    raise exception 'lab_definition_revision_conflict' using errcode = '40001';
  end if;

  update public.lab_definition_drafts
  set
    name = requested_name,
    storage_revision = current_draft.storage_revision + 1,
    schema_version = requested_schema_version,
    draft_spec = requested_draft_spec,
    last_save_request_id = request_id,
    updated_at = requested_saved_at
  where id = current_draft.id and owner_id = requested_owner_id
  returning * into saved_draft;

  return next saved_draft;
end;
$$;

revoke all on function public.save_lab_definition_draft(
  uuid, uuid, uuid, integer, text, text, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.save_lab_definition_draft(
  uuid, uuid, uuid, integer, text, text, jsonb, timestamptz
) to service_role;

create or replace function public.approve_lab_definition_version(
  requested_owner_id uuid,
  request_id uuid,
  requested_draft_id uuid,
  expected_storage_revision integer,
  requested_schema_version text,
  requested_canonical_hash text,
  requested_spec jsonb,
  requested_validation_artifact jsonb,
  requested_registry_snapshot_ids jsonb,
  requested_resolved_adapters jsonb,
  requested_resolved_chemistry_models jsonb,
  requested_migration_provenance jsonb,
  requested_advisory_critique jsonb,
  requested_approved_at timestamptz
)
returns setof public.lab_definition_versions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_draft public.lab_definition_drafts%rowtype;
  existing_version public.lab_definition_versions%rowtype;
  approved_version public.lab_definition_versions%rowtype;
begin
  if requested_owner_id is null or not exists (
    select 1
    from public.profiles
    where id = requested_owner_id and role = 'teacher'
  ) then
    raise exception 'lab_definition_teacher_required'
      using errcode = '42501';
  end if;

  select * into existing_version
  from public.lab_definition_versions
  where owner_id = requested_owner_id
    and approval_request_id = request_id;

  if found then
    return next existing_version;
    return;
  end if;

  select * into current_draft
  from public.lab_definition_drafts
  where id = requested_draft_id and owner_id = requested_owner_id
  for update;

  if not found then
    raise exception 'lab_definition_not_found' using errcode = 'P0002';
  end if;

  if expected_storage_revision is null
    or expected_storage_revision <> current_draft.storage_revision then
    raise exception 'lab_definition_revision_conflict' using errcode = '40001';
  end if;

  insert into public.lab_definition_versions (
    draft_id,
    owner_id,
    source_draft_revision,
    schema_version,
    canonical_hash,
    spec,
    validation_artifact,
    registry_snapshot_ids,
    resolved_adapters,
    resolved_chemistry_models,
    migration_provenance,
    support_status,
    creator_id,
    approver_id,
    approval_request_id,
    approved_at,
    advisory_critique,
    created_at
  )
  values (
    current_draft.id,
    requested_owner_id,
    current_draft.storage_revision,
    requested_schema_version,
    requested_canonical_hash,
    requested_spec,
    requested_validation_artifact,
    requested_registry_snapshot_ids,
    requested_resolved_adapters,
    requested_resolved_chemistry_models,
    requested_migration_provenance,
    'runnable',
    requested_owner_id,
    requested_owner_id,
    request_id,
    requested_approved_at,
    requested_advisory_critique,
    requested_approved_at
  )
  on conflict (owner_id, approval_request_id) do nothing
  returning * into approved_version;

  if found then
    return next approved_version;
    return;
  end if;

  select * into existing_version
  from public.lab_definition_versions
  where owner_id = requested_owner_id
    and approval_request_id = request_id;
  return next existing_version;
end;
$$;

revoke all on function public.approve_lab_definition_version(
  uuid, uuid, uuid, integer, text, text, jsonb, jsonb, jsonb, jsonb,
  jsonb, jsonb, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.approve_lab_definition_version(
  uuid, uuid, uuid, integer, text, text, jsonb, jsonb, jsonb, jsonb,
  jsonb, jsonb, jsonb, timestamptz
) to service_role;

create or replace function public.require_lab_definition_version_teacher()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = new.owner_id and role = 'teacher'
  ) then
    raise exception 'lab_definition_teacher_required'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger lab_definition_versions_require_teacher
before insert on public.lab_definition_versions
for each row execute function public.require_lab_definition_version_teacher();

create or replace function public.reject_lab_definition_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Approved lab definition versions are immutable.'
    using errcode = '55000';
end;
$$;

create trigger lab_definition_versions_reject_update_or_delete
before update or delete on public.lab_definition_versions
for each row execute function public.reject_lab_definition_version_mutation();

revoke all on function public.reject_lab_definition_version_mutation()
  from public, anon, authenticated;
revoke all on function public.require_lab_definition_version_teacher()
  from public, anon, authenticated;

comment on table public.lab_definition_drafts is
  'Mutable teacher-owned LabWorkflowSpec drafts. Stored specs are always unvalidated.';
comment on table public.lab_definition_versions is
  'Immutable explicitly approved LabWorkflowSpec versions created only after server-side validation.';
comment on column public.lab_definition_versions.canonical_hash is
  'Exact domain-separated sha256 hash from the deterministic LabWorkflowSpec validator.';
comment on column public.lab_definition_versions.approval_request_id is
  'Per-owner idempotency key for explicit approval retries.';
comment on function public.save_lab_definition_draft(
  uuid, uuid, uuid, integer, text, text, jsonb, timestamptz
) is
  'Atomically creates or revision-checks an authenticated teacher-owned unvalidated draft.';
comment on function public.approve_lab_definition_version(
  uuid, uuid, uuid, integer, text, text, jsonb, jsonb, jsonb, jsonb,
  jsonb, jsonb, jsonb, timestamptz
) is
  'Locks the source draft and atomically inserts one immutable server-validated version.';

-- Rollback-safe review: this migration mutates no legacy table. If it must be
-- reversed before LC2-801, drop the version triggers/functions, save function,
-- lab_definition_versions, then lab_definition_drafts, in that order.
