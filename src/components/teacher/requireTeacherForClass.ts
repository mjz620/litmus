import { redirect } from "next/navigation";

import { getViewer, roleHomePath } from "../../lib/auth/viewer";
import { hasPublicSupabaseEnvironment } from "../../lib/env";
import { DEMO_CLASS_ID } from "../../lib/analytics/demoFixture";

/**
 * Gate for the teacher class drill-downs, mirroring `/teacher/classes`.
 *
 * These pages load analytics directly and previously rendered whatever the
 * loader returned, so access control rested entirely on the data layer
 * failing closed. The demo class stays open on purpose: it is fixture-backed,
 * labelled as such, and is what the judge demo links into.
 */
export async function requireTeacherForClass(
  classId: string,
  nextPath: string
): Promise<void> {
  if (classId === DEMO_CLASS_ID) return;
  if (!hasPublicSupabaseEnvironment()) return;
  const viewer = await getViewer();
  if (!viewer) redirect(`/auth/sign-in?next=${encodeURIComponent(nextPath)}`);
  if (viewer.role !== "teacher") redirect(roleHomePath(viewer.role));
}
