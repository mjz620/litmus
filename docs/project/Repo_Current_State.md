# Repo Current State — Lab Composer Direction

## Architecture pivot note

LabBench AI is pivoting from a catalog of manually defined static experiment plugins toward a composable workflow architecture. A teacher should be able to describe a learning goal in natural language, after which a Lab Authoring Agent proposes a typed `LabWorkflowSpec` using verified component, action, reagent, engine, skill, event-flag, retry, and safety registry IDs.

This is a composition layer over the existing system, not a replacement for it:

- existing deterministic chemistry engines remain the sole owners of pH, equivalence, solubility/precipitate identity, calorimetry math, measurement consequences, state transitions, and ground truth;
- every meaningful action continues through `ExperimentDefinition.step()`;
- semantic events remain the contract for Student Coach, StudentModel, persistence, replay, evaluator, evals, and teacher analytics;
- hard deterministic validation owns runnability and safety eligibility;
- a separate Judge Agent critiques pedagogy but cannot override validation;
- teachers preview and approve a runnable immutable workflow before assignment;
- unsupported or unsafe requests remain visibly non-runnable;
- simulation stays local/non-blocking and Chromebook-friendly.

The architecture thesis is **AI-authored lab workflows over verified deterministic lab primitives**, not arbitrary AI-generated chemistry labs.

## Current implementation reality

At the time of this documentation pivot:

- the existing acid-base titration plugin/truth layer, typed actions, semantic events, seeded sessions, and 3D student surface remain the implementation baseline;
- the component/action/reagent/engine/skill/event-flag registries described by the new docs are design contracts, not yet a complete runtime registry system;
- `LabWorkflowSpec`, the hard validator, runtime assembler, authoring route, Judge Agent route, teacher Composer UI, assignment persistence, and Composer eval harness are not implemented by this documentation task;
- precipitation and calorimetry workflow examples are planned/non-runnable until their deterministic engines and compatibility tests exist;
- the Bunsen/open-flame component is restricted/future for the Chromebook MVP.

## Migration target

The first implementation sequence is registry contracts → workflow schema/validator → checked-in titration seed spec → titration runtime assembler/parity test. AI authoring should not be allowed to produce runnable variants before this deterministic path passes.

See [implementation-roadmap-lab-composer.md](implementation-roadmap-lab-composer.md) and the “Lab Composer / Composable Workflow Architecture” section of [`tickets.md`](../../tickets.md).

## Living implementation record

The detailed completed-ticket list, source tree, dependencies, commands, and current build/test status remain in [`docs/Repo_Current_State.md`](../Repo_Current_State.md). Keep that file current after implementation tickets; keep this project-scoped note aligned when the composer architecture's support status changes materially.
