import { zodResponsesFunction } from "openai/helpers/zod";
import { z } from "zod";

import { capabilityRegistry } from "../../../lab-workflows/capabilities";
import {
  applyLabDraftTransaction,
  type LabDraftCommand
} from "../../../lab-workflows/authoring";
import { hashLabWorkflowSpec } from "../../../lab-workflows/hash";
import {
  actionEventContractRegistry,
  actionParameterSchemaRegistry,
  actionRegistry,
  equipmentPreconditionRegistry,
  labActionErrorContractRegistry
} from "../../../lab-workflows/registries/actions";
import { chemistryModelRegistry } from "../../../lab-workflows/registries/chemistry-models";
import { componentRegistry } from "../../../lab-workflows/registries/components";
import { configurationRegistry } from "../../../lab-workflows/registries/configurations";
import {
  eventFlagRegistry,
  eventTypeRegistry
} from "../../../lab-workflows/registries/event-flags";
import { materialRegistry } from "../../../lab-workflows/registries/reagents";
import { safetyRegistry } from "../../../lab-workflows/registries/safety";
import { skillRegistry } from "../../../lab-workflows/registries/skills";
import {
  labWorkflowDraftV2Schema,
  type LabWorkflowDraftV2
} from "../../../lab-workflows/schema/v2";
import { WORKFLOW_CONDITION_KINDS } from "../../../lab-workflows/schema/conditions";
import {
  applyDraftCommandsArgumentsSchema,
  CAPABILITY_AUTHOR_TOOL_LIMITS,
  capabilityAuthorToolNameSchema,
  inspectActionsArgumentsSchema,
  inspectCapabilitiesArgumentsSchema,
  inspectConditionsArgumentsSchema,
  inspectConfigurationsArgumentsSchema,
  inspectDraftArgumentsSchema,
  inspectEquipmentArgumentsSchema,
  inspectMaterialsArgumentsSchema,
  inspectModelsArgumentsSchema,
  inspectSafetyArgumentsSchema,
  searchObjectivesArgumentsSchema,
  type CapabilityAuthorToolName
} from "./capabilitySchemas";

export const CAPABILITY_AUTHOR_TOOL_ERROR_CODES = Object.freeze({
  unknownTool: "authoring.tool_unknown.v2",
  invalidArguments: "authoring.tool_arguments_invalid.v2",
  callLimit: "authoring.tool_limit.v2",
  invalidInitialDraft: "authoring.initial_draft_invalid.v2",
  referenceNotExposed: "authoring.reference_not_exposed.v2"
} as const);

export type CapabilityAuthorToolErrorCode =
  (typeof CAPABILITY_AUTHOR_TOOL_ERROR_CODES)[keyof typeof CAPABILITY_AUTHOR_TOOL_ERROR_CODES];

export class CapabilityAuthorToolError extends Error {
  constructor(
    readonly code: CapabilityAuthorToolErrorCode,
    message: string,
    readonly fieldPaths: readonly string[] = []
  ) {
    super(message);
    this.name = "CapabilityAuthorToolError";
  }
}

type WorkflowConditionKind = (typeof WORKFLOW_CONDITION_KINDS)[number];

type JsonSchemaNode = {
  [key: string]: unknown;
  readonly type?: unknown;
  readonly properties?: Readonly<Record<string, JsonSchemaNode>>;
  readonly required?: readonly string[];
  readonly items?: JsonSchemaNode;
  readonly anyOf?: readonly JsonSchemaNode[];
  readonly oneOf?: readonly JsonSchemaNode[];
  readonly allOf?: readonly JsonSchemaNode[];
  readonly $defs?: Readonly<Record<string, JsonSchemaNode>>;
  readonly definitions?: Readonly<Record<string, JsonSchemaNode>>;
  readonly propertyNames?: JsonSchemaNode;
};

function nullableSchema(schema: JsonSchemaNode): JsonSchemaNode {
  if (schema.type === "null") return schema;
  if (schema.anyOf?.some((candidate) => candidate.type === "null")) {
    return schema;
  }
  return { anyOf: [schema, { type: "null" }] };
}

