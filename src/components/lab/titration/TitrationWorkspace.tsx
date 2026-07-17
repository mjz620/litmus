"use client";

import dynamic from "next/dynamic";
import { type KeyboardEvent, useEffect } from "react";

import { useLabUiStore } from "../../../stores/labUiStore";
import { TitrationControls } from "./TitrationControls";
import { EQUIPMENT, getVisibleControlGroups } from "./equipment";

import styles from "./TitrationWorkspace.module.css";

// The 3D scene pulls in the three.js chunk; loading it lazily keeps route
// navigation fast and the precision controls immediately interactive.
const TitrationScene = dynamic(
  () => import("./TitrationScene").then((module) => module.TitrationScene),
  {
    ssr: false,
    loading: () => <p role="status">Loading the 3D bench…</p>
  }
);

/**
 * Connects the shared lab UI store to the 3D scene and contextual controls.
 * Focus only filters which controls render and where the camera looks;
 * chemistry stays in the engine behind typed actions.
 */
export function TitrationWorkspace() {
  const focused = useLabUiStore((state) => state.focused);

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

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;

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

  return (
    <div className={styles.workspace} onKeyDown={handleKeyDown}>
      <TitrationScene />
      <aside className={styles.controlPanel} aria-label="Lab controls">
        <TitrationControls
          visibleGroups={getVisibleControlGroups(focused)}
          contextLabel={focused ? EQUIPMENT[focused].name : undefined}
        />
      </aside>
    </div>
  );
}
