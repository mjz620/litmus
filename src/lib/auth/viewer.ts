import { hasPublicSupabaseEnvironment } from "../env";
import { createServerSupabaseClient } from "../supabase/server";
import { readViewerRole, type Viewer } from "./roles";

export { roleHomePath, type Viewer, type ViewerRole } from "./roles";

/**
 * The single reader for "who is looking at this page". Surfaces used to each
 * call auth.getUser() and then re-query profiles, which is why the header could
 * show "Sign in" to a signed-in teacher and why /teacher/classes checked for a
 * session but never for the teacher role.
 *
 * Returns null for guests and for deployments without Supabase configured, so
 * callers get one "no account" branch rather than two.
 */
export async function getViewer(): Promise<Viewer | null> {
  if (!hasPublicSupabaseEnvironment()) return null;

  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await client
    .from("profiles")
    .select("role,name")
    .eq("id", data.user.id)
    .maybeSingle();

  const metadataName =
    typeof data.user.user_metadata.full_name === "string"
      ? data.user.user_metadata.full_name.slice(0, 120)
      : null;

  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    name: profile?.name ?? metadataName,
    role: readViewerRole(profile?.role)
  };
}
