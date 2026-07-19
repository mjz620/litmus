import { PRODUCTION_GENERIC_CHEMISTRY_MODEL_REGISTRATIONS } from "../../chemistry-models";
import { createChemistryModelCoordinator } from "../../chemistry-models/coordinator";
import { createWorkflowEvaluator } from "../../evaluation";
import { LIQUID_MECHANICAL_ADAPTERS } from "../../mechanics";
import { safetyRegistry } from "../../registries/safety";
import type { ValidatedLabWorkflowSpecV2 } from "../../schema/v2";
import type { GenericRuntimePorts, GenericSafetyContext } from "./types";

const VERIFIED_POLICY_IDS = Object.freeze(
  safetyRegistry
    .list()
    .filter(
      ({ availability, prohibited }) =>
        availability === "verified" && !prohibited
    )
    .map(({ id }) => id)
);

/**
 * Exact production ports for capability-native generic workflows.
 * Selection is driven entirely by the validated compiled contracts; catalog
 * family metadata is deliberately absent from this assembly path.
 */
export function createCapabilityGenericRuntimePorts(
  workflow: Readonly<ValidatedLabWorkflowSpecV2>
): GenericRuntimePorts {
  const supported = new Set<string>(VERIFIED_POLICY_IDS);
  const ports: GenericRuntimePorts = {
    mechanicalAdapters: LIQUID_MECHANICAL_ADAPTERS,
    safetyPolicy: Object.freeze({
      supportedPolicyIds: VERIFIED_POLICY_IDS,
      check: ({ selectedPolicyIds }: Readonly<GenericSafetyContext>) => {
        const unsupported = selectedPolicyIds.find((id) => !supported.has(id));
        return unsupported
          ? {
              ok: false as const,
              reasonCode: "safety.policy_unavailable",
              message: `Safety policy ${unsupported} is not available.`
            }
          : { ok: true as const };
      }
    }),
    models: createChemistryModelCoordinator({
      registrations: PRODUCTION_GENERIC_CHEMISTRY_MODEL_REGISTRATIONS
    }),
    evaluator: createWorkflowEvaluator({ rules: workflow.rules })
  };
  return Object.freeze(ports);
}
