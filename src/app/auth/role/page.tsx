import { redirect } from "next/navigation";

import { hasPublicSupabaseEnvironment } from "../../../lib/env";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { PageHeader, ProductShell } from "../../../components/ui/ProductShell";
import styles from "../../../components/ui/ContentSurface.module.css";
import { saveRole } from "./actions";

export default async function RolePage() {
  if (!hasPublicSupabaseEnvironment()) redirect("/auth/sign-in");
  const client = await createServerSupabaseClient();
  const { data } = await client.auth.getUser();
  if (!data.user) redirect("/auth/sign-in");

  const { data: profile } = await client
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile?.role === "teacher") redirect("/teacher/classes");
  if (profile?.role === "student") redirect("/experiments");

  return (
    <ProductShell width="narrow">
      <PageHeader
        eyebrow="Set up your workspace"
        title="How will you use LabBench?"
        description="Choose the experience that should open after sign-in. This can be updated later."
      />
      <form className={`${styles.formCard} ui-form`} action={saveRole}>
        <div className={styles.choiceGrid}>
          <label className={styles.choice}>
            <input type="radio" name="role" value="student" required />
            <span>Student practice</span>
          </label>
          <label className={styles.choice}>
            <input type="radio" name="role" value="teacher" required />
            <span>Teacher dashboard</span>
          </label>
        </div>
        <button className="ui-button" type="submit">
          Continue
        </button>
      </form>
    </ProductShell>
  );
}
