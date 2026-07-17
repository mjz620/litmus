# LabBench AI

LabBench AI is evolving from a set of manually defined virtual chemistry experiments into a composable virtual-lab workflow platform. Teachers describe a learning goal, and Lab Composer proposes a structured workflow over verified components, actions, reagents, skills, event flags, and deterministic experiment engines.

The boundary remains non-negotiable: **AI authors pedagogy and workflow structure; deterministic engines own chemistry and state transitions.** LabBench does not claim arbitrary AI-generated chemistry labs. Unsupported or unsafe requests remain non-runnable.

The product prioritizes pre-lab readiness for high-school students, especially under-resourced schools and Chromebook-class devices. See [`docs/README.md`](docs/README.md) for the architecture and implementation-planning reading order.

## Build workflow

This project was built using an agent-assisted development workflow. The repository includes:

- `AGENTS.md`: implementation rules for coding agents
- `tickets.md`: verifiable scoped engineering tickets
- `docs/`: product, architecture, experiment, AI, evaluation, and demo specifications

The workflow keeps code and AI-authored lab specifications constrained by deterministic chemistry engines, typed contracts, hard validation, manual verification, and one-ticket-at-a-time review.

The committed workflow sources live at the repository root. The local
`labbench_codex_workflow_pack/` directory is retained only as a reference bundle
and is excluded from Git.
