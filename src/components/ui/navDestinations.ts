import type { ViewerRole } from "../../lib/auth/roles";

export interface NavDestination {
  readonly href: string;
  readonly label: string;
}

/*
 * One list per audience rather than one list for everyone. The shared list
 * advertised "Teacher" to students and guests and "Assignments"/"Join" to
 * teachers — destinations that either redirect straight back or render a
 * workspace the account cannot act in — and kept "Sign in" up for accounts that
 * were already signed in.
 */
export const GUEST_DESTINATIONS: readonly NavDestination[] = Object.freeze([
  { href: "/experiments", label: "Experiments" },
  { href: "/lab-composer", label: "Composer" },
  { href: "/demo", label: "Demo" },
  { href: "/auth/sign-in", label: "Sign in" }
]);

export const STUDENT_DESTINATIONS: readonly NavDestination[] = Object.freeze([
  { href: "/experiments", label: "Experiments" },
  { href: "/assignments", label: "Assignments" },
  { href: "/join", label: "Join" },
  { href: "/account", label: "Account" }
]);

export const TEACHER_DESTINATIONS: readonly NavDestination[] = Object.freeze([
  { href: "/teacher/classes", label: "Classes" },
  { href: "/lab-composer", label: "Composer" },
  { href: "/experiments", label: "Experiments" },
  { href: "/account", label: "Account" }
]);

/*
 * An account that signed in but has not picked a role yet. Sending it anywhere
 * else just bounces off /auth/role, so the nav offers the one thing it can do.
 */
export const UNFINISHED_DESTINATIONS: readonly NavDestination[] = Object.freeze([
  { href: "/experiments", label: "Experiments" },
  { href: "/auth/role", label: "Finish setup" }
]);

export function destinationsFor(
  signedIn: boolean,
  role: ViewerRole | null
): readonly NavDestination[] {
  if (!signedIn) return GUEST_DESTINATIONS;
  if (role === "teacher") return TEACHER_DESTINATIONS;
  if (role === "student") return STUDENT_DESTINATIONS;
  return UNFINISHED_DESTINATIONS;
}
