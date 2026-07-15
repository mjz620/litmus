# Workflow Overview

This project follows a controlled coding-agent workflow:

```text
Plan in ChatGPT
  ↓
Update docs
  ↓
Select one small ticket
  ↓
Give Codex the ticket with guardrails
  ↓
Codex implements on a branch
  ↓
Run build/tests
  ↓
Manually verify
  ↓
Paste completion report back into ChatGPT
  ↓
Update Repo_Current_State and Known_Issues
  ↓
Move to next ticket
```

## Why this workflow exists

LabBench AI has several boundaries that agents must not blur:

- deterministic chemistry vs. UI rendering,
- semantic event evidence vs. LLM prose,
- in-memory StudentModel vs. persisted teacher analytics,
- production routes vs. demo shortcuts,
- tutor tool-calling vs. freeform chatbot behavior.

Small tickets, explicit allowed areas, and manual verification keep the architecture intact.

## Ticket size rule

A ticket should be small enough that you can manually verify it in 5-10 minutes whenever possible. If a ticket starts expanding, split it rather than letting Codex make architecture choices.

## Human responsibilities

The human project owner must personally review:

- chemistry correctness,
- architecture boundary violations,
- pedagogical quality,
- coach/eval behavior,
- cross-workstream integration,
- final demo path.

Agents generate implementation volume; the human controls truth and coherence.
