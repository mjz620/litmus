import type {
  ExperimentDefinition,
  GroundTruth,
  RubricCriterion,
  SemanticEvent,
  SkillDefinition
} from "../../../experiments/shared";
import type { EquipmentCapabilityId } from "../../capabilities";
import type {
  ExecutedMaterialAction,
  MaterialLedger,
  MaterialQuantityUnitId
} from "../../chemistry-models/material-ledger";
import type {
  ActionParameterDefinition,
  EquipmentPreconditionEntry
} from "../../registries/actions";
import type { ComponentStateValueType } from "../../registries/components";
import type {
  MaterialBindingV2,
  PermittedActionSpecV2,
  ValidatedLabWorkflowSpecV2,
  ValidationResultV2
} from "../../schema/v2";
import type { WorkflowDiagnosis, WorkflowRule } from "../../schema/conditions";

export const GENERIC_LAB_RUNTIME_SCHEMA_VERSION = "1.1.0" as const;

export type GenericStateValue =
  | boolean
  | null
  | number
  | string
  | readonly string[];

export interface GenericStateField {
  readonly key: string;
  readonly value: GenericStateValue;
}

export interface GenericEquipmentState {
  readonly instanceId: string;
  readonly equipmentDefinitionId: string;
  readonly stateSchemaId: string;
  readonly fields: readonly GenericStateField[];
}

export interface GenericObservable {
  readonly observableId: string;
  readonly value: boolean | number | string;
  readonly unitId?: string;
}

export interface GenericModelState {
  readonly modelId: string;
  readonly modelVersion: string;
  readonly fields: readonly GenericStateField[];
}

export interface GenericChemistryProjection {
  readonly modelStates: readonly GenericModelState[];
  readonly observables: readonly GenericObservable[];
  readonly groundTruth: GroundTruth;
}

export interface GenericRuntimeProvenance {
  readonly workflowId: string;
  readonly workflowRevision: number;
  readonly workflowHash: string;
  readonly validatorVersion: string;
  readonly registrySnapshots: readonly {
    readonly registryId: string;
    readonly snapshotId: string;
  }[];
  readonly resolvedAdapters: ValidationResultV2["resolvedAdapters"];
  readonly resolvedChemistryModels: ValidationResultV2["resolvedChemistryModels"];
}

export interface GenericPermissionAttempt {
  readonly permissionId: string;
  readonly count: number;
}

export interface GenericLabConfig {
  readonly schemaVersion: typeof GENERIC_LAB_RUNTIME_SCHEMA_VERSION;
  readonly sessionId: string;
  readonly workflowId: string;
  readonly workflowRevision: number;
  readonly workflowHash: string;
}

export interface GenericLabState {
  readonly schemaVersion: typeof GENERIC_LAB_RUNTIME_SCHEMA_VERSION;
  readonly sessionId: string;
  readonly provenance: GenericRuntimeProvenance;
  readonly sequence: number;
  readonly equipment: readonly GenericEquipmentState[];
  readonly materialLedger: MaterialLedger;
  readonly chemistry: GenericChemistryProjection;
  readonly diagnoses: readonly WorkflowDiagnosis[];
  readonly permissionAttempts: readonly GenericPermissionAttempt[];
  readonly semanticEvents: readonly SemanticEvent[];
}

export type NormalizedActionParameter =
  | {
      readonly key: string;
      readonly valueType: "number";
      readonly value: number;
    }
  | {
      readonly key: string;
      readonly valueType: "string" | "enum";
      readonly value: string;
    };

export interface NormalizedLabAction {
  readonly schemaVersion: typeof GENERIC_LAB_RUNTIME_SCHEMA_VERSION;
  readonly permissionId: string;
  readonly actionId: string;
  readonly sourceEquipmentInstanceId?: string;
  readonly targetEquipmentInstanceIds: readonly string[];
  readonly parameters: readonly NormalizedActionParameter[];
}