/**
 * OpenAI strict tools require every object property to be present. The shared
 * command schema correctly uses optional application fields, so only the model
 * tool JSON schema represents those fields as required nullable values. The
 * server removes nulls from the known optional command fields before parsing
 * the canonical command schema.
 */
function makeOpenAiStrictSchema(node: JsonSchemaNode): JsonSchemaNode {
  const result: Record<string, unknown> = { ...node };
  delete result.propertyNames;
  if (node.properties) {
    const originallyRequired = new Set(node.required ?? []);
    const properties: Record<string, JsonSchemaNode> = {};
    for (const [key, child] of Object.entries(node.properties)) {
      const strictChild = makeOpenAiStrictSchema(child);
      properties[key] = originallyRequired.has(key)
        ? strictChild
        : nullableSchema(strictChild);
    }
    result.properties = properties;
    result.required = Object.keys(properties);
    result.additionalProperties = false;
  }
  if (node.items) result.items = makeOpenAiStrictSchema(node.items);
  const anyOfMembers = [...(node.anyOf ?? []), ...(node.oneOf ?? [])];
  if (anyOfMembers.length > 0) {
    result.anyOf = anyOfMembers.map((member) => makeOpenAiStrictSchema(member));
  }
  delete result.oneOf;
  if (node.allOf) {
    result.allOf = node.allOf.map((member) => makeOpenAiStrictSchema(member));
  }
  if (node.$defs) {
    result.$defs = Object.fromEntries(
      Object.entries(node.$defs).map(([key, value]) => [
        key,
        makeOpenAiStrictSchema(value)
      ])
    );
  }
  if (node.definitions) {
    result.definitions = Object.fromEntries(
      Object.entries(node.definitions).map(([key, value]) => [
        key,
        makeOpenAiStrictSchema(value)
      ])
    );
  }
  return result;
}

const capabilityApplyDraftCommandsTool = Object.freeze({
  type: "function" as const,
  name: "applyDraftCommands",
  description:
    "Apply strict shared LabDraftCommand values atomically to the current server-owned draft. One successful call increments revision once and invalidates prior validation and Judge artifacts.",
  parameters: makeOpenAiStrictSchema(
    z.toJSONSchema(applyDraftCommandsArgumentsSchema) as JsonSchemaNode
  ),
  strict: true as const
});

export const CAPABILITY_AUTHOR_TOOLS = Object.freeze([
  zodResponsesFunction({
    name: "searchObjectives",
    description:
      "Search exact learning objectives. Returns canonical IDs and verified availability; aliases are never returned as authored IDs.",
    parameters: searchObjectivesArgumentsSchema
  }),
  zodResponsesFunction({
    name: "inspectEquipment",
    description:
      "Inspect exact reusable equipment definitions, capabilities, configurations, adapters, actions, safety constraints, and performance availability.",
    parameters: inspectEquipmentArgumentsSchema
  }),
  zodResponsesFunction({
    name: "inspectMaterials",
    description:
      "Inspect exact registered material identities, compatible container capabilities, quantities, bounded initialization support, and safety policies.",
    parameters: inspectMaterialsArgumentsSchema
  }),
  zodResponsesFunction({
    name: "inspectActions",
    description:
      "Inspect exact typed action contracts, source and target constraints, parameters, preconditions, errors, adapters, and event contracts.",
    parameters: inspectActionsArgumentsSchema
  }),
  zodResponsesFunction({
    name: "inspectCapabilities",
    description:
      "Inspect exact equipment or chemistry capability metadata and verified availability.",
    parameters: inspectCapabilitiesArgumentsSchema
  }),
  zodResponsesFunction({
    name: "inspectConditions",
    description:
      "Inspect the closed workflow-condition vocabulary and the exact event, observable, unit, and submission references available to those conditions.",
    parameters: inspectConditionsArgumentsSchema
  }),
  zodResponsesFunction({
    name: "inspectModels",
    description:
      "Inspect deterministic chemistry-model metadata, required capabilities, compatibility scope, and availability. Implementations are never exposed.",
    parameters: inspectModelsArgumentsSchema
  }),
  zodResponsesFunction({
    name: "inspectSafety",
    description:
      "Inspect exact verified or restricted safety policies and teacher-facing constraints.",
    parameters: inspectSafetyArgumentsSchema
  }),
  zodResponsesFunction({
    name: "inspectConfigurations",
    description:
      "Inspect exact code-owned configurations, placements, units, observables, schemas, and quantity presets.",
    parameters: inspectConfigurationsArgumentsSchema
  }),
  zodResponsesFunction({
    name: "inspectDraft",
    description:
      "Inspect a bounded summary of the current server-owned draft and its revision. The draft body and validation artifacts are not writable through this tool.",
    parameters: inspectDraftArgumentsSchema
  }),
  capabilityApplyDraftCommandsTool
]);

