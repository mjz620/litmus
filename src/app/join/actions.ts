"use server";

import { redirect } from "next/navigation";

import { isValidJoinCode, normalizeJoinCode } from "../../lib/classes/classes";
import { createServerSupabaseClient } from "../../lib/supabase/server";

export async function joinClass(formData: FormData) {
  const value = formData.get("joinCode");
  const joinCode = normalizeJoinCode(typeof value === "string" ? value : "");
  if (!isValidJoinCode(joinCode)) throw new Error("Enter a valid class code.");

  const client = await createServerSupabaseClient();
  const { data: authData } = await client.auth.getUser();
  if (!authData.user) {
    redirect(`/auth/sign-in?next=${encodeURIComponent(`/join?code=${joinCode}`)}`);
  }

  const { error } = await client.rpc("join_class_by_code", {
    requested_code: joinCode
  });
  if (error) throw new Error("Could not join the class.");
  redirect("/assignments");
}
