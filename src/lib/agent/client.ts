import type { CoachRequest, CoachResponse } from "./schemas";

export interface CoachClient {
  request(request: CoachRequest): Promise<CoachResponse>;
}

export class NoopCoachClient implements CoachClient {
  async request(): Promise<CoachResponse> {
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
}

export class HttpCoachClient implements CoachClient {
  async request(request: CoachRequest): Promise<CoachResponse> {
    const response = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Coach request failed (${response.status}).`);
    }

    return (await response.json()) as CoachResponse;
  }
}
