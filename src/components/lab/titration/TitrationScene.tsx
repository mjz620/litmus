"use client";

import { Canvas } from "@react-three/fiber";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore
} from "react";

import { CoachPanel } from "../../coach/CoachPanel";
import type { SemanticEvent } from "../../../experiments/shared";
import { formatBuretteVolume } from "../../../experiments/titration/display";
import type { TitrationState } from "../../../experiments/titration/titration";
import { isTitrationState, useLabStore } from "../../../stores/labStore";
import { useLabUiStore } from "../../../stores/labUiStore";
import {
  LOOK_RECENTER_EVENT,
  LOOK_STEP_EVENT,
  type LookStepDetail
} from "../three/BenchCameraControls";
import { BuretteDispenseProvider } from "../three/Burette";
import { LabScene } from "../three/LabScene";
import type { WashLiquid } from "../three/WashStation";
import { CAMERA_POSES } from "../three/benchLayout";
import type { GlassQuality } from "../three/glassMaterials";
import { getLabSounds } from "../three/labSounds";
import {
  getBuretteFillFraction,
  getFlaskLiquidColor
} from "../three/sceneProjection";
import { EQUIPMENT, type EquipmentId } from "./equipment";
import {
  getIndicatorLabel,
  IndicatorSelectionDialog
} from "./IndicatorSelectionDialog";
import {
  getProcedureStage,
  type TitrationProcedureStage
} from "./procedureStage";
import { DISPENSE_RESIDUE_ML, useDispenseGesture } from "./useDispenseGesture";
import { useTitrationIntents } from "./useTitrationIntents";
import type { TitrationSceneConfiguration } from "./setupDrivenScene";

import styles from "./TitrationScene.module.css";

const NEAR_ENDPOINT_EVIDENCE = new Set([
  "flow_rate_high_near_endpoint",
  "controlled_addition_near_endpoint"
]);

function isNearEndpointProjection(
  state: Pick<TitrationState, "buretteAvailableML" | "curve">,
  events: readonly SemanticEvent[]
): boolean {
  if (state.buretteAvailableML <= 0) return false;

  const recentCurve = state.curve.slice(-3);
  for (let index = 1; index < recentCurve.length; index += 1) {
    const previous = recentCurve[index - 1]!;
    const current = recentCurve[index]!;
    const volumeDelta = current.volumeML - previous.volumeML;
    if (volumeDelta <= 0) continue;

    const observedSlope = Math.abs(current.pH - previous.pH) / volumeDelta;
    if (observedSlope >= 1) return true;
  }

  return events
    .slice(-4)
    .some(
      (event) =>
        event.flags.includes("flow_rate_high_near_endpoint") ||
        event.evidence.some(({ reason }) => NEAR_ENDPOINT_EVIDENCE.has(reason))
    );
}

function hasRecentEndpointOvershoot(events: readonly SemanticEvent[]): boolean {
  return events
    .slice(-4)
    .some(({ flags }) => flags.includes("endpoint_overshoot"));
}

function getContextualPrompt(
  stage: TitrationProcedureStage,
  state: Pick<TitrationState, "indicatorAdded" | "titrantAddedML">,
  nearEndpoint: boolean,
  endpointOvershot: boolean
): string {
  switch (stage) {
    case "prepare_burette":
      return "Next: use the wash station to rinse with titrant, then fill the burette.";
    case "add_titrant":
      if (!state.indicatorAdded) {
        return "Next: review one indicator's transition range, then confirm adding it to the flask.";
      }
      if (endpointOvershot) {
        return "Endpoint passed: close the stopcock and record the burette reading.";
      }
      if (nearEndpoint) {
        return "Endpoint is close: switch the stopcock to Dropwise and watch for a lasting color change.";
      }
      if (state.titrantAddedML === 0) {
        return "Next: focus the burette, open the stopcock gently, and watch the flask while titrant is added.";
      }
      return "Continue titrating while watching both the burette volume and flask color.";
    case "record_results":
      return "Next: read the bottom of the concave meniscus, then record your result.";
    case "report_submitted":
      return "Report submitted. Review the recorded observations and feedback.";
  }
}