export const CAPABILITY_AUTHOR_TOOL_ALLOW_LIST = Object.freeze(
  CAPABILITY_AUTHOR_TOOLS.map(({ name }) =>
    capabilityAuthorToolNameSchema.parse(name)
  )
);

export const CAPABILITY_AUTHOR_REGISTRY_SNAPSHOT_IDS = Object.freeze({
  actions: actionRegistry.snapshotId,
  capabilities: capabilityRegistry.snapshotId,
  chemistryModels: chemistryModelRegistry.snapshotId,
  components: componentRegistry.snapshotId,
  configurations: configurationRegistry.snapshotId,
  eventFlags: eventFlagRegistry.snapshotId,
  eventTypes: eventTypeRegistry.snapshotId,
  materials: materialRegistry.snapshotId,
  safety: safetyRegistry.snapshotId,
  skills: skillRegistry.snapshotId
});

export interface CapabilityAuthorToolAuditEntry {
  readonly sequence: number;
  readonly name: string;
  readonly status: "ok" | "error";
  readonly revisionBefore: number;
  readonly revisionAfter: number;
  readonly errorCode: string | null;
}

export interface CapabilityAuthorToolSession {
  execute(name: string, args: unknown): unknown;
  getDraft(): Readonly<LabWorkflowDraftV2>;
  getAuditTrail(): readonly CapabilityAuthorToolAuditEntry[];
  getExposedRegistryIds(): readonly string[];
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function bounded<T>(entries: readonly T[]): {
  readonly entries: readonly T[];
  readonly totalMatches: number;
  readonly truncated: boolean;
} {
  const maximum = CAPABILITY_AUTHOR_TOOL_LIMITS.maxReturnedItems;
  return {
    entries: entries.slice(0, maximum),
    totalMatches: entries.length,
    truncated: entries.length > maximum
  };
}

function exactSelection<T extends { readonly id: string }>(
  entries: readonly T[],
  ids: readonly string[]
): { readonly matches: readonly T[]; readonly unknownIds: readonly string[] } {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  if (ids.length === 0) {
    return {
      matches: [...entries].sort((a, b) => compare(a.id, b.id)),
      unknownIds: []
    };
  }
  const uniqueIds = [...new Set(ids)];
  return {
    matches: uniqueIds.flatMap((id) => {
      const entry = byId.get(id);
      return entry ? [entry] : [];
    }),
    unknownIds: uniqueIds.filter((id) => !byId.has(id)).sort(compare)
  };
}

function parseArguments<T>(
  name: CapabilityAuthorToolName,
  schema: {
    safeParse(input: unknown): { success: true; data: T } | { success: false };
  },
  input: unknown
): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new CapabilityAuthorToolError(
      CAPABILITY_AUTHOR_TOOL_ERROR_CODES.invalidArguments,
      `Invalid arguments for ${name}.`,
      [`tools.${name}`]
    );
  }
  return parsed.data;
}

function equipmentAvailability(
  entry: ReturnType<typeof componentRegistry.list>[number]
) {
  const statuses = [
    entry.stateSchemaAvailability,
    entry.defaultConfigurationPresetAvailability,
    entry.visualAdapterDefinitionAvailability,
    entry.mechanicalAdapterAvailability
  ];
  if (
    entry.performanceTier === "restricted" ||
    statuses.includes("restricted")
  ) {
    return "restricted" as const;
  }
  return statuses.every((status) => status === "verified")
    ? ("verified" as const)
    : ("declared" as const);
}

