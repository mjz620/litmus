-- LC2-801: exact immutable definition-version pins on assignments and sessions.
-- Additive only: legacy experiment_id / experiment_version columns remain required.

alter table public.assignments
  add column if not exists lab_definition_version_id uuid
    references public.lab_definition_versions(id) on delete restrict,
  add column if not exists lab_definition_canonical_hash text
    check (
      lab_definition_canonical_hash is null
      or lab_definition_canonical_hash ~ '^sha256:[a-f0-9]{64}$'
    ),
  add column if not exists approval_request_id uuid,
  add column if not exists assigned_by uuid references public.profiles(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists assign_idempotency_key uuid;

alter table public.assignments
  add constraint assignments_pin_pair_consistent check (
    (
      lab_definition_version_id is null
      and lab_definition_canonical_hash is null
      and approval_request_id is null
      and assigned_by is null
      and assigned_at is null
      and assign_idempotency_key is null
    )
    or (
      lab_definition_version_id is not null
      and lab_definition_canonical_hash is not null
      and assigned_by is not null
      and assigned_at is not null
      and assign_idempotency_key is not null
    )
  );

create unique index if not exists assignments_class_assign_idempotency_uidx
  on public.assignments (class_id, assign_idempotency_key)
  where assign_idempotency_key is not null;

create index if not exists assignments_lab_definition_version_id_idx
  on public.assignments (lab_definition_version_id);

alter table public.sessions
  add column if not exists lab_definition_version_id uuid
    references public.lab_definition_versions(id) on delete restrict,
  add column if not exists lab_definition_canonical_hash text
    check (
      lab_definition_canonical_hash is null
      or lab_definition_canonical_hash ~ '^sha256:[a-f0-9]{64}$'
    );

alter table public.sessions
  add constraint sessions_pin_pair_consistent check (
    (
      lab_definition_version_id is null
      and lab_definition_canonical_hash is null
    )
    or (
      lab_definition_version_id is not null
      and lab_definition_canonical_hash is not null
    )
  );

create index if not exists sessions_lab_definition_version_id_idx
  on public.sessions (lab_definition_version_id);

-- Teachers may read approved versions they own (already on versions table).
-- Class members need assignment pins only; version bodies resolve via service role.
