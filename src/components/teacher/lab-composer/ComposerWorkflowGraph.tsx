"use client";

import "@xyflow/react/dist/style.css";

import {
  Background,
  Panel,
  Position,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
  type Node
} from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";

import type { LabDraftRemovalTarget } from "../../../lab-workflows/authoring";
import type { WorkflowRule } from "../../../lab-workflows/schema/conditions";
import type { LabWorkflowDraftV2 } from "../../../lab-workflows/schema/v2";
import { composerActionCatalog } from "./catalog";
import {
  LocalComposerViewStateRepository,
  pruneComposerNodePositions,
  type ComposerNodePosition,
  type ComposerWorkflowView
} from "./composerViewState";

import styles from "./LabComposer.module.css";

interface ComposerWorkflowGraphProps {
  readonly draft: Readonly<LabWorkflowDraftV2>;
  readonly error?: string | null;
  readonly ruleLabel: (rule: Readonly<WorkflowRule>) => string;
  readonly ruleRole: (rule: Readonly<WorkflowRule>) => string;
  readonly onAddDependency: (
    predecessorId: string,
    successorId: string
  ) => boolean;
  readonly onRemoveDependency: (ruleId: string) => void;
  readonly onReplaceRule: (rule: Readonly<WorkflowRule>) => boolean;
  readonly onRequestRemoval: (
    target: LabDraftRemovalTarget,
    label: string,
    trigger: HTMLElement
  ) => void;
}

const ROLE_ORDER: Readonly<Record<string, number>> = {
  Required: 0,
  Success: 1,
  Failure: 2,
  Safety: 3,
  "Best practice": 4,
  "Scoring evidence": 5
};

