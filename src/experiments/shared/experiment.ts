/** A skill an experiment can assess. */
export interface SkillDefinition {
  id: string;
  label: string;
  description: string;
}

/** Evidence about a student's mastery emitted by an experiment engine. */
export interface SkillEvidence {
  skillId: string;
  /** Positive values demonstrate competence; negative values show a misconception. */
  delta: number;
  /** Stable machine-readable reason for the evidence. */
  reason: string;
  detail?: Record<string, number | string | boolean>;
}

/** A serializable record of a pedagogically meaningful simulation action. */
export interface SemanticEvent {
  type: string;
  tSim: number;
  observation: Record<string, number | string | boolean>;
  flags: string[];
  evidence: SkillEvidence[];
}

/** The deterministic result of applying one experiment action. */
export interface StepResult<TState> {
  state: TState;
  events: SemanticEvent[];
}

/** Deterministic scientific truth used by report evaluation. */
export interface GroundTruth {
  values: Record<string, number>;
  notes: string[];
}

export interface RubricCriterion {
  id: string;
  label: string;
  description: string;
}

/**
 * Shared contract implemented by each deterministic experiment engine.
 *
 * TConfig configures the experiment, TState is serializable simulation state,
 * and TAction is a discrete typed student action.
 */
export interface ExperimentDefinition<TConfig, TState, TAction> {
  id: string;
  title: string;
  skills: SkillDefinition[];
  reportRubric: RubricCriterion[];

  createInitialState(config: TConfig, seed?: Partial<TState>): TState;
  step(state: TState, action: TAction): StepResult<TState>;
  getGroundTruth(state: TState): GroundTruth;
}

export interface SkillEstimate {
  mastery: number;
  evidenceCount: number;
  lastReason?: string;
}

/** Compact in-memory learning state for an active experiment session. */
export interface StudentModel {
  sessionId: string;
  experimentId: string;
  skills: Record<string, SkillEstimate>;
  activeFlags: string[];
}

type StudentModelExperiment = Pick<
  ExperimentDefinition<unknown, unknown, unknown>,
  "id" | "skills"
>;

/** Create a neutral StudentModel containing every skill declared by an experiment. */
export function newStudentModel(
  sessionId: string,
  experiment: StudentModelExperiment
): StudentModel {
  const skills: Record<string, SkillEstimate> = {};

  for (const skill of experiment.skills) {
    skills[skill.id] = { mastery: 0.5, evidenceCount: 0 };
  }

  return {
    sessionId,
    experimentId: experiment.id,
    skills,
    activeFlags: []
  };
}

/**
 * Fold one semantic event into a StudentModel without mutating the prior model.
 * Evidence strength is bounded to one before applying the learning rate.
 */
export function applyEvidence(
  model: StudentModel,
  event: SemanticEvent
): StudentModel {
  const skills = { ...model.skills };
  const learningRate = 0.3;

  for (const evidence of event.evidence) {
    const previous = skills[evidence.skillId] ?? {
      mastery: 0.5,
      evidenceCount: 0
    };
    const target = evidence.delta > 0 ? 1 : 0;
    const weight = Math.min(1, Math.abs(evidence.delta));
    const mastery = clamp01(
      previous.mastery + learningRate * weight * (target - previous.mastery)
    );

    skills[evidence.skillId] = {
      mastery,
      evidenceCount: previous.evidenceCount + 1,
      lastReason: evidence.reason
    };
  }

  const activeFlags = Array.from(
    new Set([...model.activeFlags, ...event.flags])
  );

  return { ...model, skills, activeFlags };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