const CONDITION_SUMMARIES: Readonly<
  Record<
    WorkflowConditionKind,
    { readonly purpose: string; readonly referenceKinds: readonly string[] }
  >
> = Object.freeze({
  equipment_state_equals: {
    purpose:
      "Require one registered equipment state field to equal a bounded typed value.",
    referenceKinds: ["equipment_instance", "state_field"]
  },
  equipment_capability_present: {
    purpose:
      "Require selected equipment to provide an exact registered capability.",
    referenceKinds: ["equipment_instance", "equipment_capability"]
  },
  material_bound_to_container: {
    purpose:
      "Require an exact material instance to be bound to an exact container instance.",
    referenceKinds: ["material_instance", "equipment_instance"]
  },
  action_observed: {
    purpose:
      "Require a typed action with exact source and target bindings to have occurred.",
    referenceKinds: ["action", "equipment_instance"]
  },
  action_count_within_range: {
    purpose:
      "Require a typed action count to remain inside bounded integer limits.",
    referenceKinds: ["action", "equipment_instance"]
  },
  semantic_event_observed: {
    purpose:
      "Require an exact semantic event emitted by deterministic runtime code.",
    referenceKinds: ["semantic_event"]
  },
  observation_recorded: {
    purpose:
      "Require a registered observation key, optionally scoped to an event and expected source.",
    referenceKinds: ["observation", "semantic_event", "configuration"]
  },
  registered_completion_policy_satisfied: {
    purpose:
      "Use one closed compatibility completion policy with exact evidence rules.",
    referenceKinds: ["completion_policy", "workflow_rule"]
  },
  observable_within_tolerance: {
    purpose:
      "Compare a deterministic registered observable with explicit inclusive or exclusive bounds.",
    referenceKinds: ["observable", "unit"]
  },
  event_flag: {
    purpose: "Require a registered semantic flag to be present or absent.",
    referenceKinds: ["event_flag", "semantic_event"]
  },
  rule_satisfied_before: {
    purpose:
      "Create a directed ordering dependency between two non-ordering rules.",
    referenceKinds: ["workflow_rule"]
  },
  forbidden_state_never_reached: {
    purpose:
      "Require a registered equipment state never to equal a bounded forbidden value.",
    referenceKinds: ["equipment_instance", "state_field"]
  },
  student_response_submitted: {
    purpose: "Require a response for an exact registered submission field.",
    referenceKinds: ["submission_field"]
  }
});

function inspectObjectives(args: unknown) {
  const parsed = parseArguments(
    "searchObjectives",
    searchObjectivesArgumentsSchema,
    args
  );
  const queryTokens = parsed.query
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const matches = skillRegistry
    .list()
    .filter((entry) => {
      const searchable = [
        entry.id,
        entry.description,
        ...entry.aliases,
        ...entry.examplePrompts
      ]
        .join(" ")
        .toLocaleLowerCase();
      return (
        (parsed.availability === null ||
          entry.availability === parsed.availability) &&
        queryTokens.every((token) => searchable.includes(token))
      );
    })
    .sort((a, b) => compare(a.id, b.id))
    .map((entry) => ({
      id: entry.id,
      availability: entry.availability,
      description: entry.description,
      aliases: entry.aliases,
      requiredEquipmentIds: entry.requiredComponentIds,
      recommendedEquipmentIds: entry.recommendedComponentIds,
      relevantEventFlagIds: entry.relevantEventFlagIds,
      positiveEvidenceReasonIds: entry.positiveEvidenceReasonIds,
      assessmentModeIds: entry.assessmentModeIds
    }));
  return {
    query: parsed.query,
    ...bounded(matches),
    registrySnapshotId: skillRegistry.snapshotId
  };
}

