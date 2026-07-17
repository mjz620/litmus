export interface AnalyticsStudent {
  id: string;
  name: string;
}

export interface AnalyticsSession {
  id: string;
  studentId: string;
  experimentId: string;
  experimentVersion: string;
  workflowVersionId?: string;
  parentSessionId?: string;
  completedAt?: string;
}

export interface AnalyticsSkillEstimate {
  sessionId: string;
  studentId: string;
  skillId: string;
  mastery: number;
  evidenceCount: number;
  updatedAt: string;
}

export interface AnalyticsEvent {
  sessionId: string;
  type: string;
  flags: string[];
  tSim: number;
}

export interface ClassAnalyticsInput {
  students: AnalyticsStudent[];
  sessions: AnalyticsSession[];
  skillEstimates: AnalyticsSkillEstimate[];
  events: AnalyticsEvent[];
  readinessWeights: Readonly<Record<string, number>>;
}

export interface StudentAnalytics {
  studentId: string;
  name: string;
  readiness: number;
  completedSessions: number;
  retrySessions: number;
  evidenceCount: number;
  needsAttention: boolean;
  skills: Record<string, number>;
  misconceptions: Record<string, number>;
}

export interface ClassAnalytics {
  studentCount: number;
  completedSessions: number;
  completionRate: number;
  averageReadiness: number;
  needsAttentionCount: number;
  skillAverages: Record<string, number>;
  misconceptions: Array<{ flag: string; count: number }>;
  students: StudentAnalytics[];
}

/** Deterministic aggregates only; no generated text or model-derived numbers. */
export function computeClassAnalytics(
  input: ClassAnalyticsInput
): ClassAnalytics {
  const sessionById = new Map(
    input.sessions.map((session) => [session.id, session])
  );
  const students = input.students.map((student) => {
    const sessions = input.sessions.filter(
      (session) => session.studentId === student.id
    );
    const latestSkills = latestSkillMap(
      input.skillEstimates.filter((skill) => skill.studentId === student.id)
    );
    const skills = Object.fromEntries(
      Object.entries(latestSkills).map(([skillId, estimate]) => [
        skillId,
        estimate.mastery
      ])
    );
    const readiness = weightedReadiness(skills, input.readinessWeights);
    const sessionIds = new Set(sessions.map(({ id }) => id));
    const misconceptions = countFlags(
      input.events.filter((event) => sessionIds.has(event.sessionId))
    );
    const repeatedMisconception = Object.values(misconceptions).some(
      (count) => count >= 2
    );

    return {
      studentId: student.id,
      name: student.name,
      readiness,
      completedSessions: sessions.filter(({ completedAt }) => completedAt)
        .length,
      retrySessions: sessions.filter(({ parentSessionId }) => parentSessionId)
        .length,
      evidenceCount: Object.values(latestSkills).reduce(
        (sum, skill) => sum + skill.evidenceCount,
        0
      ),
      needsAttention: readiness < 0.6 || repeatedMisconception,
      skills,
      misconceptions
    };
  });

  const completedSessions = input.sessions.filter(
    ({ completedAt }) => completedAt
  ).length;
  const skillAverages: Record<string, number> = {};
  for (const skillId of Object.keys(input.readinessWeights)) {
    const values = students
      .map(({ skills }) => skills[skillId])
      .filter((value): value is number => value !== undefined);
    skillAverages[skillId] = values.length ? average(values) : 0;
  }

  // Ignore orphan event rows defensively; database FKs should normally prevent them.
  const misconceptions = Object.entries(
    countFlags(input.events.filter((event) => sessionById.has(event.sessionId)))
  )
    .map(([flag, count]) => ({ flag, count }))
    .sort(
      (left, right) =>
        right.count - left.count || left.flag.localeCompare(right.flag)
    );

  return {
    studentCount: students.length,
    completedSessions,
    completionRate: input.sessions.length
      ? completedSessions / input.sessions.length
      : 0,
    averageReadiness: students.length
      ? average(students.map(({ readiness }) => readiness))
      : 0,
    needsAttentionCount: students.filter(({ needsAttention }) => needsAttention)
      .length,
    skillAverages,
    misconceptions,
    students
  };
}

function latestSkillMap(
  skills: AnalyticsSkillEstimate[]
): Record<string, AnalyticsSkillEstimate> {
  const latest: Record<string, AnalyticsSkillEstimate> = {};
  for (const skill of skills) {
    const previous = latest[skill.skillId];
    if (!previous || skill.updatedAt > previous.updatedAt)
      latest[skill.skillId] = skill;
  }
  return latest;
}

function weightedReadiness(
  skills: Record<string, number>,
  weights: Readonly<Record<string, number>>
): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const [skillId, weight] of Object.entries(weights)) {
    weighted += (skills[skillId] ?? 0.5) * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? weighted / totalWeight : 0;
}

function countFlags(events: AnalyticsEvent[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    for (const flag of new Set(event.flags))
      counts[flag] = (counts[flag] ?? 0) + 1;
  }
  return counts;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
