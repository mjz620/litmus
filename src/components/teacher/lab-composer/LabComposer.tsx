"use client";

import { useMemo, useState } from "react";

import {
  applyLabDraftCommand,
  type LabDraftCommand
} from "../../../lab-workflows/authoring";
import { NATIVE_TITRATION_V2_DRAFT } from "../../../lab-workflows/definitions/titration/native-endpoint-control";
import type { LabWorkflowDraftV2 } from "../../../lab-workflows/schema/v2";
import { componentRegistry } from "../../../lab-workflows/registries/components";
import {
  compatibleContainers,
  composerActionCatalog,
  composerEquipmentConfigurationCatalog,
  composerEquipmentCatalog,
  composerMaterialCatalog,
  composerObjectiveCatalog,
  composerObservableCatalog,
  composerPlacementCatalog,
  placementSupportsEquipment,
  quantityPresetsFor
} from "./catalog";

import styles from "./LabComposer.module.css";

type EditorSection = "setup" | "workflow";

function localId(prefix: string, revision: number): string {
  return `teacher.${prefix}.${revision}`;
}

export function LabComposer() {
  const [draft, setDraft] = useState<Readonly<LabWorkflowDraftV2>>(
    NATIVE_TITRATION_V2_DRAFT
  );
  const [section, setSection] = useState<EditorSection>("setup");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>(
    draft.equipment[0]?.instanceId ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [errorPath, setErrorPath] = useState<string | null>(null);
  const [materialId, setMaterialId] = useState<string>(
    composerMaterialCatalog[0]?.id ?? ""
  );
  const [containerId, setContainerId] = useState("");
  const [placementEquipmentId, setPlacementEquipmentId] = useState(
    draft.equipment[0]?.instanceId ?? ""
  );
  const [placementSlotId, setPlacementSlotId] = useState(
    composerPlacementCatalog[0]?.id ?? ""
  );
  const [actionId, setActionId] = useState<string>(
    composerActionCatalog[0]?.id ?? ""
  );
  const [actionSourceId, setActionSourceId] = useState("");
  const [actionTargetId, setActionTargetId] = useState("");
  const [ruleKind, setRuleKind] = useState<
    "required" | "best_practice" | "scoring"
  >("required");
  const [ruleObjectiveId, setRuleObjectiveId] = useState(
    draft.objectiveIds[0] ?? ""
  );
  const [ruleSeverity, setRuleSeverity] = useState<
    "info" | "best-practice" | "procedural" | "conceptual" | "safety"
  >("procedural");
  const [ruleRecoverable, setRuleRecoverable] = useState(true);
  const [ruleTerminal, setRuleTerminal] = useState(false);
  const [predecessorRuleId, setPredecessorRuleId] = useState(
    draft.rules[0]?.id ?? ""
  );
  const [successorRuleId, setSuccessorRuleId] = useState(
    draft.rules[1]?.id ?? ""
  );
  const [toleranceMinimum, setToleranceMinimum] = useState("24.95");
  const [toleranceMaximum, setToleranceMaximum] = useState("25.05");
  const [instructionTitle, setInstructionTitle] = useState("");
  const [instructionGuidance, setInstructionGuidance] = useState("");
  const [instructionRuleId, setInstructionRuleId] = useState(
    draft.rules[0]?.id ?? ""
  );
  const [criterionDescription, setCriterionDescription] = useState("");
  const [criterionRuleId, setCriterionRuleId] = useState(
    draft.rules[0]?.id ?? ""
  );
  const [criterionPoints, setCriterionPoints] = useState("1");

  const selectedEquipment = draft.equipment.find(
    ({ instanceId }) => instanceId === selectedEquipmentId
  );
  const selectedDefinition = selectedEquipment
    ? componentRegistry.get(selectedEquipment.equipmentDefinitionId)
    : null;
  const containerChoices = useMemo(
    () => (materialId ? compatibleContainers(materialId, draft.equipment) : []),
    [draft.equipment, materialId]
  );
  const selectedAction = composerActionCatalog.find(
    (action) => action.id === actionId
  );
  const actionSources = selectedAction
    ? draft.equipment.filter(({ equipmentDefinitionId }) =>
        selectedAction.actorComponentIds.some(
          (componentId) => componentId === equipmentDefinitionId
        )
      )
    : [];
  const actionTargets = selectedAction
    ? draft.equipment.filter(({ equipmentDefinitionId }) =>
        selectedAction.targetComponentIds.some(
          (componentId) => componentId === equipmentDefinitionId
        )
      )
    : [];

  function run(command: LabDraftCommand): boolean {
    const result = applyLabDraftCommand(draft, command);
    if (!result.ok) {
      setError(result.error.message);
      setErrorPath(
        [result.error.path, ...result.error.dependencyPaths].join(" · ")
      );
      return false;
    }
    setDraft(result.draft);
    setError(null);
    setErrorPath(null);
    return true;
  }

  function addEquipment(equipmentDefinitionId: string) {
    const definition = componentRegistry.get(equipmentDefinitionId);
    const instanceId = localId(
      definition.id.replaceAll(".", "_"),
      draft.revision
    );
    if (
      run({
        type: "add_equipment",
        equipment: {
          instanceId,
          equipmentDefinitionId: definition.id,
          configurationPresetId: definition.defaultConfigurationPresetId,
          label: definition.displayName,
          required: true
        }
      })
    ) {
      setSelectedEquipmentId(instanceId);
      setPlacementEquipmentId(instanceId);
    }
  }

  function bindMaterial() {
    const container = containerId || containerChoices[0]?.instanceId;
    const quantity = quantityPresetsFor(materialId)[0]?.id;
    if (!container || !quantity) return;
    run({
      type: "bind_material",
      binding: {
        instanceId: localId("material", draft.revision),
        materialProfileId: materialId,
        containerInstanceId: container,
        quantityPresetId: quantity
      }
    });
  }

  function placeEquipment() {
    if (!placementEquipmentId || !placementSlotId) return;
    const placements = draft.layout.placements.filter(
      ({ equipmentInstanceId }) => equipmentInstanceId !== placementEquipmentId
    );
    run({
      type: "set_layout",
      layout: {
        ...draft.layout,
        placements: [
          ...placements,
          {
            equipmentInstanceId: placementEquipmentId,
            placementSlotId
          }
        ]
      }
    });
  }

  function selectPlacementEquipment(instanceId: string) {
    setPlacementEquipmentId(instanceId);
    const equipment = draft.equipment.find(
      (entry) => entry.instanceId === instanceId
    );
    const firstSupportedSlot = equipment
      ? composerPlacementCatalog.find((slot) =>
          placementSupportsEquipment(slot.id, equipment.equipmentDefinitionId)
        )
      : undefined;
    setPlacementSlotId(firstSupportedSlot?.id ?? "");
  }

  function permitAction() {
    if (!selectedAction) return;
    const source = actionSourceId || actionSources[0]?.instanceId;
    const target = actionTargetId || actionTargets[0]?.instanceId;
    run({
      type: "permit_action",
      action: {
        id: localId("permission", draft.revision),
        actionId: selectedAction.id,
        ...(source ? { sourceEquipmentInstanceId: source } : {}),
        targetEquipmentInstanceIds: target ? [target] : [],
        availability: { allSatisfiedRuleIds: [], allUnsatisfiedRuleIds: [] }
      }
    });
  }

  function addActionRule() {
    const permission = draft.permittedActions[0];
    if (!permission || !ruleObjectiveId) return;
    run({
      type: "add_rule",
      rule: {
        id: localId("action_rule", draft.revision),
        kind: ruleKind,
        condition: {
          kind: "action_observed",
          actionId: permission.actionId,
          ...(permission.sourceEquipmentInstanceId
            ? {
                sourceEquipmentInstanceId: permission.sourceEquipmentInstanceId
              }
            : {}),
          targetEquipmentInstanceIds: permission.targetEquipmentInstanceIds
        },
        severity: ruleSeverity,
        recoverable: ruleTerminal ? false : ruleRecoverable,
        terminal: ruleTerminal,
        objectiveIds: [ruleObjectiveId]
      }
    });
  }

  function addToleranceRule() {
    const minimum = Number(toleranceMinimum);
    const maximum = Number(toleranceMaximum);
    const observable = composerObservableCatalog[0];
    if (
      !observable ||
      !ruleObjectiveId ||
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum)
    )
      return;
    run({
      type: "add_rule",
      rule: {
        id: localId("tolerance", draft.revision),
        kind: "required",
        condition: {
          kind: "observable_within_tolerance",
          observableId: observable.id,
          minimum,
          maximum,
          minimumInclusive: true,
          maximumInclusive: true,
          unitId: "unit.ml.v1"
        },
        severity: ruleSeverity,
        recoverable: true,
        terminal: false,
        objectiveIds: [ruleObjectiveId]
      }
    });
  }

  function addOrderingDependency() {
    if (!predecessorRuleId || !successorRuleId || !ruleObjectiveId) return;
    run({
      type: "add_ordering_dependency",
      ruleId: localId("ordering", draft.revision),
      predecessorRuleId,
      successorRuleId,
      severity: ruleSeverity,
      recoverable: true,
      objectiveIds: [ruleObjectiveId]
    });
  }

  function addInstruction() {
    if (
      !instructionTitle.trim() ||
      !instructionGuidance.trim() ||
      !instructionRuleId
    )
      return;
    if (
      run({
        type: "add_instruction",
        instruction: {
          id: localId("instruction", draft.revision),
          title: instructionTitle.trim(),
          guidance: instructionGuidance.trim(),
          relatedRuleIds: [instructionRuleId]
        }
      })
    ) {
      setInstructionTitle("");
      setInstructionGuidance("");
    }
  }

  function addCriterion() {
    const points = Number(criterionPoints);
    if (
      !criterionDescription.trim() ||
      !criterionRuleId ||
      !ruleObjectiveId ||
      !Number.isFinite(points)
    )
      return;
    if (
      run({
        type: "add_rubric_criterion",
        criterion: {
          id: localId("criterion", draft.revision),
          objectiveIds: [ruleObjectiveId],
          ruleIds: [criterionRuleId],
          description: criterionDescription.trim(),
          maxPoints: points,
          assessmentModeId: "assessment.event_performance.v1",
          evidenceMappings: [
            { kind: "rule_diagnosis", ruleId: criterionRuleId, required: true }
          ],
          scoringGuide: [
            "0: evidence absent",
            `${points}: evidence demonstrated`
          ]
        }
      })
    ) {
      setCriterionDescription("");
    }
  }

  return (
    <div className={styles.composer}>
      <section className={styles.statusBar} aria-label="Draft status">
        <div>
          <span className={styles.statusDot} aria-hidden="true" />
          <strong>Draft unvalidated</strong>
          <span>Revision {draft.revision}</span>
        </div>
        <div className={styles.statusActions}>
          <button type="button" disabled title="Validation is required first">
            Preview
          </button>
          <button type="button" disabled title="Assignment arrives in Phase 8">
            Assign
          </button>
        </div>
      </section>

      {error && (
        <div className={styles.error} role="alert">
          <strong>That edit was not applied.</strong>
          <span>{error}</span>
          {errorPath && <code>{errorPath}</code>}
        </div>
      )}

      <div
        className={styles.tabs}
        role="tablist"
        aria-label="Composer sections"
      >
        {(["setup", "workflow"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={section === value}
            onClick={() => setSection(value)}
          >
            {value === "setup" ? "Physical setup" : "Workflow & assessment"}
          </button>
        ))}
      </div>

      {section === "setup" ? (
        <div className={styles.editorGrid}>
          <aside
            className={styles.library}
            aria-labelledby="equipment-library-heading"
          >
            <header>
              <p>Verified primitives</p>
              <h2 id="equipment-library-heading">Equipment library</h2>
            </header>
            <div className={styles.libraryList}>
              {composerEquipmentCatalog.map((entry) => (
                <article key={entry.id}>
                  <div>
                    <strong>{entry.displayName}</strong>
                    <small>{entry.purpose}</small>
                  </div>
                  <span>{entry.performanceTier}</span>
                  <button type="button" onClick={() => addEquipment(entry.id)}>
                    Add
                  </button>
                </article>
              ))}
            </div>
            <hr />
            <h3>Bind a registered material</h3>
            <label>
              Material
              <select
                value={materialId}
                onChange={(event) => {
                  setMaterialId(event.currentTarget.value);
                  setContainerId("");
                }}
              >
                {composerMaterialCatalog.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Compatible container
              <select
                value={containerId}
                onChange={(event) => setContainerId(event.currentTarget.value)}
              >
                <option value="">Choose automatically</option>
                {containerChoices.map((entry) => (
                  <option key={entry.instanceId} value={entry.instanceId}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className={styles.primaryButton}
              type="button"
              disabled={containerChoices.length === 0}
              onClick={bindMaterial}
            >
              Bind material
            </button>
          </aside>

          <section
            className={styles.benchPanel}
            aria-labelledby="bench-heading"
          >
            <header>
              <p>Bounded 2D layout</p>
              <h2 id="bench-heading">Student bench</h2>
            </header>
            <div className={styles.bench}>
              {composerPlacementCatalog.map((slot) => {
                const placed = draft.layout.placements.find(
                  ({ placementSlotId }) => placementSlotId === slot.id
                );
                const equipment = draft.equipment.find(
                  ({ instanceId }) => instanceId === placed?.equipmentInstanceId
                );
                return (
                  <button
                    type="button"
                    key={slot.id}
                    data-occupied={equipment ? "true" : "false"}
                    onClick={() => {
                      setPlacementSlotId(slot.id);
                      if (equipment)
                        setSelectedEquipmentId(equipment.instanceId);
                    }}
                  >
                    <span>{slot.description}</span>
                    <strong>{equipment?.label ?? "Empty slot"}</strong>
                  </button>
                );
              })}
            </div>
            <div className={styles.inlineForm}>
              <label>
                Equipment
                <select
                  value={placementEquipmentId}
                  onChange={(event) =>
                    selectPlacementEquipment(event.currentTarget.value)
                  }
                >
                  {draft.equipment.map((entry) => (
                    <option key={entry.instanceId} value={entry.instanceId}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Supported slot
                <select
                  value={placementSlotId}
                  onChange={(event) =>
                    setPlacementSlotId(event.currentTarget.value)
                  }
                >
                  {composerPlacementCatalog
                    .filter((slot) => {
                      const equipment = draft.equipment.find(
                        ({ instanceId }) => instanceId === placementEquipmentId
                      );
                      return (
                        !equipment ||
                        placementSupportsEquipment(
                          slot.id,
                          equipment.equipmentDefinitionId
                        )
                      );
                    })
                    .map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {slot.description}
                      </option>
                    ))}
                </select>
              </label>
              <button type="button" onClick={placeEquipment}>
                Place
              </button>
            </div>
          </section>

          <aside
            className={styles.inspector}
            aria-labelledby="inspector-heading"
          >
            <header>
              <p>Exact adapter contract</p>
              <h2 id="inspector-heading">Inspector</h2>
            </header>
            <label>
              Selected instance
              <select
                value={selectedEquipmentId}
                onChange={(event) =>
                  setSelectedEquipmentId(event.currentTarget.value)
                }
              >
                {draft.equipment.map((entry) => (
                  <option key={entry.instanceId} value={entry.instanceId}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
            {selectedEquipment && selectedDefinition ? (
              <>
                <label>
                  Configuration preset
                  <select
                    value={selectedEquipment.configurationPresetId}
                    onChange={(event) =>
                      run({
                        type: "configure_equipment",
                        instanceId: selectedEquipment.instanceId,
                        configurationPresetId: event.currentTarget.value
                      })
                    }
                  >
                    {composerEquipmentConfigurationCatalog
                      .filter((entry) =>
                        entry.compatibleComponentIds.includes(
                          selectedEquipment.equipmentDefinitionId
                        )
                      )
                      .map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.description}
                        </option>
                      ))}
                  </select>
                </label>
                <dl className={styles.details}>
                  <div>
                    <dt>Definition</dt>
                    <dd>{selectedDefinition.displayName}</dd>
                  </div>
                  <div>
                    <dt>Configuration</dt>
                    <dd>{selectedEquipment.configurationPresetId}</dd>
                  </div>
                  <div>
                    <dt>Visual adapter</dt>
                    <dd>{selectedDefinition.visualAdapterDefinitionId}</dd>
                  </div>
                  <div>
                    <dt>Mechanical adapter</dt>
                    <dd>{selectedDefinition.mechanicalAdapterId}</dd>
                  </div>
                  <div>
                    <dt>Performance</dt>
                    <dd>{selectedDefinition.performanceTier}</dd>
                  </div>
                  <div>
                    <dt>Capabilities</dt>
                    <dd>{selectedDefinition.capabilityIds.join(", ")}</dd>
                  </div>
                  <div>
                    <dt>Supported actions</dt>
                    <dd>{selectedDefinition.allowedActionIds.join(", ")}</dd>
                  </div>
                  <div>
                    <dt>Safety</dt>
                    <dd>
                      {selectedDefinition.safetyConstraintIds.join(", ") ||
                        "No additional policy"}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className={styles.empty}>Select an equipment instance.</p>
            )}
            <button
              className={styles.dangerButton}
              type="button"
              disabled={!selectedEquipment}
              onClick={() => {
                if (!selectedEquipment) return;
                run({
                  type: "remove_equipment",
                  instanceId: selectedEquipment.instanceId
                });
              }}
            >
              Remove instance
            </button>
          </aside>

          <section className={styles.actionPanel}>
            <header>
              <p>Capability checked</p>
              <h2>Permitted actions</h2>
            </header>
            <div className={styles.inlineForm}>
              <label>
                Action
                <select
                  value={actionId}
                  onChange={(event) => {
                    setActionId(event.currentTarget.value);
                    setActionSourceId("");
                    setActionTargetId("");
                  }}
                >
                  {composerActionCatalog.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.purpose}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Source
                <select
                  value={actionSourceId}
                  onChange={(event) =>
                    setActionSourceId(event.currentTarget.value)
                  }
                >
                  <option value="">Choose automatically</option>
                  {actionSources.map((entry) => (
                    <option key={entry.instanceId} value={entry.instanceId}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Target
                <select
                  value={actionTargetId}
                  onChange={(event) =>
                    setActionTargetId(event.currentTarget.value)
                  }
                >
                  <option value="">None / automatic</option>
                  {actionTargets.map((entry) => (
                    <option key={entry.instanceId} value={entry.instanceId}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={permitAction}>
                Permit action
              </button>
            </div>
            <ul className={styles.compactList}>
              {draft.permittedActions.map((action) => (
                <li key={action.id}>
                  <strong>
                    {composerActionCatalog.find(
                      ({ id }) => id === action.actionId
                    )?.purpose ?? action.actionId}
                  </strong>
                  <span>
                    {action.sourceEquipmentInstanceId ?? "no source"} →{" "}
                    {action.targetEquipmentInstanceIds.join(", ") ||
                      "observation"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : (
        <div className={styles.workflowGrid}>
          <section className={styles.workflowPanel}>
            <header>
              <p>Learning contract</p>
              <h2>Objectives</h2>
            </header>
            <div className={styles.checkList}>
              {composerObjectiveCatalog.map((objective) => {
                const selected = draft.objectiveIds.includes(objective.id);
                return (
                  <label key={objective.id}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() =>
                        run(
                          selected
                            ? {
                                type: "remove_objective",
                                objectiveId: objective.id
                              }
                            : {
                                type: "add_objective",
                                objectiveId: objective.id
                              }
                        )
                      }
                    />
                    <span>
                      <strong>{objective.id.replaceAll("_", " ")}</strong>
                      <small>{objective.description}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          <section className={styles.workflowPanel}>
            <header>
              <p>Typed evidence</p>
              <h2>Add a workflow rule</h2>
            </header>
            <div className={styles.inlineForm}>
              <label>
                Kind
                <select
                  value={ruleKind}
                  onChange={(event) =>
                    setRuleKind(event.currentTarget.value as typeof ruleKind)
                  }
                >
                  <option value="required">Required</option>
                  <option value="best_practice">Best practice</option>
                  <option value="scoring">Scoring</option>
                </select>
              </label>
              <label>
                Objective
                <select
                  value={ruleObjectiveId}
                  onChange={(event) =>
                    setRuleObjectiveId(event.currentTarget.value)
                  }
                >
                  {draft.objectiveIds.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Severity
                <select
                  value={ruleSeverity}
                  onChange={(event) =>
                    setRuleSeverity(
                      event.currentTarget.value as typeof ruleSeverity
                    )
                  }
                >
                  <option value="info">Info</option>
                  <option value="best-practice">Best practice</option>
                  <option value="procedural">Procedural</option>
                  <option value="conceptual">Conceptual</option>
                  <option value="safety">Safety</option>
                </select>
              </label>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={ruleRecoverable}
                  disabled={ruleTerminal}
                  onChange={(event) =>
                    setRuleRecoverable(event.currentTarget.checked)
                  }
                />{" "}
                Recoverable
              </label>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={ruleTerminal}
                  onChange={(event) =>
                    setRuleTerminal(event.currentTarget.checked)
                  }
                />{" "}
                Terminal
              </label>
              <button type="button" onClick={addActionRule}>
                Add action-evidence rule
              </button>
            </div>
            <div className={styles.toleranceForm}>
              <strong>Numerical tolerance rule</strong>
              <label>
                Minimum
                <input
                  type="number"
                  step="0.01"
                  value={toleranceMinimum}
                  onChange={(event) =>
                    setToleranceMinimum(event.currentTarget.value)
                  }
                />
              </label>
              <label>
                Maximum
                <input
                  type="number"
                  step="0.01"
                  value={toleranceMaximum}
                  onChange={(event) =>
                    setToleranceMaximum(event.currentTarget.value)
                  }
                />
              </label>
              <button type="button" onClick={addToleranceRule}>
                Add tolerance
              </button>
            </div>
          </section>

          <section className={styles.workflowPanel}>
            <header>
              <p>Partial order—not a click script</p>
              <h2>Ordering dependencies</h2>
            </header>
            <div className={styles.inlineForm}>
              <label>
                Predecessor
                <select
                  value={predecessorRuleId}
                  onChange={(event) =>
                    setPredecessorRuleId(event.currentTarget.value)
                  }
                >
                  {draft.rules
                    .filter(({ kind }) => kind !== "ordering")
                    .map((rule) => (
                      <option key={rule.id} value={rule.id}>
                        {rule.id}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Successor
                <select
                  value={successorRuleId}
                  onChange={(event) =>
                    setSuccessorRuleId(event.currentTarget.value)
                  }
                >
                  {draft.rules
                    .filter(({ kind }) => kind !== "ordering")
                    .map((rule) => (
                      <option key={rule.id} value={rule.id}>
                        {rule.id}
                      </option>
                    ))}
                </select>
              </label>
              <button type="button" onClick={addOrderingDependency}>
                Add dependency
              </button>
            </div>
            <ul className={styles.ruleList}>
              {draft.rules.map((rule) => (
                <li key={rule.id}>
                  <div>
                    <span data-kind={rule.kind}>
                      {rule.kind.replaceAll("_", " ")}
                    </span>
                    <strong>{rule.id}</strong>
                    <small>
                      {rule.condition.kind} · {rule.severity} ·{" "}
                      {rule.terminal
                        ? "terminal"
                        : rule.recoverable
                          ? "recoverable"
                          : "non-recoverable"}
                    </small>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      run(
                        rule.kind === "ordering"
                          ? {
                              type: "remove_ordering_dependency",
                              ruleId: rule.id
                            }
                          : { type: "remove_rule", ruleId: rule.id }
                      )
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.workflowPanel}>
            <header>
              <p>Presentation only</p>
              <h2>Student instructions</h2>
            </header>
            <div className={styles.stackForm}>
              <label>
                Title
                <input
                  value={instructionTitle}
                  onChange={(event) =>
                    setInstructionTitle(event.currentTarget.value)
                  }
                  maxLength={160}
                />
              </label>
              <label>
                Guidance
                <textarea
                  value={instructionGuidance}
                  onChange={(event) =>
                    setInstructionGuidance(event.currentTarget.value)
                  }
                  maxLength={4000}
                />
              </label>
              <label>
                Related rule
                <select
                  value={instructionRuleId}
                  onChange={(event) =>
                    setInstructionRuleId(event.currentTarget.value)
                  }
                >
                  {draft.rules.map((rule) => (
                    <option key={rule.id} value={rule.id}>
                      {rule.id}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={addInstruction}>
                Add instruction
              </button>
            </div>
            <ol className={styles.compactList}>
              {draft.instructions.map((instruction) => (
                <li key={instruction.id}>
                  <strong>{instruction.title}</strong>
                  <span>{instruction.guidance}</span>
                  <button
                    type="button"
                    onClick={() =>
                      run({
                        type: "remove_instruction",
                        instructionId: instruction.id
                      })
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <section className={styles.workflowPanel}>
            <header>
              <p>Evidence mapping</p>
              <h2>Assessment rubric</h2>
            </header>
            <p className={styles.total}>
              Authored total: <strong>{draft.rubric.totalPoints} points</strong>{" "}
              · Passing policy is checked by deterministic validation.
            </p>
            <div className={styles.stackForm}>
              <label>
                Description
                <input
                  value={criterionDescription}
                  onChange={(event) =>
                    setCriterionDescription(event.currentTarget.value)
                  }
                  maxLength={4000}
                />
              </label>
              <label>
                Evidence rule
                <select
                  value={criterionRuleId}
                  onChange={(event) =>
                    setCriterionRuleId(event.currentTarget.value)
                  }
                >
                  {draft.rules.map((rule) => (
                    <option key={rule.id} value={rule.id}>
                      {rule.id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Maximum points
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={criterionPoints}
                  onChange={(event) =>
                    setCriterionPoints(event.currentTarget.value)
                  }
                />
              </label>
              <button type="button" onClick={addCriterion}>
                Add criterion
              </button>
            </div>
            <ul className={styles.compactList}>
              {draft.rubric.criteria.map((criterion) => (
                <li key={criterion.id}>
                  <strong>{criterion.description}</strong>
                  <span>
                    {criterion.maxPoints} points ·{" "}
                    {criterion.ruleIds.join(", ")}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      run({
                        type: "remove_rubric_criterion",
                        criterionId: criterion.id
                      })
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
