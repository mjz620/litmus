# Data Model

## Tables

### `profiles`

```sql
id uuid primary key references auth.users(id)
role text check (role in ('student','teacher')) not null
name text
created_at timestamptz default now()
```

### `classes`

```sql
id uuid primary key default gen_random_uuid()
teacher_id uuid references profiles(id) not null
name text not null
join_code text unique not null
created_at timestamptz default now()
```

### `class_members`

```sql
class_id uuid references classes(id) not null
student_id uuid references profiles(id) not null
created_at timestamptz default now()
primary key (class_id, student_id)
```

### `assignments`

```sql
id uuid primary key default gen_random_uuid()
class_id uuid references classes(id) not null
experiment_id text not null
title text not null
due_at timestamptz
created_at timestamptz default now()
```

### `sessions`

```sql
id uuid primary key default gen_random_uuid()
user_id uuid references profiles(id)
class_id uuid references classes(id)
assignment_id uuid references assignments(id)
experiment_id text not null
mode text check (mode in ('practice','assignment','demo')) not null
started_at timestamptz default now()
completed_at timestamptz
final_state jsonb
parent_session_id uuid references sessions(id)
is_demo boolean default false
```

### `events`

```sql
id uuid primary key default gen_random_uuid()
session_id uuid references sessions(id) not null
client_event_id text not null
seq integer not null
ts timestamptz default now()
payload jsonb not null
unique (session_id, client_event_id)
```

### `skill_estimates`

```sql
id uuid primary key default gen_random_uuid()
session_id uuid references sessions(id) not null
user_id uuid references profiles(id)
class_id uuid references classes(id)
experiment_id text not null
skill_id text not null
mastery numeric not null
confidence numeric
latest_reason text
evidence_count integer default 0
updated_at timestamptz default now()
unique (session_id, skill_id)
```

### `coach_interventions`

```sql
id uuid primary key default gen_random_uuid()
session_id uuid references sessions(id) not null
trigger_event_id uuid references events(id)
hint_level integer
response jsonb not null
created_at timestamptz default now()
```

### `reports`

```sql
id uuid primary key default gen_random_uuid()
session_id uuid references sessions(id) not null
student_text jsonb not null
rubric jsonb not null
created_at timestamptz default now()
```

## RLS summary

- Students can read/write their own sessions, events, skill estimates, coach interventions, and reports.
- Teachers can read class data for classes they own.
- Demo rows are readable from `/demo/*` through a controlled demo path.
- Guests can create anonymous practice/demo sessions through server routes, not direct unrestricted table access.

## Persistence strategy

### In-memory during session

- Experiment state.
- Recent event queue.
- StudentModel.
- Local coach state.

### Checkpointed asynchronously

- session start,
- meaningful event batches,
- skill updates,
- coach interventions,
- report submission,
- completion,
- adaptive retry linkage.

### Idempotency

Every client event gets a stable `client_event_id`. Duplicate checkpoint calls must not duplicate rows.
