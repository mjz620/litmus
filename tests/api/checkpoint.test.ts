import { describe, expect, it } from "vitest";

import { createCheckpointHandler } from "../../src/app/api/sessions/checkpoint/route";
import {
  InMemoryCheckpointRepository,
  type CheckpointOwner
} from "../../src/lib/persistence/checkpointRepository";

const STUDENT: CheckpointOwner = {
  userId: "22222222-2222-4222-8222-222222222222"
};
const OTHER_STUDENT: CheckpointOwner = {
  userId: "33333333-3333-4333-8333-333333333333"
};

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

const signedInAs = (owner: CheckpointOwner) => async () => owner;
const signedOut = async () => null;

const post = (payload: unknown) =>
  new Request("http://localhost/api/sessions/checkpoint", {
    method: "POST",
    body: typeof payload === "string" ? payload : JSON.stringify(payload)
  });

describe("POST /api/sessions/checkpoint", () => {
  it("rejects invalid input", async () => {
    const handler = createCheckpointHandler(
      new InMemoryCheckpointRepository(),
      signedInAs(STUDENT)
    );
    const response = await handler(post("{}"));
    expect(response.status).toBe(400);
  });

  it("does not duplicate a repeated client event id", async () => {
    const repository = new InMemoryCheckpointRepository();
    const handler = createCheckpointHandler(repository, signedInAs(STUDENT));

    expect(await (await handler(post(body))).json()).toMatchObject({
      acceptedEvents: 1
    });
    expect(await (await handler(post(body))).json()).toMatchObject({
      acceptedEvents: 0
    });
    expect(repository.events.size).toBe(1);
  });

  /*
   * This route is backed by a service-role client that bypasses RLS, so these
   * two tests are the only thing standing between a guessed session UUID and
   * another student's recorded work.
   */
  it("refuses an unauthenticated write", async () => {
    const repository = new InMemoryCheckpointRepository();
    const handler = createCheckpointHandler(repository, signedOut);

    const response = await handler(post(body));

    expect(response.status).toBe(401);
    expect(repository.sessions.size).toBe(0);
    expect(repository.events.size).toBe(0);
  });

  it("refuses to overwrite a session owned by another student", async () => {
    const repository = new InMemoryCheckpointRepository();
    await createCheckpointHandler(repository, signedInAs(STUDENT))(post(body));

    const intruder = createCheckpointHandler(
      repository,
      signedInAs(OTHER_STUDENT)
    );
    const response = await intruder(
      post({ ...body, finalState: { tampered: true } })
    );

    expect(response.status).toBe(403);
    expect(
      repository.sessions.get(body.sessionId)?.userId
    ).toBe(STUDENT.userId);
    expect(repository.sessions.get(body.sessionId)?.finalState).toBeUndefined();
  });

  it("attributes a persisted session to the authenticated student", async () => {
    const repository = new InMemoryCheckpointRepository();
    await createCheckpointHandler(repository, signedInAs(STUDENT))(post(body));

    expect(repository.sessions.get(body.sessionId)?.userId).toBe(
      STUDENT.userId
    );
  });
});