/**
 * The visual chemistry lab. Renders engine-state projections, exposes
 * selectable equipment through both 3D pointer interaction and keyboard
 * focusable buttons, and frames the camera on the selection. The equipment
 * rail, coach, and optional accessibility controls live over the bench so the
 * simulation remains the student's primary workspace.
 */
interface TitrationSceneProps {
  configuration: Readonly<TitrationSceneConfiguration>;
  precisionControlsOpen: boolean;
  onPrecisionControlsChange: (open: boolean) => void;
}

export function TitrationScene({
  configuration,
  precisionControlsOpen,
  onPrecisionControlsChange
}: TitrationSceneProps) {
  const canvasFrameRef = useRef<HTMLDivElement>(null);
  const [webGLReady, setWebGLReady] = useState(false);
  const [autoQuality, setAutoQuality] = useState<GlassQuality>("high");
  const [reducedGraphics, setReducedGraphics] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const latestCoachMessageRef = useRef<string | null>(null);
  const [pendingIndicator, setPendingIndicator] = useState<
    TitrationState["config"]["indicator"] | null
  >(null);
  const [indicatorAddition, setIndicatorAddition] = useState<{
    indicator: TitrationState["config"]["indicator"];
    sequence: number;
  } | null>(null);
  const [selectedWashLiquid, setSelectedWashLiquid] =
    useState<WashLiquid | null>(null);
  const [funnelSelected, setFunnelSelected] = useState(false);
  const [indicatorActivity, setIndicatorActivity] = useState<string | null>(
    null
  );
  const state = useLabStore((store) =>
    isTitrationState(store.state) ? store.state : null
  );
  const eventQueue = useLabStore((store) => store.eventQueue);
  const coachMessages = useLabStore((store) => store.coachMessages);
  const sessionId = useLabStore((store) => store.sessionId);
  const focused = useLabUiStore((store) => store.focused);
  const hovered = useLabUiStore((store) => store.hovered);
  const lookActive = useLabUiStore((store) => store.lookActive);
  const setFocused = useLabUiStore((store) => store.setFocused);
  const setHovered = useLabUiStore((store) => store.setHovered);
  const setLookActive = useLabUiStore((store) => store.setLookActive);
  const clearFocus = useLabUiStore((store) => store.clearFocus);
  const titrationIntents = useTitrationIntents();
  const deliveryAvailable =
    configuration.availableControlGroups.includes("deliver");
  const projectedBurette = configuration.projectedState?.burette;
  const projectedFlask = configuration.projectedState?.flask;
  const visualBuretteAvailableML =
    projectedBurette?.availableML ?? state?.buretteAvailableML ?? 0;
  const physicalDispenseMinimumML =
    configuration.minDispenseVolumeML ?? DISPENSE_RESIDUE_ML;
  // Keep true burette remaining as gesture capacity. Workflow maxVolumeMLPerAction
  // is a per-commit ceiling (via maximumCommitML), not a fake empty-burette limit —
  // capping availableML here made open-valve drag stop after one 0.5 mL chunk.
  const physicalDispenseAvailableML = state ? visualBuretteAvailableML : 0;
  const physicalDispenseEnabled = Boolean(
    state &&
    deliveryAvailable &&
    (projectedFlask?.indicatorAdded ?? state.indicatorAdded) &&
    physicalDispenseAvailableML >= physicalDispenseMinimumML
  );
  const physicalDispense = useDispenseGesture({
    availableML: physicalDispenseAvailableML,
    minimumCommitML: physicalDispenseMinimumML,
    maximumCommitML: configuration.maxDispenseVolumeML,
    enabled: physicalDispenseEnabled,
    onCommit: () => {
      const sounds = getLabSounds();
      sounds.playFromGesture("drop");
      const latestEvent = useLabStore.getState().eventQueue.at(-1);
      if (
        latestEvent &&
        (latestEvent.flags.includes("endpoint_overshoot") ||
          latestEvent.evidence.some(
            ({ reason }) => reason === "controlled_addition_near_endpoint"
          ))
      ) {
        sounds.playFromGesture("endpoint", sessionId ?? "unscoped-session");
      }
    },
    onDetentChange: () => getLabSounds().playFromGesture("valve"),
    onGestureStart: () => getLabSounds().playFromGesture("valve"),
    onGestureEnd: () => getLabSounds().playFromGesture("valve")
  });
  const soundMuted = useSyncExternalStore(
    (listener) => getLabSounds().subscribe(listener),
    () => getLabSounds().isMuted(),
    () => true
  );

  useEffect(() => {
    if (focused) setLookActive(false);
  }, [focused, setLookActive]);

  useEffect(() => {
    const latestCoachMessage = coachMessages.findLast(
      (message) => message.role === "coach"
    );
    if (!latestCoachMessage) return;
    if (latestCoachMessageRef.current === latestCoachMessage.id) return;

    latestCoachMessageRef.current = latestCoachMessage.id;
    setCoachOpen(true);
  }, [coachMessages]);

  useEffect(() => {
    if (!indicatorActivity) return;

    const timeout = window.setTimeout(() => setIndicatorActivity(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [indicatorActivity]);

  useEffect(() => {
    const frame = canvasFrameRef.current;
    if (!frame) return;

    const containScroll = (event: WheelEvent | TouchEvent) => {
      if (useLabUiStore.getState().lookActive) event.preventDefault();
    };

    frame.addEventListener("wheel", containScroll, { passive: false });
    frame.addEventListener("touchmove", containScroll, { passive: false });

    return () => {
      frame.removeEventListener("wheel", containScroll);
      frame.removeEventListener("touchmove", containScroll);
    };
  }, []);

  useEffect(() => {
    if (!lookActive) return;

    const frame = canvasFrameRef.current;
    if (!frame) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!frame.contains(event.target as Node)) setLookActive(false);
    };
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;

      event.preventDefault();
      event.stopPropagation();
      setLookActive(false);
    };
    const handleBlur = () => setLookActive(false);

    document.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleEscape, true);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleEscape, true);
      window.removeEventListener("blur", handleBlur);
    };
  }, [lookActive, setLookActive]);

  useEffect(
    () => () => {
      useLabUiStore.getState().setLookActive(false);
    },
    []
  );

  if (!state) return null;

  const quality: GlassQuality = reducedGraphics ? "low" : autoQuality;
  const prepareAvailable =
    configuration.availableControlGroups.includes("prepare");
  const indicatorAvailable =
    configuration.availableControlGroups.includes("indicator");
  const visualBuretteCapacityML =
    projectedBurette?.capacityML ?? state.config.buretteCapacityML;
  const indicatorAdded = projectedFlask?.indicatorAdded ?? state.indicatorAdded;
  const canPrepareBurette =
    prepareAvailable &&
    (state.fillCount === 0 ||
      state.buretteAvailableML < state.config.buretteCapacityML);
  const hasRinsedBurette =
    state.buretteConditioned || state.titrantDilutionFactor < 1;
  const needsRinse =
    state.fillCount === 0 &&
    state.buretteAvailableML === 0 &&
    !hasRinsedBurette;
  const washSetupComplete = Boolean(selectedWashLiquid && funnelSelected);
  const canConfirmWashSetup =
    washSetupComplete &&
    (needsRinse || selectedWashLiquid === "titrant") &&
    canPrepareBurette;
  const latestObservedColor =
    projectedFlask?.observableColor ??
    eventQueue.findLast(
      ({ observation }) => typeof observation.observedColor === "string"
    )?.observation.observedColor;
  const fillFraction = getBuretteFillFraction(
    visualBuretteAvailableML,
    visualBuretteCapacityML
  );
  const flaskLiquidColor = getFlaskLiquidColor(
    typeof latestObservedColor === "string" ? latestObservedColor : undefined
  );
  const procedureStage = getProcedureStage(state, eventQueue);
  const nearEndpoint = isNearEndpointProjection(state, eventQueue);
  const endpointOvershot = hasRecentEndpointOvershoot(eventQueue);
  const contextualPrompt =
    configuration.mode === "setup_driven_v2" &&
    configuration.availableControlGroups.includes("reading")
      ? "Next: focus the meniscus and record the displayed burette reading before dispensing."
      : configuration.mode === "setup_driven_v2" && deliveryAvailable
        ? "Reading recorded. Focus the burette and add titrant within the workflow limit."
        : getContextualPrompt(
            procedureStage,
            state,
            nearEndpoint,
            endpointOvershot
          );
  const infoEquipment = hovered ?? focused;
  const visualSummary = `3D chemistry lab. Burette contains ${formatBuretteVolume(visualBuretteAvailableML)} mL of ${formatBuretteVolume(visualBuretteCapacityML)} mL capacity. Flask liquid appears ${latestObservedColor ?? "colorless"}.`;

  function handleSelect(equipment: EquipmentId) {
    if (!configuration.selectableEquipmentIds.includes(equipment)) return;
    setLookActive(false);
    setFocused(equipment);
  }

  function handleCanvasKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
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

  function handleIndicatorBottleClick(
    indicator: TitrationState["config"]["indicator"]
  ) {
    if (indicatorAdded) return;
    setPendingIndicator(indicator);
  }

  function confirmIndicatorAddition() {
    if (!pendingIndicator || indicatorAdded) return;
    titrationIntents.onIndicatorBottleClick(pendingIndicator);
    setIndicatorAddition((current) => ({
      indicator: pendingIndicator,
      sequence: (current?.sequence ?? 0) + 1
    }));
    setIndicatorActivity(
      `Adding ${getIndicatorLabel(pendingIndicator)} to the flask…`
    );
    setPendingIndicator(null);
    setFocused("flask");
  }

  function confirmWashSetup() {
    if (!selectedWashLiquid || !funnelSelected || !canConfirmWashSetup) return;

    if (needsRinse) {
      if (selectedWashLiquid === "water") {
        titrationIntents.onWashBottleClick();
      } else {
        titrationIntents.onTitrantBottleClick();
      }
      setIndicatorActivity(
        `Burette rinsed with ${selectedWashLiquid}. Keep titrant and the funnel selected to fill.`
      );
      return;
    }

    titrationIntents.onFunnelClick();
    setIndicatorActivity("Burette filled through the selected funnel.");
    setSelectedWashLiquid(null);
    setFunnelSelected(false);
  }

  return (
    <section
      className={styles.scene}
      aria-labelledby="three-scene-heading"
      data-burette-fill={fillFraction.toFixed(3)}
      data-burette-conditioned={state.buretteConditioned ? "true" : "false"}
      data-burette-fill-count={state.fillCount}
      data-flask-color={latestObservedColor ?? "colorless"}
      data-selected-indicator={
        state.indicatorAdded ? state.config.indicator : "none"
      }
      data-indicator-added={state.indicatorAdded ? "true" : "false"}
      data-wash-liquid={selectedWashLiquid ?? "none"}
      data-funnel-selected={funnelSelected ? "true" : "false"}
      data-selected-equipment={focused ?? "none"}
      data-look-active={lookActive ? "true" : "false"}
      data-dispensing={physicalDispense.state.isHolding ? "true" : "false"}
      data-pending-ml={physicalDispense.state.pendingML.toFixed(3)}
      data-procedure-stage={procedureStage}
      data-near-endpoint={nearEndpoint ? "true" : "false"}
    >
      <p className={styles.srSummary}>{visualSummary}</p>

      <div
        ref={canvasFrameRef}
        className={styles.canvasFrame}
        data-hovered={hovered ? "true" : "false"}
        data-look-active={lookActive ? "true" : "false"}
        tabIndex={0}
        role="application"
        aria-label="Interactive 3D lab camera"
        onKeyDown={handleCanvasKeyDown}
      >
        <div className={styles.sceneHud}>
          <div className={styles.headingRow}>
            <div className={styles.identityPlaque}>
              <span className={styles.labMark} aria-hidden="true">
                ⚗
              </span>
              <div>
                <p className={styles.eyebrow}>Chemistry classroom</p>
                <h2 id="three-scene-heading">Interactive lab bench</h2>
              </div>
            </div>
            <div className={styles.headingActions}>
              <span className={styles.status} role="status" aria-live="polite">
                {physicalDispense.state.isHolding
                  ? `${physicalDispense.state.pendingML.toFixed(3)} mL pending`
                  : "Valve closed"}
              </span>
              <button
                type="button"
                className={styles.utilityButton}
                aria-pressed={precisionControlsOpen}
                onClick={() => {
                  setLookActive(false);
                  onPrecisionControlsChange(!precisionControlsOpen);
                }}
              >
                <span aria-hidden="true">⌁</span> Precision controls
              </button>
              <button
                type="button"
                className={styles.utilityButton}
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
                className={styles.utilityButton}
                aria-pressed={soundMuted}
                aria-label={
                  soundMuted ? "Unmute lab sounds" : "Mute lab sounds"
                }
                onClick={() => {
                  setLookActive(false);
                  const nextMuted = !soundMuted;
                  getLabSounds().setMuted(nextMuted);
                }}
              >
                {soundMuted ? "Sound off" : "Sound on"}
              </button>
              <span className={styles.readyStatus} role="status">
                <span aria-hidden="true" />
                {webGLReady ? "3D bench ready" : "Starting 3D bench…"}
              </span>
            </div>
          </div>

          <div
            className={styles.equipmentBar}
            role="group"
            aria-label="Selectable equipment"
          >
            {configuration.selectableEquipmentIds.map((equipmentId) => (
              <button
                key={equipmentId}
                type="button"
                aria-pressed={focused === equipmentId}
                className={styles.equipmentButton}
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
                className={styles.exitButton}
                onClick={clearFocus}
              >
                ← Back to full bench
              </button>
            )}
          </div>

          <p
            className={styles.prompt}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-contextual-prompt={procedureStage}
          >
            <span aria-hidden="true">✦</span> {contextualPrompt}
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
            <div className={styles.fallback} role="status">
              3D preview is unavailable. The precision controls remain fully
              usable.
            </div>
          }
        >
          <BuretteDispenseProvider
            controller={physicalDispense}
            enabled={
              focused === "burette" && indicatorAdded && deliveryAvailable
            }
          >
            <LabScene
              enabledEquipmentIds={configuration.selectableEquipmentIds}
              equipmentPoses={configuration.equipmentPoses}
              equipmentFillFractions={configuration.equipmentFillFractions}
              buretteAvailableML={visualBuretteAvailableML}
              buretteCapacityML={visualBuretteCapacityML}
              flaskLiquidColor={flaskLiquidColor}
              selectedIndicator={indicatorAdded ? state.config.indicator : null}
              indicatorSelectionEnabled={indicatorAvailable && !indicatorAdded}
              indicatorAddition={indicatorAddition}
              canPrepareBurette={canPrepareBurette}
              selectedWashLiquid={selectedWashLiquid}
              funnelSelected={funnelSelected}
              quality={quality}
              selected={focused}
              hovered={hovered}
              onHover={setHovered}
              onSelect={handleSelect}
              onIndicatorBottleClick={handleIndicatorBottleClick}
              onIndicatorAdditionComplete={(sequence) => {
                setIndicatorAddition((current) =>
                  current?.sequence === sequence ? null : current
                );
              }}
              onWashBottleClick={() => setSelectedWashLiquid("water")}
              onTitrantBottleClick={() => setSelectedWashLiquid("titrant")}
              onFunnelClick={() => setFunnelSelected((current) => !current)}
            />
          </BuretteDispenseProvider>
        </Canvas>
        {lookActive && (
          <span className={styles.lookChip} role="status" aria-live="polite">
            Looking around — move cursor to edges to pan · Esc to release
          </span>
        )}
        {indicatorActivity && (
          <p className={styles.activityToast} role="status" aria-live="polite">
            {indicatorActivity}
          </p>
        )}
        {focused === "washStation" && (
          <section
            className={styles.washSetup}
            aria-labelledby="wash-setup-heading"
          >
            <p className={styles.washEyebrow}>Selected preparation setup</p>
            <h3 id="wash-setup-heading">Liquid + funnel required</h3>
            <div className={styles.washSelections} aria-live="polite">
              <span data-selected={selectedWashLiquid ? "true" : "false"}>
                Liquid: {selectedWashLiquid ?? "not selected"}
              </span>
              <span data-selected={funnelSelected ? "true" : "false"}>
                Funnel: {funnelSelected ? "selected" : "not selected"}
              </span>
            </div>
            <p>
              {needsRinse
                ? "Choose distilled water or titrant and select the funnel before rinsing."
                : state.buretteAvailableML === 0
                  ? "Rinse complete. Select titrant and the funnel to fill the burette."
                  : "Select titrant and the funnel before adding a refill."}
            </p>
            <button
              type="button"
              disabled={!canConfirmWashSetup}
              onClick={confirmWashSetup}
            >
              {needsRinse
                ? selectedWashLiquid
                  ? `Rinse with ${selectedWashLiquid}`
                  : "Complete rinse setup"
                : state.fillCount === 0
                  ? "Fill burette"
                  : "Add refill"}
            </button>
          </section>
        )}
        {pendingIndicator && !state.indicatorAdded && (
          <IndicatorSelectionDialog
            indicator={pendingIndicator}
            onCancel={() => setPendingIndicator(null)}
            onConfirm={confirmIndicatorAddition}
          />
        )}
        <p className={styles.instructions} aria-live="polite">
          {infoEquipment
            ? `${EQUIPMENT[infoEquipment].name}: ${EQUIPMENT[infoEquipment].purpose}${infoEquipment === "burette" && focused === "burette" ? " Drag the bright blue stopcock handle downward through the flow detents; release it to close the valve." : ""}`
            : "Click the simulation panel to initiate panning, then move the cursor toward its edges. Select equipment to focus on it."}
        </p>
        <div className={styles.coachDock}>
          {coachOpen && (
            <div
              className={styles.coachDialog}
              role="dialog"
              aria-labelledby="coach-heading"
            >
              <button
                type="button"
                className={styles.coachClose}
                aria-label="Close lab coach"
                onClick={() => setCoachOpen(false)}
              >
                ×
              </button>
              <CoachPanel />
            </div>
          )}
          <button
            type="button"
            className={styles.coachButton}
            aria-expanded={coachOpen}
            aria-controls="coach-heading"
            onClick={() => setCoachOpen((current) => !current)}
          >
            <span aria-hidden="true">✦</span>
            {coachOpen ? "Hide lab coach" : "Ask lab coach"}
            {coachMessages.length > 0 && (
              <span className={styles.coachCount}>{coachMessages.length}</span>
            )}
          </button>
        </div>
        <button
          type="button"
          className={styles.recenterButton}
          onClick={recenterView}
        >
          Recenter view
        </button>
      </div>
    </section>
  );
}