function inspectEquipment(args: unknown) {
  const parsed = parseArguments(
    "inspectEquipment",
    inspectEquipmentArgumentsSchema,
    args
  );
  const selected = exactSelection(componentRegistry.list(), parsed.ids);
  return {
    ...bounded(
      selected.matches.map((entry) => ({
        id: entry.id,
        version: entry.version,
        displayName: entry.displayName,
        purpose: entry.purpose,
        availability: equipmentAvailability(entry),
        capabilityIds: entry.capabilityIds,
        supportedActionIds: entry.allowedActionIds,
        configurationPresetId: entry.defaultConfigurationPresetId,
        stateSchemaId: entry.stateSchemaId,
        stateFields: entry.stateSchema.fields.map(
          ({ key, valueType, nullable, allowedValues, description }) => ({
            key,
            valueType,
            nullable,
            allowedValues: allowedValues ?? [],
            description
          })
        ),
        visualAdapterId: entry.visualAdapterDefinitionId,
        mechanicalAdapterId: entry.mechanicalAdapterId,
        performanceTier: entry.performanceTier,
        safetyPolicyIds: entry.safetyConstraintIds,
        measurement: entry.measurement
      }))
    ),
    unknownIds: selected.unknownIds,
    registrySnapshotId: componentRegistry.snapshotId
  };
}

function inspectMaterials(args: unknown) {
  const parsed = parseArguments(
    "inspectMaterials",
    inspectMaterialsArgumentsSchema,
    args
  );
  const selected = exactSelection(materialRegistry.list(), parsed.ids);
  return {
    ...bounded(
      selected.matches.map((entry) => ({
        id: entry.id,
        version: entry.version,
        displayName: entry.displayName,
        phase: entry.phase,
        availability: entry.availability,
        usageModes: entry.usageModes,
        providedChemistryCapabilityIds: entry.providedChemistryCapabilityIds,
        compatibleContainerCapabilityIds:
          entry.compatibleContainerCapabilityIds,
        compatibleContainerEquipmentIds: entry.compatibleContainerComponentIds,
        initializationSchemaId: entry.initializationPresetSchemaId,
        quantityPresetIds: entry.quantityPresetIds,
        safetyPolicyIds: entry.safetyPolicyIds,
        concentrationAuthoring: entry.concentrationAuthoring ?? null
      }))
    ),
    unknownIds: selected.unknownIds,
    registrySnapshotId: materialRegistry.snapshotId
  };
}

function inspectActions(args: unknown) {
  const parsed = parseArguments(
    "inspectActions",
    inspectActionsArgumentsSchema,
    args
  );
  const selected = exactSelection(actionRegistry.list(), parsed.ids);
  return {
    ...bounded(
      selected.matches.map((entry) => ({
        id: entry.id,
        version: entry.version,
        purpose: entry.purpose,
        behavior: entry.behavior,
        sourceEquipmentIds: entry.actorComponentIds,
        targetEquipmentIds: entry.targetComponentIds,
        requiredSourceCapabilityIds: entry.requiredSourceCapabilityIds,
        requiredTargetCapabilityIds: entry.requiredTargetCapabilityIds,
        parameterSchemaId: entry.parameterSchemaId,
        parameters: actionParameterSchemaRegistry.get(entry.parameterSchemaId)
          .parameters,
        preconditionIds: entry.preconditionIds,
        possibleErrorCodes: entry.possibleErrorCodes,
        mechanicalAdapterId: entry.mechanicalAdapterId,
        eventContractId: entry.emittedEventContractId,
        emittedEventTypeIds: actionEventContractRegistry.get(
          entry.emittedEventContractId
        ).eventTypeIds
      }))
    ),
    unknownIds: selected.unknownIds,
    registrySnapshotId: actionRegistry.snapshotId
  };
}

function inspectCapabilities(args: unknown) {
  const parsed = parseArguments(
    "inspectCapabilities",
    inspectCapabilitiesArgumentsSchema,
    args
  );
  const selected = exactSelection(capabilityRegistry.list(), parsed.ids);
  return {
    ...bounded(selected.matches.map((entry) => ({ ...entry }))),
    unknownIds: selected.unknownIds,
    registrySnapshotId: capabilityRegistry.snapshotId
  };
}

