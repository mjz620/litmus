import { describe, expect, it } from "vitest";

import { createCheckpointHandler } from "../../src/app/api/sessions/checkpoint/route";
import { InMemoryCheckpointRepository } from "../../src/lib/persistence/checkpointRepository";

const body = {
  schemaVersion: "1",
  sessionId: "11111111-1111-4111-8111-111111111111",
  experimentId: "acid_base_titration",
  experimentVersion: "1.0.0",
  mode: "practice",
  events: [
    {
      clientEventId: "event-1",
      seq: 0,
      payload: {
        type: "rinse_burette",
        tSim: 0,
        observation: { solvent: "titrant" },
        flags: [],
        evidence: []
      }
    }
  ]
};

describe("POST /api/sessions/checkpoint", () => {
  it("rejects invalid input", async () => {
    const handler = createCheckpointHandler(new InMemoryCheckpointRepository());
    const response = await handler(
      new Request("http://localhost/api/sessions/checkpoint", {
        method: "POST",
        body: "{}"
      })
    );
    expect(response.status).toBe(400);
  });

  it("does not duplicate a repeated client event id", async () => {
    const repository = new InMemoryCheckpointRepository();
    const handler = createCheckpointHandler(repository);
    const request = () =>
      new Request("http://localhost/api/sessions/checkpoint", {
        method: "POST",
        body: JSON.stringify(body)
      });

    expect(await (await handler(request())).json()).toMatchObject({
      acceptedEvents: 1
    });
    expect(await (await handler(request())).json()).toMatchObject({
      acceptedEvents: 0
    });
    expect(repository.events.size).toBe(1);
  });
});
