"use client";

import { Canvas } from "@react-three/fiber";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import type { SetupDrivenLabProjection } from "../../../stores/setupDrivenLabSession";
import { useLabUiStore } from "../../../stores/labUiStore";
import { CoachPanelView } from "../../coach/CoachPanel";
import type { CoachMessage, CoachStatus } from "../../../stores/labStore";
import {
  LOOK_RECENTER_EVENT,
  LOOK_STEP_EVENT,
  type LookStepDetail
} from "../three/BenchCameraControls";
import { BuretteDispenseProvider } from "../three/Burette";
import { LabScene } from "../three/LabScene";
import { CAMERA_POSES } from "../three/benchLayout";
import type { GlassQuality } from "../three/glassMaterials";
import { getLabSounds } from "../three/labSounds";
import { getFlaskLiquidColor } from "../three/sceneProjection";
import type { LabVisualGesture } from "../three/gestures/LabVisualGestures";
import type { IndicatorId } from "../../../experiments/titration/titration";
import { EQUIPMENT, type EquipmentId } from "./equipment";
import {
  projectionActionsForEquipmentFocus,
  resolveLabSceneConfiguration,
  type LabSceneConfiguration
} from "./labScene";
import { FocusedEquipmentActionPanel } from "./FocusedEquipmentActionPanel";
import {
  DISPENSE_RESIDUE_ML,
  useDispenseGesture,
  type DispenseCommit
} from "./useDispenseGesture";

import sceneStyles from "../titration/TitrationScene.module.css";
import styles from "./SetupDrivenWorkspace.module.css";

interface ImmersiveSetupDrivenBenchProps {
  readonly projection: Readonly<SetupDrivenLabProjection>;
  readonly prompt: string;
  readonly precisionControlsOpen: boolean;
  readonly onPrecisionControlsChange: (open: boolean) => void;
  readonly coachMessages: readonly CoachMessage[];
  readonly coachStatus: CoachStatus;
  readonly coachError: string | null;
  readonly coachSessionId: string;
  readonly askCoach: (question: string) => Promise<void>;
  readonly equipmentLabels: ReadonlyMap<string, string>;
  readonly actionLabel: (
    action: SetupDrivenLabProjection["actions"][number]
  ) => string;
  readonly completedActionMessage: (
    action: SetupDrivenLabProjection["actions"][number]
  ) => string | null;
  readonly parameterLabel: (parameterKey: string) => string;
  readonly parameterValue: (
    action: SetupDrivenLabProjection["actions"][number],
    key: string
  ) => string;
  readonly onParameterChange: (
    action: SetupDrivenLabProjection["actions"][number],
    key: string,
    value: string
  ) => void;
  readonly onDispatch: (
    action: SetupDrivenLabProjection["actions"][number]
  ) => void;
  /**
   * Session sink for one hold-to-dispense commit (normalized
   * action.dispense.v1). The stopcock gesture activates only when this is
   * provided and the projection currently offers an available dispense action
   * on the focused burette.
   */
  readonly dispatchDispenseCommit?: (commit: DispenseCommit) => boolean;
  /** Opens the indicator review dialog for a 3D shelf-bottle selection. */
  readonly onIndicatorShelfSelect?: (indicator: IndicatorId) => void;
  readonly activeVisualGesture?: LabVisualGesture | null;
  readonly onVisualGestureComplete?: (sequence: number) => void;
  /**
   * Deterministic titration bench status projected from equipment-owned
   * observables, exposed as the same data attributes the legacy
   * TitrationScene publishes so browser tests read one contract on either
   * bench. Null on non-titration benches.
   */
  readonly titrationBenchStatus?: {
    readonly buretteFillFraction: number;
    readonly buretteConditioned: boolean;
    readonly indicatorAdded: boolean;
    readonly procedureStage: string;
  } | null;
}

/**
 * Titration-parity immersive shell for native setup-driven labs: full-bleed
 * LabScene, equipment focus rail, look-around, recenter, coach dock, and a
 * Lab-steps toggle for keyboard actions.
 */