function inspectConditions(args: unknown) {
  const parsed = parseArguments(
    "inspectConditions",
    inspectConditionsArgumentsSchema,
    args
  );
  const kinds =
    parsed.kinds.length === 0 ? WORKFLOW_CONDITION_KINDS : parsed.kinds;
  const configurations = configurationRegistry.list();
  return {
    entries: [...new Set(kinds)].map((kind) => ({
      kind,
      ...CONDITION_SUMMARIES[kind]
    })),
    referenceCatalogs: {
      eventTypeIds: eventTypeRegistry
        .list()
        .map(({ id }) => id)
        .sort(compare),
      eventFlagIds: eventFlagRegistry
        .list()
        .map(({ id }) => id)
        .sort(compare),
      observableIds: configurations
        .filter(({ category }) => category === "observable")
        .map(({ id }) => id)
        .sort(compare),
      observationKeyIds: configurations
        .filter(({ category }) => category === "observation_key")
        .map(({ id }) => id)
        .sort(compare),
      completionPolicyIds: configurations
        .filter(({ category }) => category === "completion_policy")
        .map(({ id }) => id)
        .sort(compare),
      submissionFieldIds: configurations
        .filter(({ category }) => category === "submission_field")
        .map(({ id }) => id)
        .sort(compare),
      unitIds: configurations
        .filter(({ category }) => category === "unit")
        .map(({ id }) => id)
        .sort(compare)
    },
    registrySnapshotIds: {
      configurations: configurationRegistry.snapshotId,
      eventFlags: eventFlagRegistry.snapshotId,
      eventTypes: eventTypeRegistry.snapshotId
    }
  };
}

function inspectModels(args: unknown) {
  const parsed = parseArguments(
    "inspectModels",
    inspectModelsArgumentsSchema,
    args
  );
  const selected = exactSelection(chemistryModelRegistry.list(), parsed.ids);
  return {
    ...bounded(selected.matches.map((entry) => ({ ...entry }))),
    unknownIds: selected.unknownIds,
    registrySnapshotId: chemistryModelRegistry.snapshotId
  };
}

function inspectSafety(args: unknown) {
  const parsed = parseArguments(
    "inspectSafety",
    inspectSafetyArgumentsSchema,
    args
  );
  const selected = exactSelection(safetyRegistry.list(), parsed.ids);
  return {
    ...bounded(
      selected.matches.map((entry) => ({
        id: entry.id,
        version: entry.version,
        availability: entry.availability,
        severity: entry.severity,
        prohibited: entry.prohibited,
        teacherConstraint: entry.teacherFacingText,
        studentNotice: entry.studentFacingText
      }))
    ),
    unknownIds: selected.unknownIds,
    registrySnapshotId: safetyRegistry.snapshotId
  };
}

function inspectConfigurations(args: unknown) {
  const parsed = parseArguments(
    "inspectConfigurations",
    inspectConfigurationsArgumentsSchema,
    args
  );
  const selected = exactSelection(configurationRegistry.list(), parsed.ids);
  return {
    ...bounded(
      selected.matches.map((entry) => ({
        id: entry.id,
        version: entry.version,
        description: entry.description,
        category: entry.category,
        scope: entry.scope,
        availability: entry.availability,
        schemaId: entry.schemaId,
        compatibleActionIds: entry.compatibleActionIds,
        compatibleEquipmentIds: entry.compatibleComponentIds,
        ...(entry.category === "quantity_preset"
          ? {
              amount: entry.amount,
              unitId: entry.unitId,
              compatibleMaterialIds: entry.compatibleMaterialProfileIds
            }
          : {})
      }))
    ),
    unknownIds: selected.unknownIds,
    registrySnapshotId: configurationRegistry.snapshotId
  };
}

