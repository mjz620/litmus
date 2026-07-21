/*
 * Role vocabulary and routing policy, kept free of Supabase and next/headers so
 * both client components and plain unit tests can import it.
 */

export type ViewerRole = "student" | "teacher";

export interface Viewer {
  readonly userId: string;
  readonly email: string | null;
  readonly name: string | null;
  /**
   * Null only between the OAuth callback and the /auth/role step. Every other
   * surface can treat a null role as "signup unfinished", not "guest".
   */
  readonly role: ViewerRole | null;
}

export function readViewerRole(value: unknown): ViewerRole | null {
  return value === "student" || value === "teacher" ? value : null;
}

/**
 * Where an account belongs after sign-in. Students landed on /assignments from
 * the OAuth callback but /experiments from the role picker; one function now
 * answers for both.
 */
export function roleHomePath(role: ViewerRole | null): string {
  if (role === "teacher") return "/teacher/classes";
  if (role === "student") return "/assignments";
  return "/auth/role";
}
