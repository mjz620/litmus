import type { ValidatedLabWorkflowSpecV2 } from "../../schema/v2";
import { validatedLabWorkflowSpecV2Schema } from "../../schema/v2";
import {
  PRODUCTION_LAB_WORKFLOW_V2_REGISTRIES,
  evaluateLabWorkflowEligibilityV2,
  WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2,
  type LabWorkflowV2RegistryContext
} from "../../validation";
import {
  GENERIC_LAB_RUNTIME_ERROR_CODES as ERROR,
  GenericLabRuntimeError
} from "./errors";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  type CompiledActionBinding,
  type CompiledEquipmentBinding,
  type CompiledGenericLabProgram,
  type CompiledMaterialBinding,
  type GenericMechanicalAdapterPort,
  type GenericRuntimePorts,
  type GenericRuntimeProvenance
} from "./types";
import { compareStrings, deepFreeze } from "./utils";

export interface GenericRuntimeCompilationOptions {
  readonly registries?: LabWorkflowV2RegistryContext;
}

export interface CompiledGenericRuntime {
  readonly program: Readonly<CompiledGenericLabProgram>;
  readonly ports: GenericRuntimePorts;
}

function runtimeError(
  code: GenericLabRuntimeError["code"],
  message: string,
  details: GenericLabRuntimeError["details"] = {}
): never {
  throw new GenericLabRuntimeError(code, message, details);
}

function assertContractRuntimeAdmission(
  input: unknown,
  registries: LabWorkflowV2RegistryContext
): ValidatedLabWorkflowSpecV2 {
  const parsed = validatedLabWorkflowSpecV2Schema.safeParse(input);
  if (!parsed.success) {
    runtimeError(
      ERROR.workflowIneligible,
      "Generic runtime requires a validated LabWorkflowSpec v2 artifact.",
      { failureCodes: ["eligibility.schema_invalid.v2"] }
    );
  }

  const eligibility = evaluateLabWorkflowEligibilityV2(parsed.data, "preview", {
    registries
  });
  const pendingPreviewOnly =
    eligibility.failureCodes.length === 1 &&
    eligibility.failureCodes[0] ===
      WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2.previewNotEligible;
  if (!eligibility.eligible && !pendingPreviewOnly) {
    runtimeError(
      ERROR.workflowIneligible,
      "Workflow failed current-hash generic runtime admission.",
      { failureCodes: eligibility.failureCodes }
    );
  }

  return parsed.data;
}

function buildAdapterMap(
  ports: GenericRuntimePorts
): ReadonlyMap<string, GenericMechanicalAdapterPort> {
  const byId = new Map<string, GenericMechanicalAdapterPort>();
  for (const adapter of ports.mechanicalAdapters) {
    if (byId.has(adapter.adapterId)) {
      runtimeError(
        ERROR.portContractMismatch,
        `Duplicate mechanical adapter port ${adapter.adapterId}.`,
        { adapterId: adapter.adapterId }
      );
    }
    byId.set(adapter.adapterId, adapter);
  }
  return byId;
}

function requireAdapter(
  adapterById: ReadonlyMap<string, GenericMechanicalAdapterPort>,
  adapterId: string,
  version: string,
  ownerId: string,
  supportedOwnerIds: readonly string[]
): GenericMechanicalAdapterPort {
  const adapter = adapterById.get(adapterId);
  if (!adapter) {
    runtimeError(
      ERROR.portUnavailable,
      `No executable mechanical port is registered for ${adapterId}.`,
      { adapterId, ownerId }
    );
  }
  if (
    adapter.adapterVersion !== version ||
    !supportedOwnerIds.includes(ownerId)
  ) {
    runtimeError(
      ERROR.portContractMismatch,
      `Mechanical port ${adapterId} does not match ${ownerId}@${version}.`,
      { adapterId, ownerId, expectedVersion: version }
    );
  }
  return adapter;
}