function knownRegistryIds(): ReadonlySet<string> {
  const ids = new Set<string>();
  const lists = [
    actionRegistry.list(),
    actionParameterSchemaRegistry.list(),
    equipmentPreconditionRegistry.list(),
    labActionErrorContractRegistry.list(),
    actionEventContractRegistry.list(),
    capabilityRegistry.list(),
    chemistryModelRegistry.list(),
    componentRegistry.list(),
    configurationRegistry.list(),
    eventFlagRegistry.list(),
    eventTypeRegistry.list(),
    materialRegistry.list(),
    safetyRegistry.list(),
    skillRegistry.list()
  ] as const;
  for (const list of lists) for (const entry of list) ids.add(entry.id);
  return ids;
}

const KNOWN_REGISTRY_IDS = knownRegistryIds();

function collectKnownRegistryIds(
  value: unknown,
  ids = new Set<string>()
): Set<string> {
  if (typeof value === "string") {
    if (KNOWN_REGISTRY_IDS.has(value)) ids.add(value);
    return ids;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectKnownRegistryIds(item, ids));
    return ids;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectKnownRegistryIds(item, ids));
  }
  return ids;
}

const OPTIONAL_COMMAND_PROPERTY_NAMES = new Set([
  "authoredLimits",
  "eventTypeId",
  "expectedValueSourceId",
  "initialization",
  "maxAttempts",
  "parameterPresetId",
  "points",
  "sourceEquipmentInstanceId",
  "unitId"
]);

function normalizeNullableModelCommandFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeNullableModelCommandFields(item));
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) =>
      child === null && OPTIONAL_COMMAND_PROPERTY_NAMES.has(key)
        ? []
        : [[key, normalizeNullableModelCommandFields(child)]]
    )
  );
}

function draftSummary(draft: Readonly<LabWorkflowDraftV2>) {
  return {
    schemaVersion: draft.schemaVersion,
    id: draft.id,
    revision: draft.revision,
    title: draft.metadata.title,
    supportStatus: draft.supportStatus,
    draftHash: hashLabWorkflowSpec(draft),
    objectiveIds: draft.objectiveIds,
    equipmentInstanceIds: draft.equipment.map(({ instanceId }) => instanceId),
    materialInstanceIds: draft.materials.map(({ instanceId }) => instanceId),
    permittedActionIds: draft.permittedActions.map(({ id }) => id),
    ruleIds: draft.rules.map(({ id }) => id),
    instructionIds: draft.instructions.map(({ id }) => id),
    rubricCriterionIds: draft.rubric.criteria.map(({ id }) => id),
    validationPresent: false,
    judgeCritiquePresent: false
  };
}