function deterministicPositions(
  rules: readonly Readonly<WorkflowRule>[],
  roleFor: (rule: Readonly<WorkflowRule>) => string
): Readonly<Record<string, ComposerNodePosition>> {
  const nodes = rules.filter(({ kind }) => kind !== "ordering");
  const depths = new Map(nodes.map(({ id }) => [id, 0]));
  const edges = rules.filter(
    (rule) => rule.condition.kind === "rule_satisfied_before"
  );
  for (let pass = 0; pass < nodes.length; pass += 1) {
    let changed = false;
    for (const edge of edges) {
      if (edge.condition.kind !== "rule_satisfied_before") continue;
      const predecessorDepth =
        depths.get(edge.condition.predecessorRuleId) ?? 0;
      const successorDepth = depths.get(edge.condition.successorRuleId) ?? 0;
      if (successorDepth < predecessorDepth + 1) {
        depths.set(edge.condition.successorRuleId, predecessorDepth + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const byDepth = new Map<number, Readonly<WorkflowRule>[]>();
  for (const rule of nodes) {
    const depth = depths.get(rule.id) ?? 0;
    byDepth.set(depth, [...(byDepth.get(depth) ?? []), rule]);
  }
  const positions: Record<string, ComposerNodePosition> = {};
  for (const [depth, layer] of [...byDepth.entries()].sort(
    ([left], [right]) => left - right
  )) {
    layer
      .sort(
        (left, right) =>
          (ROLE_ORDER[roleFor(left)] ?? 99) -
            (ROLE_ORDER[roleFor(right)] ?? 99) ||
          left.id.localeCompare(right.id)
      )
      .forEach((rule, index) => {
        positions[rule.id] = { x: depth * 320, y: index * 150 };
      });
  }
  return positions;
}

function predecessorIds(
  draft: Readonly<LabWorkflowDraftV2>,
  ruleId: string
): readonly string[] {
  return draft.rules.flatMap((rule) =>
    rule.condition.kind === "rule_satisfied_before" &&
    rule.condition.successorRuleId === ruleId
      ? [rule.condition.predecessorRuleId]
      : []
  );
}

function GraphControls() {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  return (
    <Panel position="bottom-left" className={styles.graphControls}>
      <button type="button" aria-label="Zoom in" onClick={() => void zoomIn()}>
        <span aria-hidden="true">+</span>
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        onClick={() => void zoomOut()}
      >
        <span aria-hidden="true">−</span>
      </button>
      <button
        type="button"
        aria-label="Fit all cards in view"
        onClick={() => void fitView({ padding: 0.15 })}
      >
        <span aria-hidden="true">⊡</span>
      </button>
    </Panel>
  );
}

export function ComposerWorkflowGraph({
  draft,
  error,
  ruleLabel,
  ruleRole,
  onAddDependency,
  onRemoveDependency,
  onReplaceRule,
  onRequestRemoval
}: ComposerWorkflowGraphProps) {
  const ruleIds = useMemo(
    () =>
      draft.rules.filter(({ kind }) => kind !== "ordering").map(({ id }) => id),
    [draft.rules]
  );
  const defaultPositions = useMemo(
    () => deterministicPositions(draft.rules, ruleRole),
    [draft.rules, ruleRole]
  );
  const [view, setView] = useState<ComposerWorkflowView>("graph");
  const [positions, setPositions] = useState<
    Readonly<Record<string, ComposerNodePosition>>
  >({});
  const [selectedRuleId, setSelectedRuleId] = useState(ruleIds[0] ?? "");
  const [relationshipError, setRelationshipError] = useState<string | null>(
    null
  );
  const [predecessorRuleId, setPredecessorRuleId] = useState(ruleIds[0] ?? "");
  const [successorRuleId, setSuccessorRuleId] = useState(
    ruleIds[1] ?? ruleIds[0] ?? ""
  );

  useEffect(() => {
    const repository = new LocalComposerViewStateRepository(
      window.localStorage
    );
    const loaded = repository.load(draft.id, ruleIds);
    const restoreTimer = window.setTimeout(() => {
      if (loaded) {
        setView(loaded.workflowView);
        setPositions(loaded.nodePositions);
        setSelectedRuleId(loaded.selectedRuleId ?? ruleIds[0] ?? "");
      }
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [draft.id, ruleIds]);

  const currentSelectedRuleId = ruleIds.includes(selectedRuleId)
    ? selectedRuleId
    : (ruleIds[0] ?? "");

  useEffect(() => {
    const pruned = pruneComposerNodePositions(positions, ruleIds);
    new LocalComposerViewStateRepository(window.localStorage).save(
      draft.id,
      {
        workflowView: view,
        nodePositions: pruned,
        ...(currentSelectedRuleId
          ? { selectedRuleId: currentSelectedRuleId }
          : {})
      },
      ruleIds
    );
  }, [currentSelectedRuleId, draft.id, positions, ruleIds, view]);

  const nodes: Node[] = useMemo(
    () =>
      draft.rules
        .filter(({ kind }) => kind !== "ordering")
        .map((rule) => {
          const prerequisites = predecessorIds(draft, rule.id);
          const role = ruleRole(rule);
          return {
            id: rule.id,
            position: positions[rule.id] ??
              defaultPositions[rule.id] ?? { x: 0, y: 0 },
            data: {
              label: (
                <div
                  className={styles.graphNodeContent}
                  data-role={role.toLowerCase().replaceAll(" ", "-")}
                >
                  <span>{role}</span>
                  <strong>{ruleLabel(rule)}</strong>
                  <small>
                    {prerequisites.length === 0
                      ? "No prerequisite"
                      : `${prerequisites.length} prerequisite${prerequisites.length === 1 ? "" : "s"}`}
                  </small>
                </div>
              )
            },
            className: styles.graphNode,
            selected: currentSelectedRuleId === rule.id,
            ariaLabel: `${role}: ${ruleLabel(rule)}. ${
              prerequisites.length === 0
                ? "No prerequisite."
                : `Prerequisites: ${prerequisites.join(", ")}.`
            }`,
            sourcePosition: Position.Right,
            targetPosition: Position.Left
          };
        }),
    [
      currentSelectedRuleId,
      defaultPositions,
      draft,
      positions,
      ruleLabel,
      ruleRole
    ]
  );
  const edges: Edge[] = useMemo(
    () =>
      draft.rules.flatMap((rule) =>
        rule.condition.kind === "rule_satisfied_before"
          ? [
              {
                id: rule.id,
                source: rule.condition.predecessorRuleId,
                target: rule.condition.successorRuleId,
                label: "must happen before",
                animated: false,
                deletable: true
              }
            ]
          : []
      ),
    [draft.rules]
  );
  const selectedRule = draft.rules.find(
    ({ id }) => id === currentSelectedRuleId
  );

  function saveView(nextView: ComposerWorkflowView) {
    setView(nextView);
  }

  function connect(connection: Connection) {
    if (!connection.source || !connection.target) return;
    const succeeded = onAddDependency(connection.source, connection.target);
    setRelationshipError(
      succeeded
        ? null
        : "That order cannot be added. Check for a loop or an existing connection."
    );
  }

  function addRelationship() {
    if (!predecessorRuleId || !successorRuleId) return;
    const succeeded = onAddDependency(predecessorRuleId, successorRuleId);
    setRelationshipError(
      succeeded
        ? null
        : "That order cannot be added. Check for a loop or an existing connection."
    );
  }

  return (
    <section
      className={styles.graphWorkspace}
      aria-labelledby="workflow-map-heading"
    >
      <header className={styles.graphHeader}>
        <div>
          <p>Procedure and evidence</p>
          <h2 id="workflow-map-heading">Show what happens first</h2>
        </div>
        <div className={styles.tabs} role="tablist" aria-label="Workflow view">
          <button
            type="button"
            role="tab"
            aria-selected={view === "graph"}
            onClick={() => saveView("graph")}
          >
            Map
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "outline"}
            onClick={() => saveView("outline")}
          >
            List
          </button>
        </div>
      </header>
      {(relationshipError || error) && (
        <p className={styles.inlineError} role="alert">
          {relationshipError ?? error}
        </p>
      )}
      <fieldset className={styles.relationshipControls}>
        <legend>Connect two cards</legend>
        <label>
          First
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
                  {ruleLabel(rule)}
                </option>
              ))}
          </select>
        </label>
        <label>
          Next
          <select
            value={successorRuleId}
            onChange={(event) => setSuccessorRuleId(event.currentTarget.value)}
          >
            {draft.rules
              .filter(({ kind }) => kind !== "ordering")
              .map((rule) => (
                <option key={rule.id} value={rule.id}>
                  {ruleLabel(rule)}
                </option>
              ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!predecessorRuleId || !successorRuleId}
          onClick={addRelationship}
        >
          Connect cards
        </button>
      </fieldset>
      {view === "graph" ? (
        <div className={styles.graphView}>
          <p className={styles.graphHelp}>
            Drag a card to rearrange the map. To connect cards directly, drag
            from the dot on the right of the first card to the dot on the left
            of the next card.
          </p>
          <div
            className={styles.graphCanvas}
            role="region"
            aria-label="Workflow dependency graph"
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              defaultViewport={{ x: 32, y: 32, zoom: 0.72 }}
              minZoom={0.35}
              maxZoom={1.6}
              nodesConnectable
              nodesDraggable
              elementsSelectable
              connectionRadius={28}
              onNodeClick={(_, node) => setSelectedRuleId(node.id)}
              onNodeDrag={(_, node) =>
                setPositions((current) => ({
                  ...current,
                  [node.id]: { x: node.position.x, y: node.position.y }
                }))
              }
              onNodeDragStop={(_, node) =>
                setPositions((current) => ({
                  ...current,
                  [node.id]: { x: node.position.x, y: node.position.y }
                }))
              }
              onConnect={connect}
              onEdgesDelete={(deleted) =>
                deleted.forEach(({ id }) => onRemoveDependency(id))
              }
            >
              <Background gap={24} size={1} />
              <GraphControls />
            </ReactFlow>
          </div>
        </div>
      ) : (
        <div className={styles.workflowOutline} role="tabpanel">
          <ol>
            {draft.rules
              .filter(({ kind }) => kind !== "ordering")
              .map((rule) => {
                const prerequisites = predecessorIds(draft, rule.id);
                return (
                  <li
                    key={rule.id}
                    data-selected={
                      currentSelectedRuleId === rule.id ? "true" : "false"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedRuleId(rule.id)}
                    >
                      <span>{ruleRole(rule)}</span>
                      <strong>{ruleLabel(rule)}</strong>
                      <small>
                        {prerequisites.length === 0
                          ? "No prerequisite"
                          : `After ${prerequisites
                              .map((id) => {
                                const predecessor = draft.rules.find(
                                  (candidate) => candidate.id === id
                                );
                                return predecessor
                                  ? ruleLabel(predecessor)
                                  : id;
                              })
                              .join(", ")}`}
                      </small>
                    </button>
                    <button
                      type="button"
                      onClick={(event) =>
                        onRequestRemoval(
                          { kind: "rule", ruleId: rule.id },
                          ruleLabel(rule),
                          event.currentTarget
                        )
                      }
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
          </ol>
          <h3>Must happen before</h3>
          <ul>
            {draft.rules
              .filter((rule) => rule.condition.kind === "rule_satisfied_before")
              .map((rule) => {
                if (rule.condition.kind !== "rule_satisfied_before")
                  return null;
                const condition = rule.condition;
                const firstRule = draft.rules.find(
                  ({ id }) => id === condition.predecessorRuleId
                );
                const nextRule = draft.rules.find(
                  ({ id }) => id === condition.successorRuleId
                );
                return (
                  <li key={rule.id}>
                    <span>
                      {firstRule ? ruleLabel(firstRule) : "Earlier card"} →{" "}
                      {nextRule ? ruleLabel(nextRule) : "Next card"}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveDependency(rule.id)}
                    >
                      Remove relationship
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      )}
      {selectedRule && selectedRule.kind !== "ordering" && (
        <RuleInspector
          key={selectedRule.id}
          draft={draft}
          rule={selectedRule}
          label={ruleLabel(selectedRule)}
          onSave={onReplaceRule}
          onRemove={onRequestRemoval}
        />
      )}
    </section>
  );
}

function RuleInspector({
  draft,
  rule,
  label,
  onSave,
  onRemove
}: {
  readonly draft: Readonly<LabWorkflowDraftV2>;
  readonly rule: Readonly<WorkflowRule>;
  readonly label: string;
  readonly onSave: (rule: Readonly<WorkflowRule>) => boolean;
  readonly onRemove: ComposerWorkflowGraphProps["onRequestRemoval"];
}) {
  const [severity, setSeverity] = useState(rule.severity);
  const [recoverable, setRecoverable] = useState(rule.recoverable);
  const [terminal, setTerminal] = useState(rule.terminal);
  const [points, setPoints] = useState(String(rule.points ?? 0));
  const [objectiveIds, setObjectiveIds] = useState<readonly string[]>(
    rule.objectiveIds
  );
  const [minimum, setMinimum] = useState(
    rule.condition.kind === "observable_within_tolerance"
      ? String(rule.condition.minimum)
      : ""
  );
  const [maximum, setMaximum] = useState(
    rule.condition.kind === "observable_within_tolerance"
      ? String(rule.condition.maximum)
      : ""
  );
  const initialActionCondition =
    rule.condition.kind === "action_observed" ||
    rule.condition.kind === "action_count_within_range"
      ? rule.condition
      : null;
  const [permissionId, setPermissionId] = useState(() => {
    if (!initialActionCondition) return "";
    return (
      draft.permittedActions.find(
        (permission) =>
          permission.actionId === initialActionCondition.actionId &&
          permission.sourceEquipmentInstanceId ===
            initialActionCondition.sourceEquipmentInstanceId
      )?.id ?? ""
    );
  });

  function save() {
    let condition = rule.condition;
    if (condition.kind === "observable_within_tolerance") {
      condition = {
        ...condition,
        minimum: Number(minimum),
        maximum: Number(maximum)
      };
    } else if (
      (condition.kind === "action_observed" ||
        condition.kind === "action_count_within_range") &&
      permissionId
    ) {
      const permission = draft.permittedActions.find(
        ({ id }) => id === permissionId
      );
      if (permission) {
        condition = {
          ...condition,
          actionId: permission.actionId,
          ...(permission.sourceEquipmentInstanceId
            ? {
                sourceEquipmentInstanceId: permission.sourceEquipmentInstanceId
              }
            : {}),
          targetEquipmentInstanceIds: permission.targetEquipmentInstanceIds
        };
      }
    }
    onSave({
      ...rule,
      condition,
      severity,
      recoverable: terminal ? false : recoverable,
      terminal,
      objectiveIds: [...objectiveIds],
      ...(rule.kind === "scoring" ? { points: Number(points) } : {})
    });
  }

  return (
    <aside
      className={styles.ruleInspector}
      aria-label="Selected rule inspector"
    >
      <header>
        <p>Selected card</p>
        <h3>{label}</h3>
      </header>
      <label>
        Feedback type
        <select
          value={severity}
          onChange={(event) =>
            setSeverity(event.currentTarget.value as typeof severity)
          }
        >
          <option value="info">Information</option>
          <option value="best-practice">Helpful practice</option>
          <option value="procedural">Procedure problem</option>
          <option value="conceptual">Concept misunderstanding</option>
          <option value="safety">Safety problem</option>
        </select>
      </label>
      <fieldset className={styles.objectiveChecks}>
        <legend>Objectives</legend>
        {draft.objectiveIds.map((objectiveId) => (
          <label key={objectiveId}>
            <input
              type="checkbox"
              checked={objectiveIds.includes(objectiveId)}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setObjectiveIds((current) =>
                  checked
                    ? [...current, objectiveId]
                    : current.filter((id) => id !== objectiveId)
                );
              }}
            />
            {objectiveId.replaceAll("_", " ")}
          </label>
        ))}
      </fieldset>
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={recoverable}
          disabled={terminal}
          onChange={(event) => setRecoverable(event.currentTarget.checked)}
        />
        Students can correct this and continue
      </label>
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={terminal}
          onChange={(event) => setTerminal(event.currentTarget.checked)}
        />
        End the attempt when this happens
      </label>
      {rule.kind === "scoring" && (
        <label>
          Points
          <input
            type="number"
            min="0"
            max="1000"
            value={points}
            onChange={(event) => setPoints(event.currentTarget.value)}
          />
        </label>
      )}
      {rule.condition.kind === "observable_within_tolerance" && (
        <div className={styles.inlineForm}>
          <label>
            Lowest accepted value
            <input
              type="number"
              value={minimum}
              onChange={(event) => setMinimum(event.currentTarget.value)}
            />
          </label>
          <label>
            Highest accepted value
            <input
              type="number"
              value={maximum}
              onChange={(event) => setMaximum(event.currentTarget.value)}
            />
          </label>
        </div>
      )}
      {(rule.condition.kind === "action_observed" ||
        rule.condition.kind === "action_count_within_range") && (
        <label>
          Student action
          <select
            value={permissionId}
            onChange={(event) => setPermissionId(event.currentTarget.value)}
          >
            {draft.permittedActions.map((permission) => (
              <option key={permission.id} value={permission.id}>
                {composerActionCatalog.find(
                  ({ id }) => id === permission.actionId
                )?.purpose ?? permission.actionId}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className={styles.inspectorActions}>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={objectiveIds.length === 0}
          onClick={save}
        >
          Save rule
        </button>
        <button
          type="button"
          className={styles.dangerButton}
          onClick={(event) =>
            onRemove(
              { kind: "rule", ruleId: rule.id },
              label,
              event.currentTarget
            )
          }
        >
          Remove rule
        </button>
      </div>
    </aside>
  );
}
