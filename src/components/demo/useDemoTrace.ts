"use client";

import { useMemo, useSyncExternalStore } from "react";

import {
  DEMO_TRACE_STORAGE_KEY,
  readDemoTrace,
  type DemoTrace
} from "../../lib/demo/demoTrace";

function subscribe(onStoreChange: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === DEMO_TRACE_STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}

function getSnapshot(): string | null {
  return localStorage.getItem(DEMO_TRACE_STORAGE_KEY);
}

function getServerSnapshot(): null {
  return null;
}

export function useDemoTrace(): DemoTrace | null {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(
    () => (raw === null ? null : readDemoTrace({ getItem: () => raw })),
    [raw]
  );
}