export function createCapabilityAuthorToolSession(
  initialDraft: unknown
): CapabilityAuthorToolSession {
  const parsed = labWorkflowDraftV2Schema.safeParse(initialDraft);
  if (!parsed.success) {
    throw new CapabilityAuthorToolError(
      CAPABILITY_AUTHOR_TOOL_ERROR_CODES.invalidInitialDraft,
      "Capability authoring requires a strict unvalidated v2 draft.",
      ["initialDraft"]
    );
  }
  let draft = deepFreeze(structuredClone(parsed.data));
  const audit: CapabilityAuthorToolAuditEntry[] = [];
  const exposedRegistryIds = new Set<string>();
  let callCount = 0;

  function record(
    name: string,
    status: "ok" | "error",
    revisionBefore: number,
    errorCode: string | null
  ): void {
    audit.push(
      deepFreeze({
        sequence: audit.length + 1,
        name,
        status,
        revisionBefore,
        revisionAfter: draft.revision,
        errorCode
      })
    );
  }

  function execute(name: string, args: unknown): unknown {
    const revisionBefore = draft.revision;
    if (callCount >= CAPABILITY_AUTHOR_TOOL_LIMITS.maxToolCalls) {
      const error = new CapabilityAuthorToolError(
        CAPABILITY_AUTHOR_TOOL_ERROR_CODES.callLimit,
        "Capability authoring exceeded the fixed tool-call limit."
      );
      record(name, "error", revisionBefore, error.code);
      throw error;
    }
    callCount += 1;
    const parsedName = capabilityAuthorToolNameSchema.safeParse(name);
    if (!parsedName.success) {
      const error = new CapabilityAuthorToolError(
        CAPABILITY_AUTHOR_TOOL_ERROR_CODES.unknownTool,
        `Tool ${name} is not allowed.`,
        [`tools.${name}`]
      );
      record(name, "error", revisionBefore, error.code);
      throw error;
    }

    try {
      let output: unknown;
      switch (parsedName.data) {
        case "searchObjectives":
          output = inspectObjectives(args);
          break;
        case "inspectEquipment":
          output = inspectEquipment(args);
          break;
        case "inspectMaterials":
          output = inspectMaterials(args);
          break;
        case "inspectActions":
          output = inspectActions(args);
          break;
        case "inspectCapabilities":
          output = inspectCapabilities(args);
          break;
        case "inspectConditions":
          output = inspectConditions(args);
          break;
        case "inspectModels":
          output = inspectModels(args);
          break;
        case "inspectSafety":
          output = inspectSafety(args);
          break;
        case "inspectConfigurations":
          output = inspectConfigurations(args);
          break;
        case "inspectDraft":
          parseArguments("inspectDraft", inspectDraftArgumentsSchema, args);
          output = draftSummary(draft);
          break;
        case "applyDraftCommands": {
          const commandArgs = parseArguments(
            "applyDraftCommands",
            applyDraftCommandsArgumentsSchema,
            normalizeNullableModelCommandFields(args)
          );
          const referencedIds = collectKnownRegistryIds(commandArgs.commands);
          const unexposedRegistryIds = [...referencedIds]
            .filter((id) => !exposedRegistryIds.has(id))
            .sort(compare);
          if (unexposedRegistryIds.length > 0) {
            output = {
              ok: false as const,
              error: {
                code: CAPABILITY_AUTHOR_TOOL_ERROR_CODES.referenceNotExposed,
                path: "commands",
                message:
                  "Every registry reference in a command must first be returned by an inspection tool.",
                dependencyPaths: [],
                unexposedRegistryIds
              }
            };
            break;
          }
          const result = applyLabDraftTransaction(
            draft,
            commandArgs.commands as readonly LabDraftCommand[],
            commandArgs.expectedRevision
          );
          if (!result.ok) {
            output = {
              ok: false as const,
              failingCommandIndex: result.failingCommandIndex,
              error: result.error
            };
            break;
          }
          draft = result.draft;
          output = {
            ok: true as const,
            revisionBefore: result.edit.revisionBefore,
            revisionAfter: result.edit.revisionAfter,
            commandCount: result.edit.commandCount,
            commandTypes: result.edit.commandTypes,
            draftHash: hashLabWorkflowSpec(draft),
            supportStatus: draft.supportStatus,
            validationInvalidated: result.edit.validationInvalidated,
            judgeCritiqueInvalidated: result.edit.judgeCritiqueInvalidated
          };
          break;
        }
      }
      const frozenOutput = deepFreeze(output);
      if (
        parsedName.data !== "applyDraftCommands" &&
        parsedName.data !== "inspectDraft"
      ) {
        collectKnownRegistryIds(frozenOutput, exposedRegistryIds);
      }
      const domainErrorCode =
        frozenOutput &&
        typeof frozenOutput === "object" &&
        "ok" in frozenOutput &&
        frozenOutput.ok === false &&
        "error" in frozenOutput &&
        frozenOutput.error &&
        typeof frozenOutput.error === "object" &&
        "code" in frozenOutput.error &&
        typeof frozenOutput.error.code === "string"
          ? frozenOutput.error.code
          : null;
      record(
        name,
        domainErrorCode ? "error" : "ok",
        revisionBefore,
        domainErrorCode
      );
      return frozenOutput;
    } catch (error) {
      const code =
        error instanceof CapabilityAuthorToolError
          ? error.code
          : "authoring.tool_unexpected.v2";
      record(name, "error", revisionBefore, code);
      throw error;
    }
  }

  return Object.freeze({
    execute,
    getDraft: () => draft,
    getAuditTrail: () => deepFreeze(audit.map((entry) => ({ ...entry }))),
    getExposedRegistryIds: () =>
      Object.freeze([...exposedRegistryIds].sort(compare))
  });
}
