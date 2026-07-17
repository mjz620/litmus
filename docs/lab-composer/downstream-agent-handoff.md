# Downstream LC2 Agent Handoff Template

Copy this prompt for one implementation agent. Replace bracketed values. Do not combine tickets unless the repository owner explicitly authorizes it.

```md
You are implementing one capability-driven Lab Composer migration ticket in the existing LabBench AI repository.

Active ticket:
- ID: [LC2-XXX]
- Specification: [exact link under docs/lab-composer/tickets]

Before editing, read completely:
1. AGENTS.md
2. the active ticket specification
3. docs/lab-composer/README.md
4. docs/lab-composer/current-system-map.md
5. the relevant sections of docs/lab-composer/contract-blueprint.md
6. docs/lab-composer/migration-playbook.md
7. docs/lab-composer/verification-playbook.md
8. docs/lab-composer-architecture.md
9. every source and test file listed in the active ticket

Repository state:
- The worktree may already be dirty. Preserve all user changes and inspect overlap before editing.
- LabWorkflowSpec v1, its canonical hash/validator, the canonical titration workflow, titration-specific assembler, and the initial Author Agent route already exist.
- The old T0210–T0220 sequence is superseded. Do not implement it.

Non-negotiable architecture:
- Deterministic describes scientific calculation; it does not mean one hard-coded runtime family per lab.
- Never dispatch generic runtime behavior from familyId.
- Every meaningful student action must flow through ExperimentDefinition.step().
- UI, prompts, workflow specs, and agents never calculate chemistry.
- Registry IDs resolve exactly. Never fuzzy-match, silently substitute, or invent an ID.
- New or edited drafts are unvalidated until deterministic current-hash validation succeeds.
- Judge/agent output never overrides hard validation.
- Preserve v1 parsing, hashes, titration behavior, events, replay, checkpoints, coach/evaluator behavior, and old saved records unless the ticket includes explicit compatibility tests.
- Do not delete legacy paths before the LC2-804 cleanup gate.

Execution requirements:
1. Confirm ticket dependencies exist in source/tests.
2. State the exact files you expect to modify before editing.
3. Add focused tests for valid, invalid, and safety/compatibility behavior as required.
4. Implement only the active ticket and use the file ownership boundaries in AGENTS.md.
5. Run every automatic and manual verification item in the ticket.
6. Update docs/lab-composer/current-system-map.md and docs/Repo_Current_State.md only if implementation status materially changed.
7. Stop rather than guessing if a required ID, chemistry formula/capability, migration rule, or cross-boundary change is missing from the ticket.

Before completion, inspect for:
- familyId runtime dispatch;
- React/Three/OpenAI/Supabase/browser imports in deterministic contracts;
- chemistry formulas outside chemistry-owned modules;
- direct state mutation outside ExperimentDefinition.step();
- unvalidated preview/assignment;
- stale hash or registry snapshots;
- arbitrary expressions/generated code;
- unrelated refactors or overwritten user changes.

End with the exact AGENTS.md completion report. Include ticket scope, architectural effect, compatibility evidence, files changed, commands/results, manual verification, risks, and schema/registry/migration/docs follow-ups.
```

## Reviewer prompt

Use this after the implementation agent finishes:

```md
Review the completed LC2 ticket against:
- AGENTS.md;
- its exact docs/lab-composer/tickets specification;
- docs/lab-composer/contract-blueprint.md;
- docs/lab-composer/migration-playbook.md;
- docs/lab-composer/verification-playbook.md.

Do not implement future tickets. Inspect code and tests. Report findings in severity order with exact file/line references.

Specifically prove or disprove:
1. every acceptance criterion is implemented and tested;
2. v1 behavior/hash/replay compatibility is preserved where relevant;
3. no generic runtime behavior dispatches from familyId;
4. every meaningful action still enters ExperimentDefinition.step();
5. deterministic chemistry and workflow evaluation responsibilities are separated;
6. registry/adapter/material/model IDs resolve exactly;
7. validation/Judge/agent authority is not weakened;
8. the worktree contains no unrelated refactor or deleted user work;
9. tests cover valid, invalid, safety, and positive stay-silent cases required by the ticket;
10. docs and implementation status accurately describe what is actually runnable.
```
