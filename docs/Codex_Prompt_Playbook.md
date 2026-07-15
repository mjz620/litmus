# Codex Prompt Playbook

## Standard implementation prompt

Use the handoff template in `docs/Codex_Ticket_Handoff_Template.md`.

## Planning review prompt

```md
Review the current docs and ticket backlog for LabBench AI.
Do not write code.
Identify architecture risks, missing dependencies, tickets that are too broad, and manual verification gaps.
Return suggested doc/ticket edits only.
```

## Completion report prompt

```md
Before ending, produce the completion report required by AGENTS.md.
Be explicit about files changed, commands run, tests/build results, manual verification, risks, follow-up tickets, and docs to update.
```

## Adversarial review prompt

```md
Review the implementation for boundary violations.
Specifically check:
- chemistry leaking into UI,
- LLM computing deterministic values,
- teacher metrics using model-generated numbers,
- demo mode forking production logic,
- hidden future-ticket work.
Do not modify code unless the active ticket explicitly asks for review fixes.
```

## Bugfix prompt

```md
Fix only the bug described below.
Do not refactor unrelated code.
Do not add future features.
Add or update a regression test if practical.
Report the root cause and verification steps.

Bug:
[description]
```

## Doc update prompt

```md
Update only the docs required by the completed ticket.
Keep design docs consistent with actual repo state.
Do not change product scope unless explicitly requested.
```
