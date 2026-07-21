import { redirect } from "next/navigation";

import { hasPublicSupabaseEnvironment } from "../../../lib/env";
import { roleHomePath } from "../../../lib/auth/viewer";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { PageHeader, ProductShell } from "../../../components/ui/ProductShell";
import styles from "../../../components/ui/ContentSurface.module.css";
import { saveRole } from "./actions";

interface RolePageProps {
  searchParams: Promise<{ role?: string | string[] }>;
}

export default async function RolePage({ searchParams }: RolePageProps) {
  if (!hasPublicSupabaseEnvironment()) redirect("/auth/sign-in");
  const client = await createServerSupabaseClient();
  const { data } = await client.auth.getUser();
  if (!data.user) redirect("/auth/sign-in");

  const { data: profile } = await client
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  // The role is chosen once. An account that already has one never sees this
  // page again, so it cannot be used to switch sides.
  if (profile?.role === "teacher" || profile?.role === "student") {
    redirect(roleHomePath(profile.role));
  }

  const params = await searchParams;
  const rawRole = Array.isArray(params.role) ? params.role[0] : params.role;
  const preferredRole =
    rawRole === "student" || rawRole === "teacher" ? rawRole : null;

  return (
    <ProductShell width="narrow">
      <PageHeader
        eyebrow="Set up your workspace"
        title="Are you a student or a teacher?"
        description="Pick one to finish signup. Students open practice labs; teachers open the class dashboard. This choice is permanent for this account."
      />
      <form className={`${styles.formCard} ui-form`} action={saveRole}>
        <div className={styles.choiceGrid}>
          <label className={styles.choice}>
            <input
              type="radio"
              name="role"
              value="student"
              required
              defaultChecked={preferredRole === "student"}
            />
            <span>
              <strong>Student</strong>
              <small className={styles.helper}>
                Practice labs and join classes with a code.
              </small>
            </span>
          </label>
          <label className={styles.choice}>
            <input
              type="radio"
              name="role"
              value="teacher"
              required
              defaultChecked={preferredRole === "teacher"}
            />
            <span>
              <strong>Teacher</strong>
              <small className={styles.helper}>
                Create classes, save Composer labs, and assign work.
              </small>
            </span>
          </label>
        </div>
        <button className="ui-button" type="submit">
          Continue
        </button>
      </form>
    </ProductShell>
  );
}
