"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import dynamic from "next/dynamic";
import { useMemo, useState, type ReactNode } from "react";

import type { LabDraftRemovalTarget } from "../../../lab-workflows/authoring";
import {
  BoundedConcentrationError,
  canonicalizeBoundedConcentrationDecimal
} from "../../../lab-workflows/material-initialization";
import { materialRegistry } from "../../../lab-workflows/registries/reagents";
import type { LabWorkflowDraftV2 } from "../../../lab-workflows/schema/v2";
import { scenePlacementRegistry } from "../../../lab-workflows/registries/scene-placements";
import {
  compatibleContainers,
  composerActionCatalog,
  composerEquipmentCatalog,
  composerEquipmentConfigurationCatalog,
  composerMaterialCatalog,
  composerPlacementCatalog,
  placementSupportsEquipment
} from "./catalog";

import styles from "./LabComposer.module.css";

const Composer3DSetupEditor = dynamic(
  () =>
    import("./Composer3DSetupEditor").then(
      ({ Composer3DSetupEditor: Editor }) => Editor
    ),
  {
    ssr: false,
    loading: () => (
      <div className={styles.composer3dLoading} role="status">
        Loading the 3D bench…
      </div>
    )
  }
);

function placementLabel(
  slot: (typeof composerPlacementCatalog)[number]
): string {
  try {
    return scenePlacementRegistry.get(slot.id).displayName;
  } catch {
    // Older saved envelopes remain readable even if they predate scene poses.
  }
  const equipmentNames = slot.compatibleComponentIds
    .map(
      (componentId) =>
        composerEquipmentCatalog.find(({ id }) => id === componentId)
          ?.displayName
    )
    .filter((name): name is string => Boolean(name));
  return equipmentNames.length > 0
    ? `${equipmentNames.join(" or ")} position`
    : "Bench position";
}

function teacherEquipmentPurpose(purpose: string): string {
  return purpose
    .replace("project engine-owned indicator color", "show the indicator color")
    .replaceAll("verified titration workflow", "student titration")
    .replaceAll("verified titrant", "titrant")
    .replaceAll("verified indicator profile", "indicator")
    .replaceAll("verified ", "");
}

type DragPayload =
  | {
      readonly kind: "equipment_definition";
      readonly definitionId: string;
      readonly label: string;
    }
  | {
      readonly kind: "equipment_instance";
      readonly instanceId: string;
      readonly definitionId: string;
      readonly label: string;
    }
  | {
      readonly kind: "material";
      readonly materialProfileId: string;
      readonly label: string;
    };

interface ComposerSetupWorkspaceProps {
  readonly draft: Readonly<LabWorkflowDraftV2>;
  readonly selectedEquipmentId: string;
  readonly errors: Readonly<Record<string, string | undefined>>;
  readonly onSelectEquipment: (instanceId: string) => void;
  readonly onAddToSlot: (definitionId: string, slotId: string) => void;
  readonly onMoveToSlot: (instanceId: string, slotId: string) => void;
  readonly onResetArrangement: () => void;
  readonly onBindMaterial: (
    materialProfileId: string,
    containerId: string
  ) => void;
  readonly onSetMaterialConcentration: (
    instanceId: string,
    decimalValue: string,
    configurationSchemaId: string,
    unitId: string
  ) => void;
  readonly onClearMaterialConcentration: (instanceId: string) => void;
  readonly onConfigure: (instanceId: string, presetId: string) => void;
  readonly onEnableAction: (
    actionId: string,
    sourceInstanceId: string | undefined,
    targetInstanceIds: readonly string[]
  ) => void;
  readonly onRequestRemoval: (
    target: LabDraftRemovalTarget,
    label: string,
    trigger: HTMLElement
  ) => void;
  readonly onRequestReplace: (
    target: LabDraftRemovalTarget,
    label: string,
    replacementDefinitionId: string,
    slotId: string,
    trigger: HTMLElement
  ) => void;
}