function compileEquipment(
  workflow: ValidatedLabWorkflowSpecV2,
  registries: LabWorkflowV2RegistryContext,
  adapterById: ReadonlyMap<string, GenericMechanicalAdapterPort>
): readonly CompiledEquipmentBinding[] {
  return workflow.equipment.map((instance) => {
    const definition = registries.components.get(
      instance.equipmentDefinitionId
    );
    const adapter = requireAdapter(
      adapterById,
      definition.mechanicalAdapterId,
      definition.version,
      definition.id,
      adapterById.get(definition.mechanicalAdapterId)
        ?.supportedEquipmentDefinitionIds ?? []
    );
    void adapter;
    return {
      instanceId: instance.instanceId,
      equipmentDefinitionId: definition.id,
      equipmentVersion: definition.version,
      configurationPresetId: instance.configurationPresetId,
      stateSchemaId: definition.stateSchemaId,
      stateFields: definition.stateSchema.fields.map((field) => ({
        key: field.key,
        valueType: field.valueType,
        nullable: field.nullable,
        allowedValues: [...(field.allowedValues ?? [])]
      })),
      capabilityIds: [...definition.capabilityIds],
      measurement: definition.measurement
        ? {
            capacityML: definition.measurement.capacityML,
            reportIncrementML: definition.measurement.reportIncrementML,
            toleranceML: definition.measurement.toleranceML
          }
        : null,
      mechanicalAdapterId: definition.mechanicalAdapterId,
      safetyPolicyIds: [...definition.safetyConstraintIds]
    };
  });
}

function compileMaterials(
  workflow: ValidatedLabWorkflowSpecV2,
  registries: LabWorkflowV2RegistryContext
): readonly CompiledMaterialBinding[] {
  return workflow.materials.map((binding) => {
    const profile = registries.materials.get(binding.materialProfileId);
    const quantity = registries.configurations.get(binding.quantityPresetId);
    if (quantity.category !== "quantity_preset") {
      runtimeError(
        ERROR.portContractMismatch,
        `Validated quantity ${binding.quantityPresetId} is not a quantity preset.`,
        { materialInstanceId: binding.instanceId }
      );
    }
    return {
      ...binding,
      materialVersion: profile.version,
      providedChemistryCapabilityIds: [
        ...profile.providedChemistryCapabilityIds
      ],
      requiredContainerCapabilityIds: [
        ...profile.compatibleContainerCapabilityIds
      ],
      quantityAmount: quantity.amount,
      quantityUnitId: quantity.unitId
    };
  });
}

function compileActions(
  workflow: ValidatedLabWorkflowSpecV2,
  registries: LabWorkflowV2RegistryContext,
  adapterById: ReadonlyMap<string, GenericMechanicalAdapterPort>
): readonly CompiledActionBinding[] {
  return workflow.permittedActions.map((permission) => {
    const action = registries.actions.get(permission.actionId);
    const parameterSchema = registries.actionParameterSchemas.get(
      action.parameterSchemaId
    );
    const preconditions = action.preconditionIds.map((id) =>
      registries.equipmentPreconditions.get(id)
    );
    const adapter = requireAdapter(
      adapterById,
      action.mechanicalAdapterId,
      action.version,
      action.id,
      adapterById.get(action.mechanicalAdapterId)?.supportedActionIds ?? []
    );
    const unsupportedPreconditions = action.preconditionIds.filter(
      (id) => !adapter.supportedPreconditionIds.includes(id)
    );
    if (unsupportedPreconditions.length > 0) {
      runtimeError(
        ERROR.portUnavailable,
        `Mechanical port ${adapter.adapterId} does not implement ${unsupportedPreconditions[0]}.`,
        {
          adapterId: adapter.adapterId,
          preconditionIds: unsupportedPreconditions
        }
      );
    }
    return {
      permission,
      actionVersion: action.version,
      requiredSourceCapabilityIds: [...action.requiredSourceCapabilityIds],
      requiredTargetCapabilityIds: [...action.requiredTargetCapabilityIds],
      parameterSchemaId: action.parameterSchemaId,
      parameters: parameterSchema.parameters.map((parameter) => ({
        ...parameter,
        allowedValues: parameter.allowedValues
          ? [...parameter.allowedValues]
          : undefined
      })),
      preconditions,
      mechanicalAdapterId: action.mechanicalAdapterId,
      emittedEventContractId: action.emittedEventContractId
    };
  });
}

