import { NextResponse } from "next/server";

import { authenticateComposerPrincipal } from "../../../../lib/persistence/labDefinitionApi";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

function failure(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function GET() {
  let principal;
  try {
    principal = await authenticateComposerPrincipal();
  } catch {
    return failure(503, "Authentication is unavailable.");
  }
  if (!principal) return failure(401, "Authentication required.");
  if (principal.role !== "teacher")
    return failure(403, "Teacher access required.");

  try {
    const client = await createServerSupabaseClient();
    const { data, error } = await client
      .from("classes")
      .select("id, name")
      .eq("teacher_id", principal.userId)
      .order("created_at", { ascending: false });
    if (error) return failure(503, "Class listing is unavailable.");
    return NextResponse.json({
      ok: true,
      classes: (data ?? []).map((row) => ({
        id: row.id as string,
        name: row.name as string
      }))
    });
  } catch {
    return failure(503, "Class listing is unavailable.");
  }
}
