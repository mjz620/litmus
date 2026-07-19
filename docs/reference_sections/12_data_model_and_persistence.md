# 12. Data model and persistence
![Database entity relationships](assets/erd.png)

## 12.1 Tables

### `profiles`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | references auth user |
| role | enum | `student`, `teacher`, `admin` |
| display_name | text | |
| created_at | timestamptz | |

### `classes`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| teacher_id | uuid FK | owner |
| name | text | |
| join_code | text unique | six-character human-friendly code |
| is_demo | boolean | protects demo behavior |
| created_at | timestamptz | |

### `class_members`

| Column | Type | Notes |
|---|---|---|
| class_id | uuid FK | composite unique with student |
| student_id | uuid FK | |
| joined_at | timestamptz | |

### `assignments`

Live schema authority: `supabase/migrations/202607170001_initial_schema.sql` plus `202607190002_assignment_definition_pins.sql`.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| class_id | uuid FK | |
| experiment_id | text | denormalized catalog/plugin ID |
| experiment_version | text | denormalized version label |
| title | text | |
| due_at | timestamptz nullable | |
| created_at | timestamptz | |
| lab_definition_version_id | uuid nullable FK | exact approved Composer version pin |
| lab_definition_canonical_hash | text nullable | matching `sha256:` hash |
| approval_request_id | uuid nullable | approval idempotency provenance |
| assigned_by | uuid nullable FK | teacher |
| assigned_at | timestamptz nullable | |
| assign_idempotency_key | uuid nullable | unique per class when present |

### `sessions`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid nullable | null for ordinary guest; demo uses scoped identity |
| class_id | uuid nullable | |
| assignment_id | uuid nullable | |
| experiment_id | text | |
| experiment_version | text | |
| workflow_version_id | text nullable | compatibility provenance string |
| lab_definition_version_id | uuid nullable FK | exact approved Composer version pin |
| lab_definition_canonical_hash | text nullable | matching hash for fail-closed replay |
| mode | enum | `practice`, `assignment`, `demo`, `preview` |
| parent_session_id | uuid nullable | adaptive retry link |
| started_at | timestamptz | |
| completed_at | timestamptz nullable | |
| final_state | jsonb nullable | serialized plugin state |
| is_demo | boolean | demo isolation |

### `events`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| session_id | uuid FK | |
| sequence_no | integer | deterministic ordering |
| t_sim | numeric | simulation time |
| payload | jsonb | canonical SemanticEvent |
| created_at | timestamptz | wall-clock persistence time |

Unique: `(session_id, sequence_no)` for idempotent retries.

### `skill_estimates`

| Column | Type | Notes |
|---|---|---|
| session_id | uuid FK | |
| student_id | uuid FK | |
| experiment_id | text | |
| skill_id | text | |
| mastery | numeric | bounded [0,1] |
| evidence_count | integer | |
| last_reason | text nullable | |
| updated_at | timestamptz | |

Unique: `(session_id, skill_id)`.

### `coach_interventions`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| session_id | uuid FK | |
| trigger_event_id | uuid nullable | |
| trigger_type | text | |
| hint_level | integer nullable | |
| response | jsonb | validated CoachResponse |
| tool_trace | jsonb nullable | redacted/structured |
| created_at | timestamptz | |

### `reports`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| session_id | uuid FK unique | |
| student_response | jsonb | structured report |
| rubric | jsonb | validated evaluator output |
| created_at | timestamptz | |

### `lab_definition_drafts`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | mutable teacher-owned draft identity |
| owner_id | uuid FK | teacher profile owner |
| name | text | teacher-facing saved name |
| storage_revision | integer | optimistic concurrency revision |
| schema_version | text | strict `LabWorkflowSpec` schema version |
| draft_spec | jsonb | always `draft_unvalidated`; validation and Judge artifacts are null |
| last_save_request_id | uuid | per-owner save idempotency key |
| created_at / updated_at | timestamptz | server persistence timestamps |

### `lab_definition_versions`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | immutable approved version identity |
| draft_id / owner_id | uuid FK | exact owned source draft |
| source_draft_revision | integer | locked revision approved by the teacher |
| schema_version / canonical_hash | text | exact versioned content authority |
| spec / validation_artifact | jsonb | server-revalidated runnable spec and matching artifact |
| registry_snapshot_ids | jsonb | exact registry provenance |
| resolved_adapters / resolved_chemistry_models | jsonb | deterministic runtime provenance |
| migration_provenance | jsonb nullable | exact source migration metadata |
| creator_id / approver_id | uuid FK | explicit teacher authority |
| approval_request_id | uuid | per-owner approval idempotency key |
| advisory_critique | jsonb nullable | non-authoritative hash-bound Judge provenance |
| approved_at / created_at | timestamptz | immutable approval timestamps |

Approved rows reject update and delete at the database trigger boundary. The server reloads and deterministically revalidates the current draft before calling the service-role-only approval function; persistence never makes a lab runnable independently.

## 12.2 Persistence strategy

The simulation is local-first.

### In memory

- current experiment state,
- current StudentModel,
- recent event ring buffer,
- intervention history,
- pending action state.

### Local queue

- unsynced events,
- skill checkpoints,
- report submission if needed.

P0 may use a durable localStorage queue with bounded payloads. P1 should use IndexedDB.

### Checkpoints

Flush asynchronously on:

1. session start,
2. every meaningful semantic event batch,
3. skill estimate change,
4. stage transition,
5. report submission,
6. adaptive retry completion,
7. page visibility change/unload using best-effort beacon.

Use idempotency keys and sequence numbers.

## 12.3 Row-Level Security summary

- Students can read/write their own sessions, events, reports, and skill estimates.
- Students can read classes they joined and assignments for those classes.
- Teachers can read classes they own and educational records for members of those classes.
- Teachers cannot mutate student evidence.
- Teachers can read and update only their own unvalidated lab drafts and read only their own approved definition versions.
- Students cannot read or write Lab Composer drafts or approved versions; approved-version mutation functions are service-role-only.
- Demo routes use server-controlled access to demo tenant rows; public clients do not receive service-role credentials.
- Service-role key never reaches the browser.

---