function MaterialConcentrationEditor({
  binding,
  error,
  onSet,
  onClear
}: {
  readonly binding: Readonly<LabWorkflowDraftV2["materials"][number]>;
  readonly error: string | undefined;
  readonly onSet: ComposerSetupWorkspaceProps["onSetMaterialConcentration"];
  readonly onClear: ComposerSetupWorkspaceProps["onClearMaterialConcentration"];
}) {
  const profile = materialRegistry.get(binding.materialProfileId);
  const contract = profile.concentrationAuthoring;
  const initialization =
    "initialization" in binding ? binding.initialization : undefined;
  const storedValue = initialization?.concentration.decimalValue ?? "";
  const [value, setValue] = useState(storedValue);

  if (!contract) return null;

  let normalizedValue = "";
  let inputError = "";
  if (value.length > 0) {
    try {
      normalizedValue = canonicalizeBoundedConcentrationDecimal(
        value,
        contract
      ).canonicalDecimalValue;
    } catch (caught) {
      inputError =
        caught instanceof BoundedConcentrationError
          ? caught.message
          : "Enter a supported decimal concentration.";
    }
  }

  const inputId = `material-concentration-${binding.instanceId}`;
  const feedbackId = `${inputId}-feedback`;
  return (
    <form
      className={styles.concentrationEditor}
      onSubmit={(event) => {
        event.preventDefault();
        if (!normalizedValue) return;
        onSet(
          binding.instanceId,
          value,
          contract.configurationSchemaId,
          contract.unitId
        );
      }}
    >
      <label htmlFor={inputId}>Stock concentration</label>
      <div className={styles.concentrationInputRow}>
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          aria-describedby={feedbackId}
          aria-invalid={Boolean(inputError || error)}
          placeholder="For example, 0.25"
          onChange={(event) => setValue(event.currentTarget.value)}
        />
        <span aria-label="moles per litre">mol/L</span>
      </div>
      <small id={feedbackId}>
        Allowed range: {contract.minimumDecimalValue} to{" "}
        {contract.maximumDecimalValue} mol/L, up to{" "}
        {contract.maximumDecimalPlaces} decimal places.
      </small>
      {normalizedValue && normalizedValue !== value && (
        <small role="status">
          This will be saved as {normalizedValue} mol/L.
        </small>
      )}
      {(inputError || error) && (
        <small className={styles.inlineError} role="alert">
          {inputError || error}
        </small>
      )}
      <div className={styles.concentrationActions}>
        <button type="submit" disabled={!normalizedValue}>
          {storedValue ? "Update concentration" : "Set concentration"}
        </button>
        {storedValue && (
          <button type="button" onClick={() => onClear(binding.instanceId)}>
            Clear
          </button>
        )}
      </div>
    </form>
  );
}

function DraggableEquipmentDefinition({
  definitionId,
  label,
  children
}: {
  readonly definitionId: string;
  readonly label: string;
  readonly children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } =
    useDraggable({
      id: `equipment-definition:${definitionId}`,
      data: {
        kind: "equipment_definition",
        definitionId,
        label
      } satisfies DragPayload
    });
  return (
    <article ref={setNodeRef} data-dragging={isDragging ? "true" : "false"}>
      {children}
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={styles.dragHandle}
        aria-label={`Drag ${label} to a compatible slot`}
        {...listeners}
        {...attributes}
      >
        Drag
      </button>
    </article>
  );
}

function DraggableMaterial({
  materialProfileId,
  label
}: {
  readonly materialProfileId: string;
  readonly label: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `material:${materialProfileId}`,
    data: {
      kind: "material",
      materialProfileId,
      label
    } satisfies DragPayload
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={styles.materialChip}
      data-dragging={isDragging ? "true" : "false"}
      aria-label={`Drag ${label} to a compatible container`}
      {...listeners}
      {...attributes}
    >
      {label}
    </button>
  );
}

