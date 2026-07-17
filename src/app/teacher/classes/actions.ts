"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { generateJoinCode } from "../../../lib/classes/classes";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export async function createClass(formData: FormData) {
  const nameValue = formData.get("name");
  const name =
    typeof nameValue === "string" ? nameValue.trim().slice(0, 120) : "";
  if (!name) throw new Error("Class name is required.");

  const client = await createServerSupabaseClient();
  const { data } = await client.auth.getUser();
  if (!data.user) redirect("/auth/sign-in");

  let createdId: string | null = null;
  for (let attempt = 0; attempt < 5 && !createdId; attempt += 1) {
    const { data: created, error } = await client
      .from("classes")
      .insert({
        teacher_id: data.user.id,
        name,
        join_code: generateJoinCode()
      })
      .select("id")
      .single();
    if (!error && created) {
      createdId = created.id;
      break;
    }
    if (error?.code !== "23505") throw new Error("Could not create the class.");
  }
  if (!createdId) throw new Error("Could not reserve a unique class code.");

  revalidatePath("/teacher/classes");
  redirect(`/teacher/classes/${createdId}`);
}
