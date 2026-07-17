"use client";

import { Canvas } from "@react-three/fiber";
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState
} from "react";

import type { SemanticEvent } from "../../../experiments/shared";
import { formatBuretteVolume } from "../../../experiments/titration/display";
import type { TitrationState } from "../../../experiments/titration/titration";
import { useLabStore } from "../../../stores/labStore";
import { useLabUiStore } from "../../../stores/labUiStore";
import {
  LOOK_RECENTER_EVENT,
  LOOK_STEP_EVENT,
  type LookStepDetail
} from "../three/BenchCameraControls";
import { BuretteDispenseProvider } from "../three/Burette";
import { LabScene } from "../three/LabScene";
import { CAMERA_POSES } from "../three/benchLayout";
import type { GlassQuality } from "../three/glassMaterials";
import {
  getBuretteFillFraction,
  getFlaskLiquidColor
} from "../three/sceneProjection";
import { EQUIPMENT, EQUIPMENT_IDS, type EquipmentId } from "./equipment";
import {
  getProcedureStage,
  type TitrationProcedureStage
} from "./procedureStage";
import { useDispenseGesture } from "./useDispenseGesture";
import { useTitrationIntents } from "./useTitrationIntents";

import styles from "./TitrationScene.module.css";

const PROMPT_STRIP_STYLE: CSSProperties = {
  position: "absolute",
  top: "0.75rem",
  right: "0.75rem",
  left: "0.75rem",
  zIndex: 2,
  margin: 0,
  padding: "0.48rem 0.75rem",
  border: "1px solid rgba(15, 118, 110, 0.3)",
  borderRadius: "0.7rem",
  background: "rgba(255, 255, 255, 0.94)",
  boxShadow: "0 0.3rem 0.9rem rgba(15, 23, 42, 0.12)",
  color: "#115e59",
  fontSize: "0.78rem",
  fontWeight: 700,
  lineHeight: 1.35,
  pointerEvents: "none"
};

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
  state: Pick<TitrationState, "titrantAddedML">,
  nearEndpoint: boolean,
  endpointOvershot: boolean
): string {
  switch (stage) {
    case "prepare_burette":
      return "Next: use the wash station to rinse with titrant, then fill the burette.";
    case "add_titrant":
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
 * focusable buttons, and frames the camera on the selection. Precision
 * actions stay in the 2D contextual controls.
 */
export function TitrationScene() {
  const canvasFrameRef = useRef<HTMLDivElement>(null);
  const [webGLReady, setWebGLReady] = useState(false);
  const [autoQuality, setAutoQuality] = useState<GlassQuality>("high");
  const [reducedGraphics, setReducedGraphics] = useState(false);
  const state = useLabStore((store) => store.state);
  const eventQueue = useLabStore((store) => store.eventQueue);
  const focused = useLabUiStore((store) => store.focused);
  const hovered = useLabUiStore((store) => store.hovered);
  const lookActive = useLabUiStore((store) => store.lookActive);
  const setFocused = useLabUiStore((store) => store.setFocused);
  const setHovered = useLabUiStore((store) => store.setHovered);
  const setLookActive = useLabUiStore((store) => store.setLookActive);
  const clearFocus = useLabUiStore((store) => store.clearFocus);
  const titrationIntents = useTitrationIntents();
  const physicalDispense = useDispenseGesture({
    availableML: state?.buretteAvailableML ?? 0
  });

  useEffect(() => {
    if (focused) setLookActive(false);
  }, [focused, setLookActive]);

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
  const canPrepareBurette =
    state.titrantAddedML === 0 && state.buretteAvailableML === 0;
  const latestObservedColor = eventQueue.findLast(
    ({ observation }) => typeof observation.observedColor === "string"
  )?.observation.observedColor;
  const fillFraction = getBuretteFillFraction(
    state.buretteAvailableML,
    state.config.buretteCapacityML
  );
  const flaskLiquidColor = getFlaskLiquidColor(
    typeof latestObservedColor === "string" ? latestObservedColor : undefined
  );
  const procedureStage = getProcedureStage(state, eventQueue);
  const nearEndpoint = isNearEndpointProjection(state, eventQueue);
  const endpointOvershot = hasRecentEndpointOvershoot(eventQueue);
  const contextualPrompt = getContextualPrompt(
    procedureStage,
    state,
    nearEndpoint,
    endpointOvershot
  );
  const infoEquipment = hovered ?? focused;
  const visualSummary = `3D chemistry lab. Burette contains ${formatBuretteVolume(state.buretteAvailableML)} mL of ${formatBuretteVolume(state.config.buretteCapacityML)} mL capacity. Flask liquid appears ${latestObservedColor ?? "colorless"}.`;

  function handleSelect(equipment: EquipmentId) {
    setLookActive(false);
    setFocused(equipment);
  }

  function handleCanvasKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
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
    window.dispatchEvent(new Event(LOOK_RECENTER_EVENT));
    canvasFrameRef.current?.focus();
  }

  return (
    <section
      className={styles.scene}
      aria-labelledby="three-scene-heading"
      data-burette-fill={fillFraction.toFixed(3)}
      data-flask-color={latestObservedColor ?? "colorless"}
      data-selected-equipment={focused ?? "none"}
      data-look-active={lookActive ? "true" : "false"}
      data-dispensing={physicalDispense.state.isHolding ? "true" : "false"}
      data-pending-ml={physicalDispense.state.pendingML.toFixed(3)}
      data-procedure-stage={procedureStage}
      data-near-endpoint={nearEndpoint ? "true" : "false"}
    >
      <div className={styles.headingRow}>
        <div>
          <p className={styles.eyebrow}>Chemistry classroom</p>
          <h2 id="three-scene-heading">Interactive lab bench</h2>
        </div>
        <div className={styles.headingActions}>
          <span className={styles.status} role="status" aria-live="polite">
            {physicalDispense.state.isHolding
              ? `${physicalDispense.state.pendingML.toFixed(3)} mL pending`
              : "Valve closed"}
          </span>
          <button
            type="button"
            className={styles.qualityToggle}
            aria-pressed={reducedGraphics}
            onClick={() => setReducedGraphics((current) => !current)}
          >
            Reduced graphics
          </button>
          <span className={styles.status} role="status" aria-live="polite">
            {webGLReady ? "3D bench ready" : "Starting 3D bench…"}
          </span>
        </div>
      </div>

      <div
        className={styles.equipmentBar}
        role="group"
        aria-label="Selectable equipment"
      >
        {EQUIPMENT_IDS.map((equipmentId) => (
          <button
            key={equipmentId}
            type="button"
            aria-pressed={focused === equipmentId}
            className={styles.equipmentButton}
            onClick={() =>
              focused === equipmentId ? clearFocus() : handleSelect(equipmentId)
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

      <p className={styles.instructions} aria-live="polite">
        {infoEquipment
          ? `${EQUIPMENT[infoEquipment].name}: ${EQUIPMENT[infoEquipment].purpose}${infoEquipment === "burette" && focused === "burette" ? " Drag the white stopcock handle downward through the flow detents; release it to close the valve." : ""}`
          : "Click the simulation panel to initiate panning, then move the cursor toward its edges. Select equipment to focus on it; precise actions stay in the controls panel."}
      </p>
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
        <p
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-contextual-prompt={procedureStage}
          style={{
            ...PROMPT_STRIP_STYLE,
            top: lookActive ? "3.6rem" : PROMPT_STRIP_STYLE.top
          }}
        >
          {contextualPrompt}
        </p>
        <Canvas
          camera={{ position: [...CAMERA_POSES.overview.position], fov: 42 }}
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
            enabled={focused === "burette"}
          >
            <LabScene
              buretteAvailableML={state.buretteAvailableML}
              buretteCapacityML={state.config.buretteCapacityML}
              flaskLiquidColor={flaskLiquidColor}
              selectedIndicator={state.config.indicator}
              canPrepareBurette={canPrepareBurette}
              quality={quality}
              selected={focused}
              hovered={hovered}
              onHover={setHovered}
              onSelect={handleSelect}
              onIndicatorBottleClick={titrationIntents.onIndicatorBottleClick}
              onWashBottleClick={titrationIntents.onWashBottleClick}
              onTitrantBottleClick={titrationIntents.onTitrantBottleClick}
              onFunnelClick={titrationIntents.onFunnelClick}
            />
          </BuretteDispenseProvider>
        </Canvas>
        {lookActive && (
          <span className={styles.lookChip} role="status" aria-live="polite">
            Looking around — move cursor to edges to pan · Esc to release
          </span>
        )}
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
