import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import {
  type CoachRequest,
  type CoachResponse,
  coachResponseSchema
} from "./schemas";

export const COACH_PROMPT_VERSION = "coach-v1";
export const COACH_LIVE_RESPONSE_TIMEOUT_MS = 12_000;
const COACH_OPENAI_REQUEST_TIMEOUT_MS = 11_000;

export const COACH_SYSTEM_PROMPT = `You are Litmus's constrained high-school chemistry coach.
Use only the supplied deterministic engine state and semantic-event evidence. Never calculate pH, equivalence points, precipitate identities, heat flow, measurements, or grading ground truth. Never mutate simulation state. Do not expose hidden reasoning.
Respond with the lowest useful hint level, cite relevant event types, stay silent for routine successful work, and refuse unsafe, off-topic, or non-educational requests. Keep the tone concise, encouraging, and age-appropriate.`;

export interface CoachModel {
  readonly model: string;
  respond(request: Readonly<CoachRequest>): Promise<unknown>;
}

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
  request: CoachRequest,
  options: { readonly model?: CoachModel } = {}
): Promise<CoachResponse> {
  if (!options.model && shouldUseMockCoach())
    return createMockCoachResponse(request);

  const model = options.model ?? createOpenAiCoachModel();
  try {
    return coachResponseSchema.parse(
      await respondWithinTimeout(model, request)
    );
  } catch {
    // The Coach is advisory and must never make a student-facing lab unusable.
    // Its local bounded response is valid for the same request and preserves the
    // existing safety/off-topic and evidence contracts.
    return createMockCoachResponse(request);
  }
}

function createOpenAiCoachModel(): CoachModel {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    // A small retry budget protects against transient network/5xx failures
    // without exceeding the route's 15-second deadline.
    maxRetries: 1,
    timeout: COACH_OPENAI_REQUEST_TIMEOUT_MS
  });
  const model = process.env.OPENAI_COACH_MODEL ?? "gpt-5.4-mini";
  return {
    model,
    async respond(request) {
      const response = await client.responses.parse(
        {
          model,
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
          text: {
            format: zodTextFormat(coachResponseSchema, "coach_response")
          }
        },
        { signal: AbortSignal.timeout(COACH_OPENAI_REQUEST_TIMEOUT_MS) }
      );
      if (!response.output_parsed) {
        throw new Error("Coach model did not return a structured response.");
      }
      return response.output_parsed;
    }
  };
}

async function respondWithinTimeout(
  model: CoachModel,
  request: Readonly<CoachRequest>
): Promise<unknown> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      model.respond(request),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Coach response timed out.")),
          COACH_LIVE_RESPONSE_TIMEOUT_MS
        );
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
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
