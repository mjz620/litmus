"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { Viewer } from "../../lib/auth/roles";

const ViewerContext = createContext<Viewer | null>(null);

/**
 * Carries the server-resolved viewer to client components in the shell. The
 * header has to render the right nav in the first paint — reading the session
 * from the browser Supabase client instead would flash "Sign in" at every
 * signed-in user on every navigation.
 */
export function ViewerProvider({
  viewer,
  children
}: {
  viewer: Viewer | null;
  children: ReactNode;
}) {
  return (
    <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>
  );
}

/** Null for guests, and for client trees rendered outside the provider. */
export function useViewer(): Viewer | null {
  return useContext(ViewerContext);
}