export interface CompiledEquipmentBinding {
  readonly instanceId: string;
  readonly equipmentDefinitionId: string;
  readonly equipmentVersion: string;
  readonly configurationPresetId: string;
  readonly stateSchemaId: string;
  readonly stateFields: readonly {
    readonly key: string;
    readonly valueType: ComponentStateValueType;
    readonly nullable: boolean;
    readonly allowedValues: readonly string[];
  }[];
  readonly capabilityIds: readonly EquipmentCapabilityId[];
  readonly measurement: {
    readonly capacityML: number;
    readonly reportIncrementML: number;
    readonly toleranceML: number;
  } | null;
  readonly mechanicalAdapterId: string;
  readonly safetyPolicyIds: readonly string[];
}

export interface CompiledMaterialBinding extends MaterialBindingV2 {
  readonly materialVersion: string;
  readonly providedChemistryCapabilityIds: readonly string[];
  readonly requiredContainerCapabilityIds: readonly EquipmentCapabilityId[];
  readonly quantityAmount: number;
  readonly quantityUnitId: MaterialQuantityUnitId;
}

export interface CompiledActionBinding {
  readonly permission: Readonly<PermittedActionSpecV2>;
  readonly actionVersion: string;
  readonly requiredSourceCapabilityIds: readonly EquipmentCapabilityId[];
  readonly requiredTargetCapabilityIds: readonly EquipmentCapabilityId[];
  readonly parameterSchemaId: string;
  readonly parameters: readonly ActionParameterDefinition[];
  readonly preconditions: readonly EquipmentPreconditionEntry[];
  readonly mechanicalAdapterId: string;
  readonly emittedEventContractId: string;
}

export interface CompiledChemistryModelBinding {
  readonly modelId: string;
  readonly modelVersion: string;
  readonly providedCapabilityIds: readonly string[];
  readonly requiredCapabilityIds: readonly string[];
}

export interface CompiledGenericLabProgram {
  readonly schemaVersion: typeof GENERIC_LAB_RUNTIME_SCHEMA_VERSION;
  readonly provenance: GenericRuntimeProvenance;
  readonly definitionMetadata: GenericLabDefinitionMetadata;
  readonly workflow: Readonly<ValidatedLabWorkflowSpecV2>;
  readonly equipment: readonly CompiledEquipmentBinding[];
  readonly materials: readonly CompiledMaterialBinding[];
  readonly actions: readonly CompiledActionBinding[];
  /** Dependency-ordered, exact verified metadata selected by validation. */
  readonly chemistryModels: readonly CompiledChemistryModelBinding[];
  readonly registeredObservableIds: readonly string[];
  readonly registeredUnitIds: readonly string[];
  readonly rules: readonly WorkflowRule[];
  readonly safetyPolicyIds: readonly string[];
}

/** @deprecated Use ExecutedMaterialAction. Kept as an LC2-200 source alias. */
export type GenericMaterialAction = ExecutedMaterialAction;

export interface GenericMechanicalTransition {
  readonly equipment: readonly GenericEquipmentState[];
  readonly materialAction: ExecutedMaterialAction | null;
  readonly events: readonly SemanticEvent[];
}

export interface GenericPortCheckSuccess {
  readonly ok: true;
}

export interface GenericPortCheckFailure {
  readonly ok: false;
  readonly reasonCode: string;
  readonly message: string;
}

export type GenericPortCheck =
  | GenericPortCheckSuccess
  | GenericPortCheckFailure;

export interface GenericMechanicalContext {
  readonly binding: CompiledActionBinding;
  readonly action: Readonly<NormalizedLabAction>;
  readonly source: Readonly<GenericEquipmentState> | null;
  readonly targets: readonly Readonly<GenericEquipmentState>[];
  readonly equipment: readonly Readonly<GenericEquipmentState>[];
  readonly materialLedger: Readonly<MaterialLedger>;
  readonly preconditions: readonly EquipmentPreconditionEntry[];
}

