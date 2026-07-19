# LC2-804 Legacy retirement inventory

Produced during Phase 8 cleanup. Owner authorization for this run: implement Phase 8 including retiring titration dual-path defaults (chat decisions 1A/2B).

## Removed / demoted

| Path | Action | Replacement |
| --- | --- | --- |
| Titration production/demo defaulting to legacy engine | Demoted | Default `setup_driven_v2` via `resolveLabSessionRuntimeMode` |
| `?runtime=setup-v2` as required opt-in | Demoted to redundant alias | Default path; flag still accepted |
| Composer Assign permanently disabled | Removed | Assign → approve + pin via APIs |
| Composer named save local-only | Demoted | Server drafts primary; local named/working draft retained for offline/crash recovery |
| Docs claiming Assign/pins/defaults still Phase 8 future work | Updated | Repo_Current_State, tickets README, system map, architecture, ops runbook |

## Retained (required)

| Path | Reason |
| --- | --- |
| Precipitation static experiment route/engine | Not migrated to Composer; ticket forbids deletion |
| `?runtime=legacy` titration escape hatch | Rollback/parity + retry-skill demos until physical sign-off retires it |
| Null-pin assignment/session legacy resolver | Historical static rows must remain readable |
| Titration compatibility adapters / v1 schema+hash | Historical replay and migrated seed support |
| Author Agent v1 family compatibility route | Still present as frozen prototype; capability author is the production path — retain until a dedicated delete ticket proves zero callers |
| `LocalLabDraftRepository` working/named local cache | Crash recovery and offline named saves alongside server sync |
| Report via direct `ExperimentDefinition.step()` | No registered v2 report mechanic |

## Manual verification evidence

- Unit/integration: assignment eligibility, approve/assign/resolve, stale pin fail-closed, default setup-driven store load, coach offline fallback.
- Playwright: default `/lab/titration` expects `data-runtime-mode=setup_driven_v2`; precipitation remains legacy; setup-driven coach/offline cases retained.
- Teacher/student manual sign-off: recorded as repository-owner chat authorization to flip defaults (1A) and retire dual-path surfaces (2B) in this implementation run.

## Rollback

1. Point student routes at `?runtime=legacy` or temporarily revert `resolveLabSessionRuntimeMode` default.
2. Keep pin migrations; they are additive and safe to leave in place.
3. Do not delete `lab_definition_versions` rows referenced by pins.

## Follow-up tickets

| Ticket | Closes |
| --- | --- |
| `LC2-805` | Student assignment entry → pinned session init |
| `LC2-806` | Physical Chromebook / dual-lab performance sign-off |
| `LC2-807` | Author Agent v1 family route deletion |
| `LC2-808` | Titration `?runtime=legacy` student escape-hatch removal |

Specs: [`tickets/phase-8-persistence.md`](tickets/phase-8-persistence.md) (follow-up section).
