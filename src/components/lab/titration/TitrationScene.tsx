"use client";

import { Canvas } from "@react-three/fiber";
import { useState } from "react";

import { formatBuretteVolume } from "../../../experiments/titration/display";
import { useLabStore } from "../../../stores/labStore";
import { LabScene } from "../three/LabScene";
import {
  getBuretteFillFraction,
  getFlaskLiquidColor
} from "../three/sceneProjection";

import styles from "./TitrationScene.module.css";

export function TitrationScene() {
  const [webGLReady, setWebGLReady] = useState(false);
  const state = useLabStore((store) => store.state);
  const eventQueue = useLabStore((store) => store.eventQueue);

  if (!state) return null;

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
  const visualSummary = `3D lab bench. Burette contains ${formatBuretteVolume(state.buretteAvailableML)} mL of ${formatBuretteVolume(state.config.buretteCapacityML)} mL capacity. Flask liquid appears ${latestObservedColor ?? "colorless"}.`;

  return (
    <section
      className={styles.scene}
      aria-labelledby="three-scene-heading"
      data-burette-fill={fillFraction.toFixed(3)}
      data-flask-color={latestObservedColor ?? "colorless"}
    >
      <div className={styles.headingRow}>
        <div>
          <p className={styles.eyebrow}>Low-poly visualization</p>
          <h2 id="three-scene-heading">Interactive lab bench</h2>
        </div>
        <span className={styles.status} role="status" aria-live="polite">
          {webGLReady ? "3D bench ready" : "Starting 3D bench…"}
        </span>
      </div>
      <p className={styles.instructions}>
        Drag to look around. Scroll to zoom. Precise actions remain in the 2D
        controls below.
      </p>
      <p className={styles.srSummary}>{visualSummary}</p>

      <div className={styles.canvasFrame}>
        <Canvas
          camera={{ position: [7, 5.2, 8], fov: 42 }}
          dpr={[1, 1.5]}
          frameloop="demand"
          gl={{
            antialias: false,
            alpha: false,
            powerPreference: "high-performance"
          }}
          onCreated={() => setWebGLReady(true)}
          fallback={
            <div className={styles.fallback} role="status">
              3D preview is unavailable. The precision controls remain fully
              usable.
            </div>
          }
        >
          <LabScene
            buretteFillFraction={fillFraction}
            flaskLiquidColor={flaskLiquidColor}
          />
        </Canvas>
      </div>
    </section>
  );
}
