import { createHash } from "node:crypto";

import { z } from "zod";

export const realtimeTokenRequestSchema = z.object({
  sessionId: z.string().uuid()
});

export interface RealtimeTokenResponse {
  value: string;
  expiresAt: number;
  model: string;
  mock: boolean;
}

const openAIClientSecretSchema = z.object({
  value: z.string().min(1),
  expires_at: z.number()
});

export async function mintRealtimeToken(
  sessionId: string
): Promise<RealtimeTokenResponse> {
  if (
    process.env.OPENAI_MOCK_MODE === "1" ||
    process.env.NODE_ENV === "test" ||
    !process.env.OPENAI_API_KEY
  ) {
    return {
      value: "mock-ephemeral-token",
      expiresAt: Math.floor(Date.now() / 1000) + 60,
      model: "gpt-realtime-whisper",
      mock: true
    };
  }

  const response = await fetch(
    "https://api.openai.com/v1/realtime/client_secrets",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": createHash("sha256")
          .update(sessionId)
          .digest("hex")
      },
      body: JSON.stringify({
        session: {
          type: "transcription",
          audio: {
            input: {
              transcription: { model: "gpt-realtime-whisper", language: "en" }
            }
          }
        }
      })
    }
  );
  if (!response.ok)
    throw new Error(`Realtime token request failed (${response.status}).`);
  const token = openAIClientSecretSchema.parse(await response.json());
  return {
    value: token.value,
    expiresAt: token.expires_at,
    model: "gpt-realtime-whisper",
    mock: false
  };
}
