create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'teacher')),
  name text,
  created_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  join_code text not null unique check (join_code ~ '^[A-Z0-9]{6,10}$'),
  created_at timestamptz not null default now()
);

create table public.class_members (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  experiment_id text not null,
  experiment_version text not null,
  title text not null check (char_length(title) between 1 and 160),
  due_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key,
  user_id uuid references public.profiles(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  assignment_id uuid references public.assignments(id) on delete set null,
  experiment_id text not null,
  experiment_version text not null,
  workflow_version_id text,
  mode text not null check (mode in ('practice', 'assignment', 'demo', 'preview')),
  session_seed text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  final_state jsonb,
  parent_session_id uuid references public.sessions(id) on delete set null,
  is_demo boolean not null default false
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  client_event_id text not null,
  seq integer not null check (seq >= 0),
  event_schema_version text not null default '1',
  ts timestamptz not null default now(),
  payload jsonb not null,
  unique (session_id, client_event_id),
  unique (session_id, seq)
);

create table public.skill_estimates (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  experiment_id text not null,
  skill_id text not null,
  mastery numeric not null check (mastery between 0 and 1),
  confidence numeric check (confidence between 0 and 1),
  latest_reason text,
  evidence_count integer not null default 0 check (evidence_count >= 0),
  updated_at timestamptz not null default now(),
  unique (session_id, skill_id)
);

create table public.coach_interventions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  trigger_client_event_id text,
  prompt_version text not null,
  model text not null,
  hint_level integer check (hint_level between 0 and 3),
  response jsonb not null,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions(id) on delete cascade,
  rubric_version text not null,
  prompt_version text not null,
  model text not null,
  student_text jsonb not null,
  rubric jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index classes_teacher_id_idx on public.classes (teacher_id);
create index class_members_student_id_idx on public.class_members (student_id);
create index assignments_class_id_idx on public.assignments (class_id);
create index sessions_user_id_idx on public.sessions (user_id);
create index sessions_class_id_idx on public.sessions (class_id);
create index sessions_assignment_id_idx on public.sessions (assignment_id);
create index sessions_parent_session_id_idx on public.sessions (parent_session_id);
create index sessions_demo_idx on public.sessions (is_demo) where is_demo;
create index events_session_seq_idx on public.events (session_id, seq);
create index events_flags_gin_idx on public.events using gin ((payload -> 'flags'));
create index skill_estimates_class_skill_idx on public.skill_estimates (class_id, skill_id);
create index coach_interventions_session_idx on public.coach_interventions (session_id);
