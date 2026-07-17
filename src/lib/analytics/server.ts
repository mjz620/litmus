import { z } from "zod";

import { hasPublicSupabaseEnvironment } from "../env";
import { createServerSupabaseClient } from "../supabase/server";
import type { ClassAnalyticsInput } from "./classAnalytics";
import { DEMO_CLASS_ID, demoAnalyticsFixture } from "./demoFixture";

const memberSchema = z.object({ student_id: z.string().uuid() });
const profileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable()
});
const sessionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  experiment_id: z.string(),
  experiment_version: z.string(),
  workflow_version_id: z.string().nullable(),
  parent_session_id: z.string().uuid().nullable(),
  completed_at: z.string().nullable()
});
const skillSchema = z.object({
  session_id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  skill_id: z.string(),
  mastery: z.coerce.number(),
  evidence_count: z.number(),
  updated_at: z.string()
});
const eventSchema = z.object({
  session_id: z.string().uuid(),
  payload: z
    .object({
      type: z.string(),
      tSim: z.number(),
      flags: z.array(z.string())
    })
    .passthrough()
});

export async function loadClassAnalyticsInput(
  classId: string
): Promise<ClassAnalyticsInput> {
  if (classId === DEMO_CLASS_ID || !hasPublicSupabaseEnvironment()) {
    return demoAnalyticsFixture;
  }

  const client = await createServerSupabaseClient();
  const [{ data: memberData }, { data: sessionData }] = await Promise.all([
    client.from("class_members").select("student_id").eq("class_id", classId),
    client
      .from("sessions")
      .select(
        "id,user_id,experiment_id,experiment_version,workflow_version_id,parent_session_id,completed_at"
      )
      .eq("class_id", classId)
  ]);
  const members = z.array(memberSchema).parse(memberData ?? []);
  const sessions = z.array(sessionSchema).parse(sessionData ?? []);
  const studentIds = members.map(({ student_id }) => student_id);
  const sessionIds = sessions.map(({ id }) => id);

  const [{ data: profileData }, { data: skillData }, { data: eventData }] =
    await Promise.all([
      studentIds.length
        ? client.from("profiles").select("id,name").in("id", studentIds)
        : Promise.resolve({ data: [] }),
      sessionIds.length
        ? client
            .from("skill_estimates")
            .select(
              "session_id,user_id,skill_id,mastery,evidence_count,updated_at"
            )
            .in("session_id", sessionIds)
        : Promise.resolve({ data: [] }),
      sessionIds.length
        ? client
            .from("events")
            .select("session_id,payload")
            .in("session_id", sessionIds)
            .order("seq")
        : Promise.resolve({ data: [] })
    ]);
  const profiles = z.array(profileSchema).parse(profileData ?? []);
  const skills = z.array(skillSchema).parse(skillData ?? []);
  const events = z.array(eventSchema).parse(eventData ?? []);

  return {
    students: profiles.map((profile) => ({
      id: profile.id,
      name: profile.name ?? "Student"
    })),
    sessions: sessions.flatMap((session) =>
      session.user_id
        ? [
            {
              id: session.id,
              studentId: session.user_id,
              experimentId: session.experiment_id,
              experimentVersion: session.experiment_version,
              workflowVersionId: session.workflow_version_id ?? undefined,
              parentSessionId: session.parent_session_id ?? undefined,
              completedAt: session.completed_at ?? undefined
            }
          ]
        : []
    ),
    skillEstimates: skills.flatMap((skill) =>
      skill.user_id
        ? [
            {
              sessionId: skill.session_id,
              studentId: skill.user_id,
              skillId: skill.skill_id,
              mastery: skill.mastery,
              evidenceCount: skill.evidence_count,
              updatedAt: skill.updated_at
            }
          ]
        : []
    ),
    events: events.map((event) => ({
      sessionId: event.session_id,
      type: event.payload.type,
      flags: event.payload.flags,
      tSim: event.payload.tSim
    })),
    readinessWeights: demoAnalyticsFixture.readinessWeights
  };
}
