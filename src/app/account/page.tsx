import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { PageHeader, ProductShell } from "../../components/ui/ProductShell";
import surface from "../../components/ui/ContentSurface.module.css";
import styles from "./Account.module.css";
import { getViewer } from "../../lib/auth/viewer";
import type { Viewer } from "../../lib/auth/roles";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { createLabDefinitionPersistenceService } from "../../lib/persistence/labDefinitionApi";

export const metadata: Metadata = {
  title: "Account"
};

interface SavedLab {
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
}

interface JoinedClass {
  readonly id: string;
  readonly name: string;
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth/sign-in?next=/account");
  if (!viewer.role) redirect("/auth/role");

  return (
    <ProductShell width="narrow">
      <PageHeader
        eyebrow="Your account"
        title={viewer.name ?? "Your account"}
        description="Your Litmus identity and the work saved against it."
      />

      <section className={surface.contentCard} aria-labelledby="account-identity">
        <h2 className={surface.sectionTitle} id="account-identity">
          Profile
        </h2>
        <dl className={styles.identity}>
          <dt>Name</dt>
          <dd>{viewer.name ?? "Not provided by Google"}</dd>
          <dt>Email</dt>
          <dd>{viewer.email ?? "Not provided by Google"}</dd>
          <dt>Role</dt>
          <dd>
            <span className={styles.roleValue}>
              <span className={styles.roleName}>{viewer.role}</span>
              {/*
               * Stated plainly because it is not recoverable in the UI. An
               * account is a student or a teacher, never both, and the only
               * way to hold the other role is a second Google account.
               */}
              <small className={surface.helper}>
                Set when you signed up and fixed for this account. To use Litmus
                as a {viewer.role === "teacher" ? "student" : "teacher"}, sign in
                with a different Google account.
              </small>
            </span>
          </dd>
        </dl>
      </section>

      {viewer.role === "teacher" ? (
        <TeacherWork viewer={viewer} />
      ) : (
        <StudentWork />
      )}

      <section className={styles.signOut} aria-labelledby="account-sign-out">
        <h2 className={surface.sectionTitle} id="account-sign-out">
          Sign out
        </h2>
        <p className={surface.helper}>
          Signing out returns you to guest practice. Saved work stays on your
          account.
        </p>
        {/*
         * A form POST, not a link: sign-out changes server state, and a GET
         * route can be fired by a prefetch the user never chose.
         */}
        <form action="/auth/sign-out" method="post">
          <button className="ui-button-secondary" type="submit">
            Sign out
          </button>
        </form>
      </section>
    </ProductShell>
  );
}

async function TeacherWork({ viewer }: { viewer: Viewer }) {
  const labs = await loadSavedLabs(viewer.userId);

  return (
    <section className={surface.contentCard} aria-labelledby="account-labs">
      <h2 className={surface.sectionTitle} id="account-labs">
        Saved labs
      </h2>
      {labs.length ? (
        <ul className={surface.list}>
          {labs.map((lab) => (
            <li className={surface.listItem} key={lab.id}>
              <span>{lab.name}</span>
              <span>Updated {formatDate(lab.updatedAt)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="ui-empty">
          <h3>No cloud-saved labs yet</h3>
          <p>
            Labs you save in Composer while signed in appear here. Drafts saved
            without an account stay on the device that made them.
          </p>
        </div>
      )}
      <div className={surface.actions}>
        <Link className="ui-button" href="/lab-composer">
          Open Lab Composer
        </Link>
        <Link className="ui-button-secondary" href="/teacher/classes">
          Your classes
        </Link>
      </div>
    </section>
  );
}

async function StudentWork() {
  const classes = await loadJoinedClasses();

  return (
    <section className={surface.contentCard} aria-labelledby="account-classes">
      <h2 className={surface.sectionTitle} id="account-classes">
        Your classes
      </h2>
      {classes.length ? (
        <ul className={surface.list}>
          {classes.map((joined) => (
            <li className={surface.listItem} key={joined.id}>
              <span>{joined.name}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="ui-empty">
          <h3>Not in a class yet</h3>
          <p>Join with the code your teacher gave you to see assigned labs.</p>
        </div>
      )}
      <div className={surface.actions}>
        <Link className="ui-button" href="/assignments">
          Your assignments
        </Link>
        <Link className="ui-button-secondary" href="/join">
          Join a class
        </Link>
      </div>
    </section>
  );
}

/*
 * Ownership comes from the session-derived id, never from a parameter: the
 * Composer store is read through a service-role client that bypasses RLS.
 */
async function loadSavedLabs(ownerId: string): Promise<readonly SavedLab[]> {
  try {
    const drafts = await createLabDefinitionPersistenceService().listDrafts(
      ownerId
    );
    return drafts.map((draft) => ({
      id: draft.id,
      name: draft.name,
      updatedAt: draft.updatedAt
    }));
  } catch (error) {
    /*
     * A persistence outage must not take the whole account page down with it —
     * the profile and sign-out below are what the page is for.
     */
    console.error(
      "account.saved_labs_failed",
      error instanceof Error ? error.message : "unknown error"
    );
    return [];
  }
}

/** Scoped by RLS to the classes this student has joined. */
async function loadJoinedClasses(): Promise<readonly JoinedClass[]> {
  const client = await createServerSupabaseClient();
  const { data, error } = await client
    .from("class_members")
    .select("classes(id,name)")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("account.classes_failed", error.message);
    return [];
  }
  return (data ?? []).flatMap((row) => {
    const joined = (row as { classes: JoinedClass | JoinedClass[] | null })
      .classes;
    if (!joined) return [];
    return Array.isArray(joined) ? joined : [joined];
  });
}
