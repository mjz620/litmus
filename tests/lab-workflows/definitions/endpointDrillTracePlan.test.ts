import { describe, expect, it } from "vitest";

import { createEndpointDrillTracePlan } from "../../../src/lab-workflows/definitions/titration/endpointDrillTracePlan";
import { validateNativeEndpointDrillV2 } from "../../../src/lab-workflows/definitions/titration/native-endpoint-drill";
import {
  createGenericLabActionTrace,
  runGenericTraceSuite
} from "../../../src/lab-workflows/replay";
import { createCapabilityGenericRuntimePorts } from "../../../src/lab-workflows/runtime";

const CHECKED_AT = "2026-01-01T00:00:00.000Z";

describe("endpoint drill trace plan", () => {
  it("covers every trace suite case kind", () => {
    expect(createEndpointDrillTracePlan().map(({ kind }) => kind)).toEqual([
      "valid",
      "alternate_valid",
      "recoverable_mistake",
      "terminal_mistake",
      "tolerance_boundary"
    ]);
  });

  /*
   * The suite itself asserts each declared outcome — a completing run for the
   * valid kinds, a failed one for the terminal mistake, and a recoverable
   * violation en route for the recoverable mistake — so replaying the plan
   * through the real runtime is what proves these scenarios still describe
   * the authored rules.
   */
  it("demonstrates each declared outcome against the real runtime", () => {
    const workflow = validateNativeEndpointDrillV2(CHECKED_AT);
    for (const testCase of createEndpointDrillTracePlan()) {
      const trace = createGenericLabActionTrace({
        traceId: `trace.endpoint_drill.${testCase.kind}`,
        sessionId: `endpoint-drill-${testCase.kind}`,
        sessionSeed: `endpoint-drill-${testCase.kind}`,
        workflow,
        actions: testCase.actions
      });
      expect(() =>
        runGenericTraceSuite([{ kind: testCase.kind, trace }], () => ({
          workflow,
          ports: createCapabilityGenericRuntimePorts(workflow)
        }))
      ).not.toThrow();
    }
  });

  it("only delivers through permissions the drill actually grants", () => {
    const granted = new Set(
      validateNativeEndpointDrillV2(CHECKED_AT).permittedActions.map(
        ({ id }) => id
      )
    );
    for (const testCase of createEndpointDrillTracePlan()) {
      for (const action of testCase.actions) {
        expect(granted).toContain(action.permissionId);
      }
    }
  });
});