export interface GenericEquipmentInitializationContext {
  readonly binding: Readonly<CompiledEquipmentBinding>;
  readonly materialLedger: Readonly<MaterialLedger>;
}

export interface GenericMechanicalAdapterPort {
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly supportedEquipmentDefinitionIds: readonly string[];
  readonly supportedActionIds: readonly string[];
  readonly supportedPreconditionIds: readonly string[];
  initializeEquipment(
    context: Readonly<GenericEquipmentInitializationContext>
  ): GenericEquipmentState;
  checkPreconditions(
    context: Readonly<GenericMechanicalContext>
  ): GenericPortCheck;
  apply(
    context: Readonly<GenericMechanicalContext>
  ): GenericMechanicalTransition;
}

export interface GenericSafetyContext {
  readonly action: Readonly<NormalizedLabAction>;
  readonly selectedPolicyIds: readonly string[];
  readonly sourceEquipmentInstanceId?: string;
  readonly targetEquipmentInstanceIds: readonly string[];
}

export interface GenericSafetyPolicyPort {
  readonly supportedPolicyIds: readonly string[];
  check(context: Readonly<GenericSafetyContext>): GenericPortCheck;
}

export interface GenericModelInitializationContext {
  readonly program: Readonly<CompiledGenericLabProgram>;
  readonly equipment: readonly Readonly<GenericEquipmentState>[];
  readonly materialLedger: Readonly<MaterialLedger>;
}

export interface GenericModelTransitionContext {
  readonly program: Readonly<CompiledGenericLabProgram>;
  readonly previous: Readonly<GenericChemistryProjection>;
  readonly equipment: readonly Readonly<GenericEquipmentState>[];
  readonly materialLedger: Readonly<MaterialLedger>;
  readonly materialAction: Readonly<ExecutedMaterialAction> | null;
}

export interface GenericModelCoordinatorPort {
  readonly supportedModels: readonly {
    readonly modelId: string;
    readonly modelVersion: string;
  }[];
  /** Optional exact contract check used by the code-owned coordinator. */
  assertCompatible?(program: Readonly<CompiledGenericLabProgram>): void;
  initialize(
    context: Readonly<GenericModelInitializationContext>
  ): GenericChemistryProjection;
  transition(
    context: Readonly<GenericModelTransitionContext>
  ): GenericChemistryProjection;
}

export interface GenericWorkflowEvaluationContext {
  readonly rules: readonly WorkflowRule[];
  readonly equipment: readonly Readonly<GenericEquipmentState>[];
  readonly observables: readonly GenericObservable[];
  readonly events: readonly SemanticEvent[];
  readonly previousDiagnoses: readonly WorkflowDiagnosis[];
}

export interface GenericWorkflowEvaluatorPort {
  evaluate(
    context: Readonly<GenericWorkflowEvaluationContext>
  ): readonly WorkflowDiagnosis[];
}

export interface GenericRuntimePorts {
  readonly mechanicalAdapters: readonly GenericMechanicalAdapterPort[];
  readonly safetyPolicy: GenericSafetyPolicyPort;
  readonly models: GenericModelCoordinatorPort;
  readonly evaluator: GenericWorkflowEvaluatorPort;
}

export interface GenericLabDefinitionMetadata {
  readonly id: string;
  readonly title: string;
  readonly skills: readonly SkillDefinition[];
  readonly reportRubric: readonly RubricCriterion[];
}

export interface GenericLabRuntimeTransition {
  readonly state: Readonly<GenericLabState>;
  readonly events: readonly SemanticEvent[];
}

export interface GenericLabRuntime {
  readonly definition: ExperimentDefinition<
    GenericLabConfig,
    GenericLabState,
    NormalizedLabAction
  >;
  readonly program: Readonly<CompiledGenericLabProgram>;
  getState(): Readonly<GenericLabState>;
  dispatch(action: NormalizedLabAction): GenericLabRuntimeTransition;
}
