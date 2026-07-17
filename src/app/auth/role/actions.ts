"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "../../../lib/supabase/server";

export async function saveRole(formData: FormData) {
  const role = formData.get("role");
  if (role !== "student" && role !== "teacher") {
    throw new Error("Choose a valid role.");
  }

  const client = await createServerSupabaseClient();
  const { data, error: userError } = await client.auth.getUser();
  if (userError || !data.user) redirect("/auth/sign-in");

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

  redirect(role === "teacher" ? "/teacher/classes" : "/experiments");
}
