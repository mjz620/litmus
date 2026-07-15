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

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| class_id | uuid FK | |
| experiment_id | text | plugin ID |
| title | text | optional override |
| config | jsonb | safe public experiment config; never hidden answer if exposed |
| due_at | timestamptz nullable | |
| created_at | timestamptz | |

### `sessions`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid nullable | null for ordinary guest; demo uses scoped identity |
| class_id | uuid nullable | |
| assignment_id | uuid nullable | |
| experiment_id | text | |
| mode | enum | `practice`, `assignment`, `judge_demo`, `adaptive_retry` |
| parent_session_id | uuid nullable | adaptive retry link |
| started_at | timestamptz | |
| completed_at | timestamptz nullable | |
| final_state | jsonb nullable | serialized plugin state |
| sync_status | text | optional diagnostics |

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
- Demo routes use server-controlled access to demo tenant rows; public clients do not receive service-role credentials.
- Service-role key never reaches the browser.

---
