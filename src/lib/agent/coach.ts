import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import {
  type CoachRequest,
  type CoachResponse,
  coachResponseSchema
} from "./schemas";

export const COACH_PROMPT_VERSION = "coach-v1";

export const COACH_SYSTEM_PROMPT = `You are LabBench's constrained high-school chemistry coach.
Use only the supplied deterministic engine state and semantic-event evidence. Never calculate pH, equivalence points, precipitate identities, heat flow, measurements, or grading ground truth. Never mutate simulation state. Do not expose hidden reasoning.
Respond with the lowest useful hint level, cite relevant event types, stay silent for routine successful work, and refuse unsafe, off-topic, or non-educational requests. Keep the tone concise, encouraging, and age-appropriate.`;

export function createMockCoachResponse(request: CoachRequest): CoachResponse {
  const question = request.studentQuestion?.toLowerCase() ?? "";
  if (isOffTopic(question)) {
    return {
      shouldRespond: true,
      interventionType: "warning",
      skillIds: [],
      hintLevel: 0,
      message:
        "I can help with this lab and its chemistry learning goals, but not that request.",
      evidenceEventTypes: [],
      safety: { refused: true, reason: "off_topic_or_unsafe" }
    };
  }

  const flagged = request.recentEvents.findLast(
    (event) => event.flags.length > 0
  );
  if (flagged) {
    const skillIds = Array.from(
      new Set(flagged.evidence.map((item) => item.skillId))
    );
    const isOvershoot = flagged.flags.includes("endpoint_overshoot");
    return {
      shouldRespond: true,
      interventionType: isOvershoot ? "question" : "hint",
      skillIds,
      hintLevel: Math.min(1, request.triggerPolicy.maxHintLevel),
      message: isOvershoot
        ? "The endpoint evidence shows the addition went past the target region. What delivery mode would give you finer control on a retry?"
        : `Review the latest ${flagged.type.replaceAll("_", " ")} evidence and choose the next procedural correction.`,
      evidenceEventTypes: [flagged.type],
      safety: { refused: false }
    };
  }

  if (request.studentQuestion) {
    return {
      shouldRespond: true,
      interventionType: "hint",
      skillIds: [],
      hintLevel: Math.min(1, request.triggerPolicy.maxHintLevel),
      message:
        "Use the observation and your procedure notes to explain what the latest lab evidence means.",
      evidenceEventTypes: request.recentEvents
        .slice(-1)
        .map(({ type }) => type),
      safety: { refused: false }
    };
  }

  return {
    shouldRespond: false,
    interventionType: "none",
    skillIds: [],
    hintLevel: 0,
    message: "",
    evidenceEventTypes: [],
    safety: { refused: false }
  };
}

export async function generateCoachResponse(
  request: CoachRequest
): Promise<CoachResponse> {
  if (shouldUseMockCoach()) return createMockCoachResponse(request);

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: process.env.OPENAI_COACH_MODEL ?? "gpt-5.4-mini",
    input: [
      { role: "system", content: COACH_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          promptVersion: COACH_PROMPT_VERSION,
          ...request
        })
      }
    ],
    text: { format: zodTextFormat(coachResponseSchema, "coach_response") }
  });

  if (!response.output_parsed) {
    throw new Error("Coach model did not return a structured response.");
  }

  return coachResponseSchema.parse(response.output_parsed);
}

function shouldUseMockCoach(): boolean {
  return (
    process.env.OPENAI_MOCK_MODE === "1" ||
    process.env.NODE_ENV === "test" ||
    !process.env.OPENAI_API_KEY
  );
}

function isOffTopic(question: string): boolean {
  return /(?:weapon|hurt someone|cheat|password|celebrity|sports score|write malware)/i.test(
    question
  );
}
