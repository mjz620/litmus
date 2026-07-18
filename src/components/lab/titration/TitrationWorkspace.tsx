"use client";

import dynamic from "next/dynamic";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";

import { useLabStore } from "../../../stores/labStore";
import { useLabUiStore } from "../../../stores/labUiStore";
import { TitrationControls } from "./TitrationControls";
import { EQUIPMENT, getVisibleControlGroups } from "./equipment";
import {
  resolveTitrationSceneConfiguration,
  visibleControlGroupsForConfiguration
} from "./setupDrivenScene";

import styles from "./TitrationWorkspace.module.css";

// The 3D scene pulls in the three.js chunk; loading it lazily keeps route
// navigation fast and the precision controls immediately interactive.
const TitrationScene = dynamic(
  () => import("./TitrationScene").then((module) => module.TitrationScene),
  {
    ssr: false,
    loading: () => (
      <p className={styles.loading} role="status">
        Loading the 3D bench…
      </p>
    )
  }
);

/**
 * Connects the shared lab UI store to the 3D scene and contextual controls.
 * Focus only filters which controls render and where the camera looks;
 * chemistry stays in the engine behind typed actions.
 */
export function TitrationWorkspace() {
  const focused = useLabUiStore((state) => state.focused);
  const runtimeProjection = useLabStore((state) => state.runtimeProjection);
  const [controlsOpen, setControlsOpen] = useState(false);
  const sceneResolution = useMemo(() => {
    try {
      return {
        configuration: resolveTitrationSceneConfiguration(runtimeProjection),
        error: null
      } as const;
    } catch (error) {
      return {
        configuration: null,
        error:
          error instanceof Error
            ? error.message
            : "The setup-driven scene could not be resolved."
      } as const;
    }
  }, [runtimeProjection]);

  useEffect(
    () => () => {
      const { setFocused, setHovered, setLookActive } =
        useLabUiStore.getState();

      setFocused(null);
      setHovered(null);
      setLookActive(false);
    },
    []
  );

  useEffect(() => {
    const configuration = sceneResolution.configuration;
    if (
      configuration &&
      focused &&
      !configuration.selectableEquipmentIds.includes(focused)
    ) {
      useLabUiStore.getState().clearFocus();
    }
  }, [focused, sceneResolution.configuration]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;

    if (controlsOpen) {
      event.preventDefault();
      event.stopPropagation();
      setControlsOpen(false);
      return;
    }

    const {
      lookActive,
      focused: currentFocus,
      setLookActive,
      clearFocus
    } = useLabUiStore.getState();

    if (lookActive) {
      event.preventDefault();
      event.stopPropagation();
      setLookActive(false);
      return;
    }

    if (!currentFocus) return;

    event.stopPropagation();
    clearFocus();
  }

  if (!sceneResolution.configuration) {
    return (
      <div className={styles.workspace}>
        <div role="alert" className={styles.setupError}>
          <strong>Lab setup unavailable</strong>
          <span>{sceneResolution.error}</span>
        </div>
      </div>
    );
  }

  const configuration = sceneResolution.configuration;
  const visibleGroups =
    configuration.mode === "legacy"
      ? getVisibleControlGroups(focused)
      : visibleControlGroupsForConfiguration(configuration, focused);

  return (
    <div
      className={styles.workspace}
      data-precision-controls-open={controlsOpen ? "true" : "false"}
      data-runtime-mode={configuration.mode}
      data-workflow-id={configuration.workflowId ?? undefined}
      onKeyDown={handleKeyDown}
    >
      <TitrationScene
        configuration={configuration}
        precisionControlsOpen={controlsOpen}
        onPrecisionControlsChange={setControlsOpen}
      />
      {controlsOpen && (
        <div className={styles.drawer} role="presentation">
          <div className={styles.drawerHeader}>
            <div>
              <p>Accessibility surface</p>
              <h2>Precision controls</h2>
              {configuration.mode === "setup_driven_v2" && (
                <span className={styles.setupBadge}>Setup-driven workflow</span>
              )}
            </div>
            <button
              type="button"
              aria-label="Close precision controls"
              onClick={() => setControlsOpen(false)}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <aside className={styles.controlPanel} aria-label="Lab controls">
            <TitrationControls
              visibleGroups={visibleGroups}
              contextLabel={focused ? EQUIPMENT[focused].name : undefined}
              setupDriven={configuration.mode === "setup_driven_v2"}
              maxDispenseVolumeML={configuration.maxDispenseVolumeML}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