function BenchSlot({
  slot,
  draft,
  active,
  selected,
  onSelect,
  onRequestRemoval
}: {
  readonly slot: (typeof composerPlacementCatalog)[number];
  readonly draft: Readonly<LabWorkflowDraftV2>;
  readonly active: DragPayload | null;
  readonly selected: boolean;
  readonly onSelect: (instanceId: string) => void;
  readonly onRequestRemoval: (
    target: LabDraftRemovalTarget,
    label: string,
    trigger: HTMLElement
  ) => void;
}) {
  const placement = draft.layout.placements.find(
    ({ placementSlotId }) => placementSlotId === slot.id
  );
  const equipment = draft.equipment.find(
    ({ instanceId }) => instanceId === placement?.equipmentInstanceId
  );
  const activeDefinitionId =
    active?.kind === "equipment_definition"
      ? active.definitionId
      : active?.kind === "equipment_instance"
        ? active.definitionId
        : null;
  const containerHoldsReagent =
    !!equipment &&
    draft.materials.some(
      (binding) => binding.containerInstanceId === equipment.instanceId
    );
  const materialAlreadyPlacedElsewhere =
    active?.kind === "material" &&
    draft.materials.some(
      (binding) => binding.materialProfileId === active.materialProfileId
    );
  const materialCompatible =
    active?.kind !== "material" ||
    (!!equipment &&
      !containerHoldsReagent &&
      !materialAlreadyPlacedElsewhere &&
      compatibleContainers(active.materialProfileId, [equipment]).length > 0);
  const equipmentCompatible =
    !activeDefinitionId ||
    placementSupportsEquipment(slot.id, activeDefinitionId);
  const incompatible = !materialCompatible || !equipmentCompatible;
  const reason = !equipmentCompatible
    ? "This equipment cannot run in this position in the current simulation."
    : !materialCompatible
      ? !equipment
        ? "Place a container here before adding material."
        : materialAlreadyPlacedElsewhere
          ? "This material is already in another container."
          : containerHoldsReagent
            ? "This container already holds another material."
            : "This material cannot be used in that container."
      : null;
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `slot:${slot.id}`,
    disabled: incompatible,
    data: { slotId: slot.id }
  });
  const {
    setNodeRef: setDragRef,
    listeners: dragListeners,
    attributes: dragAttributes
  } = useDraggable({
    id: `equipment-instance:${equipment?.instanceId ?? slot.id}`,
    disabled: !equipment,
    data: equipment
      ? ({
          kind: "equipment_instance",
          instanceId: equipment.instanceId,
          definitionId: equipment.equipmentDefinitionId,
          label: equipment.label
        } satisfies DragPayload)
      : undefined
  });

  return (
    <div
      ref={setDropRef}
      className={styles.benchSlot}
      data-occupied={equipment ? "true" : "false"}
      data-over={isOver ? "true" : "false"}
      data-disabled={incompatible ? "true" : "false"}
      data-selected={selected ? "true" : "false"}
      aria-disabled={incompatible}
    >
      <button
        type="button"
        className={styles.slotSelection}
        onClick={() => equipment && onSelect(equipment.instanceId)}
        aria-label={`${placementLabel(slot)}: ${equipment?.label ?? "Empty position"}`}
      >
        <span>{placementLabel(slot)}</span>
        <strong>{equipment?.label ?? "Empty position"}</strong>
      </button>
      {equipment && (
        <div className={styles.slotActions}>
          <button
            ref={setDragRef}
            type="button"
            className={styles.dragHandle}
            aria-label={`Drag ${equipment.label} to another slot`}
            {...dragListeners}
            {...dragAttributes}
          >
            Move
          </button>
          <button
            type="button"
            onClick={(event) =>
              onRequestRemoval(
                { kind: "equipment", instanceId: equipment.instanceId },
                equipment.label,
                event.currentTarget
              )
            }
          >
            Remove
          </button>
        </div>
      )}
      {reason && active && <small role="status">{reason}</small>}
    </div>
  );
}

function TrashZone({ active }: { readonly active: DragPayload | null }) {
  const removable = active?.kind === "equipment_instance";
  const { setNodeRef, isOver } = useDroppable({
    id: "composer-trash",
    disabled: !removable
  });
  return (
    <div
      ref={setNodeRef}
      className={styles.trashZone}
      data-active={removable ? "true" : "false"}
      data-over={isOver ? "true" : "false"}
      aria-label="Removal zone"
    >
      <strong>Remove from setup</strong>
      <span>Drop equipment here to review what will change.</span>
    </div>
  );
}

