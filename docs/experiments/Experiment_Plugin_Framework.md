# Experiment Plugin Framework

## Purpose

Every experiment is data plus pure functions conforming to one interface. The 3D shell, coach, evaluator, persistence, demo mode, and eval harness are shared infrastructure.

## Required invariants

- Experiments expose typed config, state, actions, and semantic events.
- `createInitialState(config, seed?)` supports valid intermediate seeds.
- `step(state, action)` is a pure reducer.
- Display rounding is separate from full-precision engine state.
- New experiment plugins do not duplicate the lab shell, coach, evaluator, or persistence layer.

## Canonical interface

```ts
export interface ExperimentDefinition<C, S, A> {
  id: string;
  title: string;
  version: string;
  createInitialState(config: C, seed?: ExperimentSeed): S;
  step(state: S, action: A): ExperimentStepResult<S>;
  getObservableState(state: S): Record<string, unknown>;
  getReadiness(state: S, model: StudentModel): ReadinessSummary;
  validateSeed?(config: C, seed: ExperimentSeed): boolean;
}

export interface ExperimentStepResult<S> {
  state: S;
  events: SemanticEvent[];
}
```

## Semantic event contract

```ts
export interface SemanticEvent {
  type: string;
  tSim: number;
  observation: Record<string, number | string | boolean>;
  flags: string[];
  evidence: SkillEvidence[];
}

export interface SkillEvidence {
  skillId: string;
  delta: number;
  reason: string;
  detail?: Record<string, number | string | boolean>;
}
```

## StudentModel contract

```ts
export interface StudentModel {
  sessionId: string;
  experimentId: string;
  skills: Record<string, SkillEstimate>;
  activeFlags: string[];
}

export interface SkillEstimate {
  mastery: number;
  evidenceCount: number;
  lastReason?: string;
}
```

## Seeding use cases

- Judge Mode starts titration at 22.00 mL.
- Adaptive Retry starts near the relevant mistake.
- Eval harness starts from seeded error scenarios.
- Regression tests verify intermediate states.

## Plugin registration

`src/experiments/registry.ts` should map experiment IDs to definitions and lazily-loaded UI manifests.
