"use client";

import { Canvas } from "@react-three/fiber";
import { useMemo, useState } from "react";

import type { SetupDrivenLabProjection } from "../../../stores/setupDrivenLabSession";
import { useLabUiStore } from "../../../stores/labUiStore";
import { LabScene } from "../three/LabScene";
import { CAMERA_POSES } from "../three/benchLayout";
import {
  resolveTitrationSceneConfiguration,
  type TitrationSceneConfiguration
} from "../titration/setupDrivenScene";
import type { EquipmentId } from "../titration/equipment";

import styles from "./SetupDrivenWorkspace.module.css";

interface ImmersiveSetupDrivenBenchProps {
  readonly projection: Readonly<SetupDrivenLabProjection>;
}

/**
 * Shared immersive ClassroomEnvironment + LabScene path for native
 * (non-compatibility) setup-driven labs such as solution preparation.
 */
export function ImmersiveSetupDrivenBench({
  projection
}: ImmersiveSetupDrivenBenchProps) {
  const focused = useLabUiStore((store) => store.focused);
  const hovered = useLabUiStore((store) => store.hovered);
  const setFocused = useLabUiStore((store) => store.setFocused);
  const setHovered = useLabUiStore((store) => store.setHovered);
  const [sceneError, setSceneError] = useState<string | null>(null);

  const configuration = useMemo((): TitrationSceneConfiguration | null => {
    try {
      const resolved = resolveTitrationSceneConfiguration(projection);
      setSceneError(null);
      return resolved;
    } catch (error) {
      setSceneError(
        error instanceof Error
          ? error.message
          : "The setup-driven scene could not be resolved."
      );
      return null;
    }
  }, [projection]);

  if (sceneError || !configuration) {
    return (
      <div className={styles.bench} role="alert">
        <strong>Lab setup unavailable</strong>
        <span>{sceneError ?? "Scene configuration missing."}</span>
      </div>
    );
  }

  const enabled = configuration.selectableEquipmentIds;
  const burette = configuration.projectedState?.burette;

  return (
    <div
      className={styles.immersiveBench}
      data-testid="setup-driven-student-bench"
      data-runtime-mode={configuration.mode}
      data-workflow-id={configuration.workflowId ?? undefined}
    >
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
        className={styles.benchCanvas}
      >
        <LabScene
          enabledEquipmentIds={enabled}
          equipmentPoses={configuration.equipmentPoses}
          equipmentFillFractions={configuration.equipmentFillFractions}
          buretteAvailableML={burette?.availableML ?? 0}
          buretteCapacityML={burette?.capacityML ?? 50}
          flaskLiquidColor="#dbe9e7"
          selectedIndicator={null}
          indicatorSelectionEnabled={false}
          indicatorAddition={null}
          canPrepareBurette={false}
          selectedWashLiquid={null}
          funnelSelected={false}
          quality="high"
          selected={
            focused && enabled.includes(focused) ? focused : null
          }
          hovered={hovered && enabled.includes(hovered) ? hovered : null}
          onHover={(equipment) => setHovered(equipment)}
          onSelect={(equipment: EquipmentId) => setFocused(equipment)}
          onIndicatorBottleClick={() => undefined}
          onIndicatorAdditionComplete={() => undefined}
          onWashBottleClick={() => undefined}
          onTitrantBottleClick={() => undefined}
          onFunnelClick={() => undefined}
        />
      </Canvas>
    </div>
  );
}
