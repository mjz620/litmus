# LC2 Capability-Driven Ticket Backlog

These are the authoritative implementation tickets for the capability-driven Lab Composer overhaul. The old `T0210`–`T0220` tickets are superseded and must not be executed.

Downstream agents normally implement one ticket per run under `AGENTS.md`. The repository owner may explicitly authorize a broader documentation/planning run, but implementation dependencies and gates still apply.

## Status

| Ticket | Status | Notes |
| --- | --- | --- |
| `LC2-000` | Complete | Architecture audit and migration plan |
| `LC2-001` | Optional gap ticket | Use only for a concrete missing black-box characterization; do not duplicate existing tests |
| `LC2-100` | Complete | Bounded capability vocabularies and backward-compatible equipment metadata |
| `LC2-101` | Complete | Capability-based action contracts and exact supporting metadata registries |
| `LC2-102` | Complete | Reusable material, quantity, and configuration-schema metadata |
| `LC2-102A` | Complete | Corrective parity registration for bromothymol blue, methyl orange, and distilled-water rinse support |
| `LC2-103` | Complete | Chemistry-model contracts and exact verified-provider resolver; production providers remain empty |
| `LC2-104` onward | Not started | Verify current source before claiming otherwise |

The next normal implementation ticket is `LC2-104`.

## Dependency map

```text
LC2-000
  -> LC2-100
  -> LC2-101
  -> LC2-102
  -> LC2-103
LC2-101/102/102A/103 -> LC2-104 -> LC2-105 -> LC2-106 -> LC2-107

LC2-107 -> LC2-200 -> LC2-201 -> LC2-202
LC2-200/202 -> LC2-203 -> LC2-204 -> LC2-205

LC2-205 -> LC2-300 -> LC2-301 -> LC2-302 -> LC2-303 -> LC2-304

LC2-304 -> LC2-400 -> LC2-401/402 -> LC2-403

LC2-403 -> LC2-500 -> LC2-501 -> LC2-502 -> LC2-503

LC2-503 + Level 2 gate -> LC2-600 -> LC2-601 -> LC2-602

LC2-502 -> LC2-700
LC2-602 -> LC2-701 -> LC2-702
LC2-204 + LC2-503 -> LC2-703

LC2-403 -> LC2-800 -> LC2-801
LC2-700/702/703/801 -> LC2-802 -> LC2-803 -> LC2-804
```

## Phase specifications

- [Phase 0 — remaining characterization](phase-0-characterization.md)
- [Phase 1 — capability-driven contracts](phase-1-contracts.md)
- [Phase 2 — generic runtime and constraint evaluator](phase-2-runtime.md)
- [Phase 3 — titration migration](phase-3-titration.md)
- [Phase 4 — human Composer foundation](phase-4-human-composer.md)
- [Phase 5 — second adaptable lab](phase-5-second-lab.md)
- [Phase 6 — agent command layer](phase-6-agent.md)
- [Phase 7 — hybrid evaluation](phase-7-evaluation.md)
- [Phase 8 — persistence, assignment, hardening, and cleanup](phase-8-persistence.md)

## Universal ticket rules

Every LC2 ticket must:

- preserve the repository invariants in `AGENTS.md`;
- start from exact current source rather than documentation assumptions;
- fail closed on unknown IDs, adapters, models, schemas, versions, or stale validation;
- add focused tests appropriate to the changed contract;
- preserve existing v1 behavior unless the ticket explicitly includes compatibility migration;
- avoid unrelated refactors and dependencies;
- update implementation status when a capability becomes actually runnable;
- complete the full report required by `AGENTS.md` plus the LC2 evidence fields in [`../verification-playbook.md`](../verification-playbook.md).

## Phase gates

### Enter Phase 2 only when

- v2 strict schema, migration, hash, and validator pass;
- capability/action/material/model references resolve exactly;
- v1 parsing/hashes remain stable.

### Enter Phase 4 only when

- migrated titration runs through the generic coordinator behind a flag;
- deterministic state/event/replay parity is proven;
- the legacy route remains available.

### Enter Phase 5 only when

- a human/fixture can create, validate, save/load, and preview a v2 setup without an LLM.

### Enter Phase 6 only when the Level 2 gate passes

- two labs use the same coordinator/evaluator;
- no family dispatch;
- alternate valid orders and mistake/tolerance traces execute;
- human Composer commands are the sole draft-editing domain path.

### Remove legacy code only in `LC2-804`

Parity, persistence migration, historical replay, e2e, performance, and manual sign-off are prerequisites.
