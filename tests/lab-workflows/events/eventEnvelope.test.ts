import { describe, expect, it, vi } from "vitest";

import {
  applyEvidence,
  newStudentModel,
  type SemanticEvent
} from "../../../src/experiments/shared";
import { decideCoachTrigger } from "../../../src/lib/agent/triggerPolicy";
import { checkpointRequestSchema } from "../../../src/lib/persistence/contracts";
import {
  applyEnvelopeEvidence,
  envelopeSemanticEvents,
  linkEnvelopeDiagnoses,
  semanticEventEnvelopeV2Schema,
  toCheckpointCompatibleEvent,
  toLegacyCoachEvents,
  toLegacySemanticEvent
} from "../../../src/lab-workflows/events";
import {
  assembleGenericLabRuntime
} from "../../../src/lab-workflows/runtime/generic";
import {
  GENERIC_TEST_CONFIG,
  READ_VOLUME_ACTION,
  createTestGenericPorts,
  validatedMechanicalWorkflow
} from "../runtime/generic/fixtures";

const SESSION_ID = "00000000-0000-4000-8000-000000000001";
const EVENT: SemanticEvent = {
  type: "read_meniscus",
  tSim: 1,
  observation: { reportedML: 12.35 },
  flags: [],
  evidence: [
    { skillId: "meniscus_reading", delta: 1, reason: "meniscus_read_ok" }
  ]
};

function envelopes() {
  return envelopeSemanticEvents({
    sessionId: SESSION_ID,
    nextEventSequence: 0,
    actionSequence: 1,
    action: READ_VOLUME_ACTION,
    materialAction: null,
    events: [EVENT, { ...EVENT, tSim: 2 }]
  });
}

describe("semantic event envelope v2", () => {
  it("assigns deterministic session-scoped monotonic IDs and strict action references", () => {
    const first = envelopes();
    const second = envelopes();
    expect(first).toEqual(second);
    expect(first.map(({ eventId, sequence }) => ({ eventId, sequence }))).toEqual([
      { eventId: `${SESSION_ID}:event:0`, sequence: 0 },
      { eventId: `${SESSION_ID}:event:1`, sequence: 1 }
    ]);
    expect(first[0]).toMatchObject({
      actionSequence: 1,
      normalizedAction: READ_VOLUME_ACTION,
      sourceEquipmentInstanceId: "measurement_burette",
      targetEquipmentInstanceIds: [],
      materialInstanceIds: [],
      ruleEvidenceIds: [],
      payload: EVENT
    });
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first[0]?.payload)).toBe(true);
    expect(
      semanticEventEnvelopeV2Schema.parse(
        JSON.parse(JSON.stringify(first[0]))
      )
    ).toEqual(first[0]);
  });

  it("links only diagnoses that cite the exact event and rejects duplicate references", () => {
    const linked = linkEnvelopeDiagnoses(envelopes(), [
      {
        ruleId: "rule.read",
        status: "satisfied",
        severity: "procedural",
        recoverable: true,
        objectiveIds: ["meniscus_reading"],
        evidenceEventIds: [`${SESSION_ID}:event:0`]
      }
    ]);
    expect(linked.map(({ ruleEvidenceIds }) => ruleEvidenceIds)).toEqual([
      ["rule.read"],
      []
    ]);
    expect(() =>
      semanticEventEnvelopeV2Schema.parse({
        ...linked[0],
        ruleEvidenceIds: ["rule.read", "rule.read"]
      })
    ).toThrow();
  });

  it("preserves legacy StudentModel, coach, and checkpoint behavior exactly", () => {
    const envelope = envelopes()[0]!;
    const experiment = {
      id: "test",
      skills: [
        { id: "meniscus_reading", label: "Read", description: "Read" }
      ]
    };
    const model = newStudentModel(SESSION_ID, experiment);
    expect(applyEnvelopeEvidence(model, envelope)).toEqual(
      applyEvidence(model, EVENT)
    );
    expect(toLegacySemanticEvent(envelope)).toEqual(EVENT);
    expect(
      decideCoachTrigger({ recentEvents: toLegacyCoachEvents([envelope]) })
    ).toEqual(decideCoachTrigger({ recentEvents: [EVENT] }));
    expect(
      checkpointRequestSchema.parse({
        schemaVersion: "1",
        sessionId: SESSION_ID,
        experimentId: "generic-test",
        experimentVersion: "1.0.0",
        mode: "preview",
        events: [toCheckpointCompatibleEvent(envelope)]
      }).events?.[0]
    ).toEqual(toCheckpointCompatibleEvent(envelope));
  });

  it("contains no state snapshots or environmental nondeterminism", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const now = vi.spyOn(Date, "now");
    const random = vi.spyOn(Math, "random");
    const envelope = envelopes()[0]!;
    const serialized = JSON.stringify(envelope);
    for (const forbidden of [
      '"state"',
      '"previousState"',
      '"nextState"',
      '"chemistry"',
      '"materialLedger"',
      '"groundTruth"'
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(serialized.length).toBeLessThan(8_000);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
  });

  it("integrates multiple payloads atomically while preserving legacy StepResult events", () => {
    const workflow = validatedMechanicalWorkflow();
    const ports = createTestGenericPorts();
    const adapter = ports.mechanicalAdapters[0];
    vi.spyOn(adapter, "apply").mockImplementation((context) => {
      return {
        equipment: context.equipment,
        materialAction: null,
        events: [EVENT, { ...EVENT, tSim: 2 }]
      };
    });
    const runtime = assembleGenericLabRuntime(
      workflow,
      { ...GENERIC_TEST_CONFIG, sessionId: "envelope-integration" },
      ports
    );
    const transition = runtime.dispatch(READ_VOLUME_ACTION);

    expect(transition.events).toHaveLength(2);
    expect(transition.eventEnvelopes.map(({ eventId }) => eventId)).toEqual([
      "envelope-integration:event:0",
      "envelope-integration:event:1"
    ]);
    expect(transition.eventEnvelopes.map(({ payload }) => payload)).toEqual(
      transition.events
    );
    expect(transition.state.eventSequence).toBe(2);
    expect(transition.state.eventEnvelopes).toHaveLength(2);
  });

  it("does not consume an event sequence when an action is rejected", () => {
    const ports = createTestGenericPorts();
    const runtime = assembleGenericLabRuntime(
      validatedMechanicalWorkflow(),
      { ...GENERIC_TEST_CONFIG, sessionId: "envelope-failed-action" },
      ports
    );
    const initial = runtime.getState();
    expect(() =>
      runtime.dispatch({ ...READ_VOLUME_ACTION, permissionId: "permission.invalid" })
    ).toThrow();
    expect(runtime.getState()).toBe(initial);
    expect(runtime.getState().eventSequence).toBe(0);

    const accepted = runtime.dispatch(READ_VOLUME_ACTION);
    expect(accepted.eventEnvelopes[0]?.eventId).toBe(
      "envelope-failed-action:event:0"
    );
  });
});
