# Design Update Companion

Use this doc after each implementation ticket to keep design docs from drifting.

## After every ticket, ask

1. Did the implementation change any route, contract, schema, or invariant?
2. Did the implementation add a dependency?
3. Did a manual verification step change?
4. Did a ticket become obsolete or need splitting?
5. Did Codex discover a known issue?
6. Did the repo state change?

## If yes, update

- `docs/Repo_Current_State.md`
- `tickets.md`
- `docs/MVP_Technical_Design.md`
- relevant architecture/product doc
- `docs/Known_Issues_And_Followups.md`

## Design change template

```md
## DU-000 — Title

- Date:
- Triggering ticket:
- Decision:
- Previous design:
- New design:
- Files/docs updated:
- Tickets affected:
- Risk:
```

## Locked decisions

These should not change casually:

1. StudentModel lives in memory during active session and flushes at checkpoints.
2. Chemistry runs locally and never waits on OpenAI or Supabase.
3. Database is load-bearing for teacher insight.
4. Titration is the hero.
5. Seeding is first-class.
6. Event stream is shared by tutoring, persistence, replay, and analytics.
7. Tutor is a constrained agent with tools.
8. Teacher dashboard uses deterministic aggregates.
9. Demo Mode is dedicated and auth-free.
10. Human reviews chemistry, pedagogy, architecture, and integration.
