"use server";

import { redirect } from "next/navigation";

import { roleHomePath } from "../../../lib/auth/viewer";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export async function saveRole(formData: FormData) {
  const role = formData.get("role");
  if (role !== "student" && role !== "teacher") {
    throw new Error("Choose a valid role.");
  }

  const client = await createServerSupabaseClient();
  const { data, error: userError } = await client.auth.getUser();
  if (userError || !data.user) redirect("/auth/sign-in");

  /*
   * An account holds exactly one role for its lifetime. The page redirects
   * away once a role exists, but the action is a public endpoint of its own —
   * without this read, POSTing role=teacher to an established student account
   * would have promoted it. The database trigger added alongside this is the
   * real guarantee; this check is what turns the resulting error into a normal
   * redirect instead of a crash.
   */
  const { data: existing } = await client
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (existing?.role === "student" || existing?.role === "teacher") {
    redirect(roleHomePath(existing.role));
  }

  const name =
    typeof data.user.user_metadata.full_name === "string"
      ? data.user.user_metadata.full_name.slice(0, 120)
      : null;
  const { error } = await client.from("profiles").upsert({
    id: data.user.id,
    role,
    name
  });
  if (error) throw new Error("Could not create the role profile.");

  redirect(roleHomePath(role));
}
