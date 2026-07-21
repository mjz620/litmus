"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface WebGLContextRecovery {
  /** True between `webglcontextlost` and `webglcontextrestored`. */
  readonly contextLost: boolean;
  /** Remount key for the scene subtree; changes once per restore. */
  readonly sceneKey: number;
  /** Call from the Canvas `onCreated` handler. */
  readonly registerRenderer: (
    canvas: HTMLCanvasElement,
    invalidate: () => void
  ) => void;
}

/**
 * Keeps the bench recoverable when the GPU drops the WebGL context — routine on
 * the Chromebook-class hardware this product targets, where the driver reclaims
 * contexts under memory pressure or after a tab has been backgrounded.
 *
 * Lab state is untouched: the session/engine projection lives outside the
 * Canvas, so only the GPU-resident scene is rebuilt.
 */
export function useWebGLContextRecovery(): WebGLContextRecovery {
  const [contextLost, setContextLost] = useState(false);
  const [sceneKey, setSceneKey] = useState(0);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const invalidateRef = useRef<(() => void) | null>(null);

  const registerRenderer = useCallback(
    (nextCanvas: HTMLCanvasElement, invalidate: () => void) => {
      invalidateRef.current = invalidate;
      setCanvas(nextCanvas);
    },
    []
  );

  useEffect(() => {
    if (!canvas) return;

    function handleContextLost(event: Event) {
      /*
       * Required: the browser only schedules a `webglcontextrestored` if the
       * lost event is cancelled. Without this the bench stays blank until the
       * student reloads the page, which is exactly the failure being fixed.
       */
      event.preventDefault();
      setContextLost(true);
    }

    function handleContextRestored() {
      setContextLost(false);
      /*
       * three's cached GPU resources (textures, geometries, programs) are
       * invalid once the context is gone, so the scene subtree is remounted
       * rather than reused. `frameloop="demand"` means nothing repaints on its
       * own, hence the explicit invalidate.
       */
      setSceneKey((current) => current + 1);
      invalidateRef.current?.();
    }

    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
    };
  }, [canvas]);

  return { contextLost, sceneKey, registerRenderer };
}
