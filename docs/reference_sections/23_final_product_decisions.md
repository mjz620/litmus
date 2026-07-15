# 23. Final product decisions
The following decisions are locked unless a deliberate architecture review changes them:

1. StudentModel lives in memory during the active session and flushes at checkpoints.
2. Chemistry runs locally and never waits on OpenAI or Supabase.
3. The database is load-bearing because it connects student evidence to teacher insight.
4. Titration is the hero and must be deep before additional experiments expand.
5. Seeding is a first-class plugin capability used by Judge Mode and Adaptive Retry.
6. The event stream is shared by tutoring, persistence, replay, and analytics.
7. The tutor is a constrained agent with tools, not a freeform chatbot.
8. The teacher dashboard uses deterministic aggregates over real data.
9. Demo Mode is a dedicated environment with one-click role switching and no auth.
10. Coding agents may parallelize implementation, but chemistry validation, pedagogy, architecture coherence, and integration remain human-reviewed.

---

# Appendix A — canonical event and student model contracts

```ts
export interface SkillEvidence {
  skillId: string;
  delta: number;
  reason: string;
  detail?: Record<string, number | string | boolean>;
}

export interface SemanticEvent {
  type: string;
  tSim: number;
  observation: Record<string, number | string | boolean>;
  flags: string[];
  evidence: SkillEvidence[];
}

export interface SkillEstimate {
  mastery: number;
  evidenceCount: number;
  lastReason?: string;
}

export interface StudentModel {
  sessionId: string;
  experimentId: string;
  skills: Record<string, SkillEstimate>;
  activeFlags: string[];
}
```

# Appendix B — versioning conventions

Add explicit version fields before persisted production use:

```ts
interface VersionedSemanticEvent extends SemanticEvent {
  schemaVersion: 1;
  experimentVersion: string;
}
```

Persist:

- event schema version,
- experiment version,
- model configuration version for interventions,
- rubric version for reports.

This protects replay and analytics when experiments evolve.

# Appendix C — source files already established

The initial implementation already includes:

- `experiment.ts` — plugin contract, semantic events, StudentModel, evidence update.
- `titration.ts` — deterministic acid–base titration engine, indicator behavior, skill evidence, and seed support.
- `titration.test.ts` — truth-layer tests and false-intervention discipline.

These files should be moved into the repository structure above without weakening their design invariants.