export function ImmersiveSetupDrivenBench({
  projection,
  prompt,
  precisionControlsOpen,
  onPrecisionControlsChange,
  coachMessages,
  coachStatus,
  coachError,
  coachSessionId,
  askCoach,
  equipmentLabels,
  actionLabel,
  completedActionMessage,
  parameterLabel,
  parameterValue,
  onParameterChange,
  onDispatch,
  dispatchDispenseCommit,
  onIndicatorShelfSelect,
  activeVisualGesture = null,
  onVisualGestureComplete,
  titrationBenchStatus = null
}: ImmersiveSetupDrivenBenchProps) {
  const canvasFrameRef = useRef<HTMLDivElement>(null);
  const [webGLReady, setWebGLReady] = useState(false);
  const [autoQuality, setAutoQuality] = useState<GlassQuality>("high");
  const [reducedGraphics, setReducedGraphics] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const focused = useLabUiStore((store) => store.focused);
  const hovered = useLabUiStore((store) => store.hovered);
  const lookActive = useLabUiStore((store) => store.lookActive);
  const setFocused = useLabUiStore((store) => store.setFocused);
  const setHovered = useLabUiStore((store) => store.setHovered);
  const setLookActive = useLabUiStore((store) => store.setLookActive);
  const clearFocus = useLabUiStore((store) => store.clearFocus);
  const soundMuted = useSyncMuted();

  /*
   * Resolved as one value rather than a memo that writes to error state. A
   * failed resolve is not an event, it is a property of this projection, so it
   * is derived during render alongside the configuration it replaces. Setting
   * state from inside the memo made the render impure and risked re-running
   * the memo off its own state write.
   */
  const scene = useMemo(():
    | { readonly configuration: LabSceneConfiguration; readonly error: null }
    | { readonly configuration: null; readonly error: string } => {
    try {
      return {
        configuration: resolveLabSceneConfiguration(projection),
        error: null
      };
    } catch (error) {
      return {
        configuration: null,
        error:
          error instanceof Error
            ? error.message
            : "The setup-driven scene could not be resolved."
      };
    }
  }, [projection]);

  const { configuration, error: sceneError } = scene;

  useEffect(() => {
    if (
      configuration &&
      focused &&
      !configuration.selectableEquipmentIds.includes(focused)
    ) {
      clearFocus();
    }
  }, [clearFocus, configuration, focused]);

  useEffect(
    () => () => {
      const ui = useLabUiStore.getState();
      ui.setFocused(null);
      ui.setHovered(null);
      ui.setLookActive(false);
    },
    []
  );

  const selectedEquipmentId = useMemo((): EquipmentId | null => {
    if (!configuration || !focused) return null;
    return configuration.selectableEquipmentIds.includes(focused)
      ? focused
      : null;
  }, [configuration, focused]);

  const focusedActions = useMemo(
    () =>
      selectedEquipmentId
        ? projectionActionsForEquipmentFocus(projection, selectedEquipmentId)
        : [],
    [projection, selectedEquipmentId]
  );

  /*
   * Hold-to-dispense stopcock gesture, activated only when the projection
   * offers an available action.dispense.v1 and the host supplied a session
   * sink. The same reducer drives the titration strangler; here every commit
   * dispatches the normalized action through the native session.
   */
  const projectedBurette = configuration?.projectedState?.burette ?? null;
  const dispenseAction =
    projection.actions.find(
      (action) => action.actionId === "action.dispense.v1"
    ) ?? null;
  const dispenseMinimumML =
    configuration?.minDispenseVolumeML ?? DISPENSE_RESIDUE_ML;
  const dispenseEnabled = Boolean(
    dispatchDispenseCommit &&
      dispenseAction?.available &&
      projectedBurette &&
      projectedBurette.availableML >= dispenseMinimumML
  );
  const dispense = useDispenseGesture({
    availableML: projectedBurette?.availableML ?? 0,
    minimumCommitML: dispenseMinimumML,
    maximumCommitML: configuration?.maxDispenseVolumeML ?? null,
    enabled: dispenseEnabled,
    dispatchCommit: dispatchDispenseCommit,
    onCommit: () => getLabSounds().playFromGesture("drop"),
    onDetentChange: () => getLabSounds().playFromGesture("valve"),
    onGestureStart: () => getLabSounds().playFromGesture("valve"),
    onGestureEnd: () => getLabSounds().playFromGesture("valve")
  });

  if (sceneError || !configuration) {
    return (
      <div className={styles.setupError} role="alert">
        <strong>Lab setup unavailable</strong>
        <span>{sceneError ?? "Scene configuration missing."}</span>
      </div>
    );
  }

  const enabled = configuration.selectableEquipmentIds;
  const selected = selectedEquipmentId;
  const infoEquipment =
    hovered && enabled.includes(hovered) ? hovered : selected;
  const quality: GlassQuality = reducedGraphics ? "low" : autoQuality;
  const burette = configuration.projectedState?.burette;
  const flask = configuration.projectedState?.flask;
  const indicatorSelectionEnabled = Boolean(
    onIndicatorShelfSelect &&
      flask &&
      !flask.indicatorAdded &&
      projection.actions.some(
        (action) =>
          action.available &&
          (action.actionId === "action.add_indicator.v1" ||
            action.actionId === "action.select_indicator.v1")
      )
  );
  const calorimeterLidClosed = Boolean(
    projection.equipment.find(
      ({ equipmentDefinitionId }) =>
        equipmentDefinitionId === "component.calorimeter.v1"
    )?.stateFields.lidClosed ?? true
  );
  const thermometerPlaced = Boolean(
    projection.equipment.find(
      ({ equipmentDefinitionId }) =>
        equipmentDefinitionId === "component.thermometer.v1"
    )?.stateFields.placed
  );

  function handleSelect(equipment: EquipmentId) {
    setLookActive(false);
    setFocused(equipment);
  }

  function handleCanvasKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      if (lookActive) {
        event.preventDefault();
        setLookActive(false);
        return;
      }
      if (focused) {
        event.preventDefault();
        clearFocus();
      }
      return;
    }
    if (event.target !== event.currentTarget) return;
    if (focused) return;

    const steps: Partial<Record<string, LookStepDetail>> = {
      ArrowLeft: { yaw: -1, pitch: 0 },
      ArrowRight: { yaw: 1, pitch: 0 },
      ArrowUp: { yaw: 0, pitch: 1 },
      ArrowDown: { yaw: 0, pitch: -1 }
    };
    const detail = steps[event.key];
    if (!detail) return;

    event.preventDefault();
    event.stopPropagation();
    setLookActive(true);
    window.dispatchEvent(new CustomEvent(LOOK_STEP_EVENT, { detail }));
  }

  function recenterView() {
    setLookActive(false);
    clearFocus();
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event(LOOK_RECENTER_EVENT));
    });
    canvasFrameRef.current?.focus();
  }

  return (
    <section
      className={sceneStyles.scene}
      aria-labelledby="native-scene-heading"
      data-selected-equipment={selected ?? "none"}
      data-look-active={lookActive ? "true" : "false"}
      data-testid="setup-driven-student-bench"
      data-runtime-mode={configuration.mode}
      data-workflow-id={configuration.workflowId ?? undefined}
      data-burette-fill={
        titrationBenchStatus
          ? titrationBenchStatus.buretteFillFraction.toFixed(3)
          : undefined
      }
      data-burette-conditioned={
        titrationBenchStatus
          ? titrationBenchStatus.buretteConditioned
            ? "true"
            : "false"
          : undefined
      }
      data-indicator-added={
        titrationBenchStatus
          ? titrationBenchStatus.indicatorAdded
            ? "true"
            : "false"
          : undefined
      }
      data-procedure-stage={
        titrationBenchStatus ? titrationBenchStatus.procedureStage : undefined
      }
    >
      {/*
       * data-hovered-equipment / data-selectable-equipment expose which item is
       * hovered and which are selectable. The two disagreeing is a real bug
       * class — hover fires but nothing highlights — that the boolean
       * data-hovered alone cannot surface.
       */}
      <div
        ref={canvasFrameRef}
        className={sceneStyles.canvasFrame}
        data-hovered={hovered ? "true" : "false"}
        data-hovered-equipment={hovered ?? "none"}
        data-selectable-equipment={enabled.join(",")}
        data-look-active={lookActive ? "true" : "false"}
        tabIndex={0}
        role="application"
        aria-label="Interactive 3D lab camera"
        onKeyDown={handleCanvasKeyDown}
      >
        <div className={sceneStyles.sceneHud}>
          <div className={sceneStyles.headingRow}>
            <div className={sceneStyles.identityPlaque}>
              <span className={sceneStyles.labMark} aria-hidden="true">
                ⚗
              </span>
              <div>
                <p className={sceneStyles.eyebrow}>Chemistry classroom</p>
                <h2 id="native-scene-heading">Interactive lab bench</h2>
              </div>
            </div>
            {/*
              The workflow status lives in the session bar directly above and is
              not repeated here: it was the same string from the same source,
              rendered twice within 72px, and it crowded out the bench controls
              this HUD exists to hold.
            */}
            <div className={sceneStyles.headingActions}>
              <button
                type="button"
                className={sceneStyles.utilityButton}
                aria-pressed={precisionControlsOpen}
                onClick={() => {
                  setLookActive(false);
                  onPrecisionControlsChange(!precisionControlsOpen);
                }}
              >
                <span aria-hidden="true">⌁</span> Lab steps
              </button>
              <button
                type="button"
                className={sceneStyles.utilityButton}
                aria-pressed={reducedGraphics}
                onClick={() => {
                  setLookActive(false);
                  setReducedGraphics((current) => !current);
                }}
              >
                Reduced graphics
              </button>
              <button
                type="button"
                className={sceneStyles.utilityButton}
                aria-pressed={soundMuted}
                aria-label={
                  soundMuted ? "Unmute lab sounds" : "Mute lab sounds"
                }
                onClick={() => {
                  setLookActive(false);
                  getLabSounds().setMuted(!soundMuted);
                }}
              >
                {soundMuted ? "Sound off" : "Sound on"}
              </button>
              <span className={sceneStyles.readyStatus} role="status">
                <span aria-hidden="true" />
                {webGLReady ? "3D bench ready" : "Starting 3D bench…"}
              </span>
            </div>
          </div>

          <div
            className={sceneStyles.equipmentBar}
            role="group"
            aria-label="Selectable equipment"
          >
            {enabled.map((equipmentId) => (
              <button
                key={equipmentId}
                type="button"
                aria-pressed={focused === equipmentId}
                className={sceneStyles.equipmentButton}
                onClick={() =>
                  focused === equipmentId
                    ? clearFocus()
                    : handleSelect(equipmentId)
                }
                onMouseEnter={() => setHovered(equipmentId)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(equipmentId)}
                onBlur={() => setHovered(null)}
              >
                {EQUIPMENT[equipmentId].name}
              </button>
            ))}
            {focused && (
              <button
                type="button"
                className={sceneStyles.exitButton}
                onClick={clearFocus}
              >
                ← Back to full bench
              </button>
            )}
          </div>

          <p
            className={sceneStyles.prompt}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span aria-hidden="true">✦</span> {prompt}
          </p>
        </div>

        <Canvas
          camera={{
            position: [...CAMERA_POSES.overview.position],
            fov: 42,
            near: 0.03,
            far: 60
          }}
          dpr={[1, 1.5]}
          frameloop="demand"
          gl={{
            antialias: false,
            alpha: false,
            powerPreference: "high-performance"
          }}
          onPointerMissed={() => {
            if (focused) return;
            setLookActive(true);
            canvasFrameRef.current?.focus();
          }}
          onCreated={({ gl }) => {
            setWebGLReady(true);
            if (!gl.capabilities.isWebGL2) setAutoQuality("low");
          }}
          fallback={
            <div className={sceneStyles.fallback} role="status">
              3D preview is unavailable. Lab steps remain fully usable.
            </div>
          }
        >
          <BuretteDispenseProvider
            controller={dispense}
            enabled={selected === "burette" && dispenseEnabled}
          >
            <LabScene
              enabledEquipmentIds={enabled}
              equipmentPoses={configuration.equipmentPoses}
              equipmentFillFractions={configuration.equipmentFillFractions}
              calorimeterLidClosed={calorimeterLidClosed}
              thermometerPlaced={thermometerPlaced}
              hideCalorimeterLid={activeVisualGesture?.kind === "lid"}
              hideThermometer={activeVisualGesture?.kind === "place_probe"}
              hideWashBottle={
                activeVisualGesture?.kind === "pour" &&
                activeVisualGesture.sourceKind === "wash_bottle"
              }
              activeVisualGesture={activeVisualGesture}
              onVisualGestureComplete={onVisualGestureComplete}
              buretteAvailableML={burette?.availableML ?? 0}
              buretteCapacityML={burette?.capacityML ?? 50}
              flaskLiquidColor={getFlaskLiquidColor(flask?.observableColor)}
              selectedIndicator={null}
              indicatorSelectionEnabled={indicatorSelectionEnabled}
              indicatorAddition={null}
              canPrepareBurette={false}
              selectedWashLiquid={null}
              funnelSelected={false}
              quality={quality}
              selected={selected}
              hovered={hovered && enabled.includes(hovered) ? hovered : null}
              onHover={(equipment) => setHovered(equipment)}
              onSelect={handleSelect}
              onIndicatorBottleClick={(indicator) =>
                onIndicatorShelfSelect?.(indicator)
              }
              onIndicatorAdditionComplete={() => undefined}
              onWashBottleClick={() => undefined}
              onTitrantBottleClick={() => undefined}
              onFunnelClick={() => undefined}
            />
          </BuretteDispenseProvider>
        </Canvas>

        {lookActive && (
          <span
            className={sceneStyles.lookChip}
            role="status"
            aria-live="polite"
          >
            Looking around — move cursor to edges to pan · Esc to release
          </span>
        )}

        {selected && (
          <FocusedEquipmentActionPanel
            focused={selected}
            actions={focusedActions}
            equipmentLabels={equipmentLabels}
            actionLabel={actionLabel}
            completedActionMessage={completedActionMessage}
            parameterLabel={parameterLabel}
            parameterValue={parameterValue}
            onParameterChange={onParameterChange}
            onDispatch={onDispatch}
            onClearFocus={clearFocus}
            dispense={
              dispatchDispenseCommit
                ? { controller: dispense, enabled: dispenseEnabled }
                : null
            }
          />
        )}

        <p className={sceneStyles.instructions} aria-live="polite">
          {infoEquipment
            ? `${EQUIPMENT[infoEquipment].name}: ${EQUIPMENT[infoEquipment].purpose}`
            : "Click the bench to look around, or click any equipment to use it."}
        </p>

        <div className={sceneStyles.coachDock}>
          {coachOpen && (
            <div
              className={sceneStyles.coachDialog}
              role="dialog"
              aria-labelledby="native-coach-heading"
            >
              <button
                type="button"
                className={sceneStyles.coachClose}
                aria-label="Close lab coach"
                onClick={() => setCoachOpen(false)}
              >
                ×
              </button>
              <div id="native-coach-heading" className={styles.coachPanelHost}>
                <CoachPanelView
                  messages={coachMessages}
                  status={coachStatus}
                  error={coachError}
                  sessionId={coachSessionId}
                  askCoach={askCoach}
                />
              </div>
            </div>
          )}
          <button
            type="button"
            className={sceneStyles.coachButton}
            aria-expanded={coachOpen}
            onClick={() => setCoachOpen((current) => !current)}
          >
            <span aria-hidden="true">✦</span>
            {coachOpen ? "Hide lab coach" : "Ask lab coach"}
            {coachMessages.length > 0 && (
              <span className={sceneStyles.coachCount}>
                {coachMessages.length}
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          className={sceneStyles.recenterButton}
          onClick={recenterView}
        >
          Recenter view
        </button>
      </div>
    </section>
  );
}

function useSyncMuted(): boolean {
  const [muted, setMuted] = useState(() => getLabSounds().isMuted());
  useEffect(() => {
    const interval = window.setInterval(() => {
      setMuted(getLabSounds().isMuted());
    }, 500);
    return () => window.clearInterval(interval);
  }, []);
  return muted;
}