function compileProvenance(
  workflow: ValidatedLabWorkflowSpecV2
): GenericRuntimeProvenance {
  return {
    workflowId: workflow.id,
    workflowRevision: workflow.revision,
    workflowHash: workflow.validation.canonicalSpecHash,
    validatorVersion: workflow.validation.validatorVersion,
    registrySnapshots: Object.entries(workflow.validation.registrySnapshotIds)
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([registryId, snapshotId]) => ({ registryId, snapshotId })),
    resolvedAdapters: workflow.validation.resolvedAdapters.map((entry) => ({
      ...entry
    })),
    resolvedChemistryModels: workflow.validation.resolvedChemistryModels.map(
      (entry) => ({
        ...entry,
        providedCapabilityIds: [...entry.providedCapabilityIds]
      })
    )
  };
}

export function compileGenericLabProgram(
  input: unknown,
  ports: GenericRuntimePorts,
  options: GenericRuntimeCompilationOptions = {}
): Readonly<CompiledGenericRuntime> {
  const registries =
    options.registries ?? PRODUCTION_LAB_WORKFLOW_V2_REGISTRIES;
  const workflow = assertContractRuntimeAdmission(input, registries);
  const adapterById = buildAdapterMap(ports);
  const equipment = compileEquipment(workflow, registries, adapterById);
  const actions = compileActions(workflow, registries, adapterById);

  const unsupportedModels = workflow.validation.resolvedChemistryModels.filter(
    ({ modelId, version }) =>
      !ports.models.supportedModels.some(
        (supported) =>
          supported.modelId === modelId && supported.modelVersion === version
      )
  );
  if (unsupportedModels.length > 0) {
    runtimeError(
      ERROR.portUnavailable,
      `No model coordinator implementation is registered for ${unsupportedModels[0]!.modelId}@${unsupportedModels[0]!.version}.`,
      { modelIds: unsupportedModels.map(({ modelId }) => modelId) }
    );
  }
  const unsupportedSafetyPolicies = workflow.safetyPolicyIds.filter(
    (policyId) => !ports.safetyPolicy.supportedPolicyIds.includes(policyId)
  );
  if (unsupportedSafetyPolicies.length > 0) {
    runtimeError(
      ERROR.portUnavailable,
      `No deterministic safety port is registered for ${unsupportedSafetyPolicies[0]}.`,
      { safetyPolicyIds: unsupportedSafetyPolicies }
    );
  }

  const program: CompiledGenericLabProgram = {
    schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
    provenance: compileProvenance(workflow),
    definitionMetadata: {
      id: workflow.id,
      title: workflow.metadata.title,
      skills: workflow.objectiveIds.map((objectiveId) => {
        const resolution = registries.skills.resolve(objectiveId);
        if (resolution.status !== "resolved") {
          runtimeError(
            ERROR.portContractMismatch,
            `Validated objective ${objectiveId} no longer resolves.`,
            { objectiveId }
          );
        }
        return {
          id: resolution.canonicalId,
          label: resolution.canonicalId,
          description: resolution.entry.description
        };
      }),
      reportRubric: workflow.rubric.criteria.map((criterion) => ({
        id: criterion.id,
        label: criterion.id,
        description: criterion.description
      }))
    },
    workflow,
    equipment,
    materials: compileMaterials(workflow, registries),
    actions,
    rules: workflow.rules.map((rule) => ({
      ...rule,
      objectiveIds: [...rule.objectiveIds]
    })),
    safetyPolicyIds: [...workflow.safetyPolicyIds]
  };

  return Object.freeze({ program: deepFreeze(program), ports });
}