export function ComposerSetupWorkspace({
  draft,
  selectedEquipmentId,
  errors,
  onSelectEquipment,
  onAddToSlot,
  onMoveToSlot,
  onResetArrangement,
  onBindMaterial,
  onSetMaterialConcentration,
  onClearMaterialConcentration,
  onConfigure,
  onEnableAction,
  onRequestRemoval,
  onRequestReplace
}: ComposerSetupWorkspaceProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 6 }
    }),
    useSensor(KeyboardSensor)
  );
  const [active, setActive] = useState<DragPayload | null>(null);
  const [librarySlotByDefinition, setLibrarySlotByDefinition] = useState<
    Readonly<Record<string, string>>
  >({});
  const [materialId, setMaterialId] = useState<string>(
    composerMaterialCatalog[0]?.id ?? ""
  );
  const [containerId, setContainerId] = useState("");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [benchView, setBenchView] = useState<"3d" | "list">("3d");
  const selectedEquipment = draft.equipment.find(
    ({ instanceId }) => instanceId === selectedEquipmentId
  );
  const selectedDefinition = selectedEquipment
    ? composerEquipmentCatalog.find(
        ({ id }) => id === selectedEquipment.equipmentDefinitionId
      )
    : undefined;
  const containerChoices = useMemo(
    () => (materialId ? compatibleContainers(materialId, draft.equipment) : []),
    [draft.equipment, materialId]
  );
  // A reagent is paired with one empty container. Offer only compatible
  // containers that are not already holding a reagent, and block adding a
  // reagent that has already been placed, so the teacher cannot create a
  // chemically contradictory setup (two reagents in one container, or the same
  // reagent in two containers).
  const occupiedContainerIds = useMemo(
    () =>
      new Set(draft.materials.map((binding) => binding.containerInstanceId)),
    [draft.materials]
  );
  const materialAlreadyPlaced = useMemo(
    () =>
      draft.materials.some(
        (binding) => binding.materialProfileId === materialId
      ),
    [draft.materials, materialId]
  );
  const availableContainerChoices = useMemo(
    () =>
      materialAlreadyPlaced
        ? []
        : containerChoices.filter(
            (entry) => !occupiedContainerIds.has(entry.instanceId)
          ),
    [containerChoices, materialAlreadyPlaced, occupiedContainerIds]
  );

  function slotForDefinition(definitionId: string): string {
    const selected = librarySlotByDefinition[definitionId];
    if (selected) return selected;
    const emptySlots = composerPlacementCatalog.filter(
      (slot) =>
        placementSupportsEquipment(slot.id, definitionId) &&
        !draft.layout.placements.some(
          ({ placementSlotId }) => placementSlotId === slot.id
        )
    );
    return (
      emptySlots[0]?.id ??
      composerPlacementCatalog.find((slot) =>
        placementSupportsEquipment(slot.id, definitionId)
      )?.id ??
      ""
    );
  }

  function handleDragStart(event: DragStartEvent) {
    setActive((event.active.data.current as DragPayload | undefined) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const payload = event.active.data.current as DragPayload | undefined;
    const overId = event.over?.id ? String(event.over.id) : "";
    setActive(null);
    if (!payload || !overId) return;
    if (overId === "composer-trash" && payload.kind === "equipment_instance") {
      const trigger =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : document.body;
      onRequestRemoval(
        { kind: "equipment", instanceId: payload.instanceId },
        payload.label,
        trigger
      );
      return;
    }
    if (!overId.startsWith("slot:")) return;
    const slotId = overId.slice("slot:".length);
    if (payload.kind === "equipment_definition") {
      onAddToSlot(payload.definitionId, slotId);
    } else if (payload.kind === "equipment_instance") {
      onMoveToSlot(payload.instanceId, slotId);
    } else {
      const placement = draft.layout.placements.find(
        ({ placementSlotId }) => placementSlotId === slotId
      );
      if (placement)
        onBindMaterial(
          payload.materialProfileId,
          placement.equipmentInstanceId
        );
    }
  }

  const selectedInteractions = selectedDefinition
    ? composerActionCatalog.filter((action) => {
        const actorIds: readonly string[] = action.actorComponentIds;
        const targetIds: readonly string[] = action.targetComponentIds;
        return (
          actorIds.includes(selectedDefinition.id) ||
          targetIds.includes(selectedDefinition.id)
        );
      })
    : [];

  function selectEquipment(instanceId: string) {
    onSelectEquipment(instanceId);
    setInspectorOpen(true);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragCancel={() => setActive(null)}
      onDragEnd={handleDragEnd}
    >
      <div
        className={styles.setupWorkspace}
        data-active-drag={active?.kind ?? ""}
      >
        <aside
          className={styles.library}
          aria-labelledby="equipment-library-heading"
        >
          <header>
            <p>Available for this lab</p>
            <h2 id="equipment-library-heading">Equipment</h2>
          </header>
          <div className={styles.libraryList}>
            {composerEquipmentCatalog.map((entry) => {
              const compatibleSlots = composerPlacementCatalog.filter((slot) =>
                placementSupportsEquipment(slot.id, entry.id)
              );
              const selectedSlot = slotForDefinition(entry.id);
              const occupied = draft.layout.placements.find(
                ({ placementSlotId }) => placementSlotId === selectedSlot
              );
              return (
                <DraggableEquipmentDefinition
                  key={entry.id}
                  definitionId={entry.id}
                  label={entry.displayName}
                >
                  <div>
                    <strong>{entry.displayName}</strong>
                    <small>{teacherEquipmentPurpose(entry.purpose)}</small>
                  </div>
                  <label>
                    Place at
                    <select
                      aria-label={`Slot for ${entry.displayName}`}
                      value={selectedSlot}
                      onChange={(event) => {
                        const slotId = event.currentTarget.value;
                        setLibrarySlotByDefinition((current) => ({
                          ...current,
                          [entry.id]: slotId
                        }));
                      }}
                    >
                      {compatibleSlots.map((slot) => (
                        <option key={slot.id} value={slot.id}>
                          {placementLabel(slot)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={!selectedSlot}
                    onClick={(event) => {
                      if (!selectedSlot) return;
                      if (occupied) {
                        const existing = draft.equipment.find(
                          ({ instanceId }) =>
                            instanceId === occupied.equipmentInstanceId
                        );
                        if (existing)
                          onRequestReplace(
                            {
                              kind: "equipment",
                              instanceId: existing.instanceId
                            },
                            existing.label,
                            entry.id,
                            selectedSlot,
                            event.currentTarget
                          );
                      } else {
                        onAddToSlot(entry.id, selectedSlot);
                      }
                    }}
                  >
                    {occupied ? "Replace" : "Add"}
                  </button>
                  {errors[`equipment:${entry.id}`] && (
                    <small className={styles.inlineError} role="alert">
                      {errors[`equipment:${entry.id}`]}
                    </small>
                  )}
                </DraggableEquipmentDefinition>
              );
            })}
          </div>
          <hr />
          <h3>Materials</h3>
          <div className={styles.materialChips}>
            {composerMaterialCatalog.map((entry) => (
              <DraggableMaterial
                key={entry.id}
                materialProfileId={entry.id}
                label={entry.displayName}
              />
            ))}
          </div>
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
            Put it in
            <select
              value={containerId}
              onChange={(event) => setContainerId(event.currentTarget.value)}
              disabled={availableContainerChoices.length === 0}
            >
              <option value="">Choose a container</option>
              {availableContainerChoices.map((entry) => (
                <option key={entry.instanceId} value={entry.instanceId}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={!containerId || materialAlreadyPlaced}
            onClick={() => {
              if (containerId) onBindMaterial(materialId, containerId);
            }}
          >
            Add material
          </button>
          {materialAlreadyPlaced ? (
            <small className={styles.helpText} role="status">
              This material is already in a container. Remove it below to place
              it somewhere else.
            </small>
          ) : (
            availableContainerChoices.length === 0 && (
              <small className={styles.helpText} role="status">
                No empty container for this material yet. Add a compatible
                container to the bench, or remove a reagent from one below to
                free it, then pair them here.
              </small>
            )
          )}
          {errors[`material:${materialId}`] && (
            <small className={styles.inlineError} role="alert">
              {errors[`material:${materialId}`]}
            </small>
          )}
          <ul className={styles.boundMaterialList} aria-label="Bound materials">
            {draft.materials.map((binding) => {
              const material = composerMaterialCatalog.find(
                ({ id }) => id === binding.materialProfileId
              );
              const container = draft.equipment.find(
                ({ instanceId }) => instanceId === binding.containerInstanceId
              );
              const label = material?.displayName ?? binding.materialProfileId;
              return (
                <li key={binding.instanceId}>
                  <span>
                    <strong>{label}</strong>
                    <small>{container?.label ?? "Registered container"}</small>
                  </span>
                  <button
                    type="button"
                    onClick={(event) =>
                      onRequestRemoval(
                        { kind: "material", instanceId: binding.instanceId },
                        label,
                        event.currentTarget
                      )
                    }
                  >
                    Remove
                  </button>
                  <MaterialConcentrationEditor
                    key={`${binding.instanceId}:${
                      "initialization" in binding
                        ? (binding.initialization?.concentration.decimalValue ??
                          "")
                        : ""
                    }`}
                    binding={binding}
                    error={
                      errors[`material:${binding.instanceId}:concentration`]
                    }
                    onSet={onSetMaterialConcentration}
                    onClear={onClearMaterialConcentration}
                  />
                </li>
              );
            })}
          </ul>
        </aside>

        <section className={styles.benchPanel} aria-labelledby="bench-heading">
          <header>
            <p>Student workspace</p>
            <h2 id="bench-heading">Student bench</h2>
          </header>
          <p className={styles.lede}>
            Arrange the real student equipment. It will snap into positions
            where the lab can work safely.
          </p>
          <div className={styles.setupViewSwitch} aria-label="Bench view">
            <button
              type="button"
              aria-pressed={benchView === "3d"}
              onClick={() => setBenchView("3d")}
            >
              3D bench
            </button>
            <button
              type="button"
              aria-pressed={benchView === "list"}
              onClick={() => setBenchView("list")}
            >
              Accessible list
            </button>
            <button type="button" onClick={onResetArrangement}>
              Reset arrangement
            </button>
          </div>
          {errors.arrangement && (
            <p className={styles.inlineError} role="alert">
              {errors.arrangement}
            </p>
          )}
          {benchView === "3d" ? (
            <Composer3DSetupEditor
              draft={draft}
              selectedEquipmentId={selectedEquipmentId}
              onSelectEquipment={selectEquipment}
              onMoveToSlot={onMoveToSlot}
            />
          ) : (
            <div className={styles.bench}>
              {composerPlacementCatalog.map((slot) => (
                <BenchSlot
                  key={slot.id}
                  slot={slot}
                  draft={draft}
                  active={active}
                  selected={
                    draft.layout.placements.find(
                      ({ placementSlotId }) => placementSlotId === slot.id
                    )?.equipmentInstanceId === selectedEquipmentId
                  }
                  onSelect={selectEquipment}
                  onRequestRemoval={onRequestRemoval}
                />
              ))}
            </div>
          )}
          <TrashZone active={active} />
        </section>

        <button
          type="button"
          className={styles.inspectorDrawerToggle}
          aria-expanded={inspectorOpen}
          aria-controls="composer-setup-inspector"
          onClick={() => setInspectorOpen((current) => !current)}
        >
          {inspectorOpen ? "Close equipment editor" : "Edit selected equipment"}
        </button>

        <aside
          id="composer-setup-inspector"
          className={styles.inspector}
          data-drawer-open={inspectorOpen ? "true" : "false"}
          aria-labelledby="inspector-heading"
        >
          <header>
            <p>Selected equipment</p>
            <h2 id="inspector-heading">Edit equipment</h2>
          </header>
          <label>
            Equipment to edit
            <select
              value={selectedEquipmentId}
              onChange={(event) => selectEquipment(event.currentTarget.value)}
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
                Move equipment to
                <select
                  value={
                    draft.layout.placements.find(
                      ({ equipmentInstanceId }) =>
                        equipmentInstanceId === selectedEquipment.instanceId
                    )?.placementSlotId ?? ""
                  }
                  onChange={(event) =>
                    onMoveToSlot(
                      selectedEquipment.instanceId,
                      event.currentTarget.value
                    )
                  }
                >
                  {composerPlacementCatalog
                    .filter((slot) =>
                      placementSupportsEquipment(slot.id, selectedDefinition.id)
                    )
                    .map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {placementLabel(slot)}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Equipment setup
                <select
                  value={selectedEquipment.configurationPresetId}
                  onChange={(event) =>
                    onConfigure(
                      selectedEquipment.instanceId,
                      event.currentTarget.value
                    )
                  }
                >
                  {composerEquipmentConfigurationCatalog
                    .filter((entry) =>
                      entry.compatibleComponentIds.includes(
                        selectedDefinition.id
                      )
                    )
                    .map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.description}
                      </option>
                    ))}
                </select>
              </label>
              <section className={styles.interactionInspector}>
                <h3>Student actions</h3>
                {selectedInteractions.map((action) => {
                  const actorIds: readonly string[] = action.actorComponentIds;
                  const targetIds: readonly string[] =
                    action.targetComponentIds;
                  const isSource = actorIds.includes(selectedDefinition.id);
                  const source = isSource
                    ? selectedEquipment
                    : draft.equipment.find(({ equipmentDefinitionId }) =>
                        actorIds.includes(equipmentDefinitionId)
                      );
                  const target = targetIds.includes(selectedDefinition.id)
                    ? selectedEquipment
                    : draft.equipment.find(({ equipmentDefinitionId }) =>
                        targetIds.includes(equipmentDefinitionId)
                      );
                  const existing = draft.permittedActions.find(
                    (permission) =>
                      permission.actionId === action.id &&
                      permission.sourceEquipmentInstanceId ===
                        source?.instanceId &&
                      permission.targetEquipmentInstanceIds[0] ===
                        target?.instanceId
                  );
                  return (
                    <div key={action.id}>
                      <span>
                        <strong>{action.purpose}</strong>
                        <small>
                          Uses {source?.label ?? "the current setup"}
                          {target ? ` with ${target.label}` : ""}
                        </small>
                      </span>
                      {existing ? (
                        <button
                          type="button"
                          onClick={(event) =>
                            onRequestRemoval(
                              {
                                kind: "permitted_action",
                                permissionId: existing.id
                              },
                              action.purpose,
                              event.currentTarget
                            )
                          }
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={
                            action.requiredSourceCapabilityIds.length > 0 &&
                            !source
                          }
                          onClick={() =>
                            onEnableAction(
                              action.id,
                              source?.instanceId,
                              target ? [target.instanceId] : []
                            )
                          }
                        >
                          Enable
                        </button>
                      )}
                    </div>
                  );
                })}
              </section>
              <button
                className={styles.dangerButton}
                type="button"
                onClick={(event) =>
                  onRequestRemoval(
                    {
                      kind: "equipment",
                      instanceId: selectedEquipment.instanceId
                    },
                    selectedEquipment.label,
                    event.currentTarget
                  )
                }
              >
                Remove equipment
              </button>
              {errors[`equipment:${selectedEquipment.instanceId}`] && (
                <small className={styles.inlineError} role="alert">
                  {errors[`equipment:${selectedEquipment.instanceId}`]}
                </small>
              )}
            </>
          ) : (
            <p className={styles.empty}>Select an equipment instance.</p>
          )}
        </aside>
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? (
          <div
            className={styles.dragOverlay}
            data-testid="composer-drag-overlay"
            aria-hidden="true"
          >
            <strong>{active.label}</strong>
            <span>
              {active.kind === "material"
                ? "Move to a container"
                : active.kind === "equipment_instance"
                  ? "Move to another position"
                  : "Place on the bench"}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
