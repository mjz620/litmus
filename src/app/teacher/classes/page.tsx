import Link from "next/link";

import { PageHeader, ProductShell } from "../../../components/ui/ProductShell";
import styles from "../../../components/ui/ContentSurface.module.css";
import { hasPublicSupabaseEnvironment } from "../../../lib/env";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { createClass } from "./actions";

export default async function TeacherClassesPage() {
  const classes = hasPublicSupabaseEnvironment() ? await loadClasses() : [];

  return (
    <ProductShell>
      <PageHeader
        eyebrow="Teacher workspace"
        title="Your classes"
        description="Create a class, share its join code, and review readiness evidence before students enter the physical lab."
        backHref="/"
        backLabel="Home"
      />
      <section className={styles.formCard}>
        <h2 className={styles.sectionTitle}>Create a class</h2>
        <form className="ui-form" action={createClass}>
          <label className="ui-field">
            Class name
            <input name="name" required maxLength={120} />
          </label>
          <button
            className="ui-button"
            type="submit"
            disabled={!hasPublicSupabaseEnvironment()}
          >
            Create class
          </button>
        </form>
      </section>
      <section className={styles.contentCard}>
        <h2 className={styles.sectionTitle}>Lab Composer</h2>
        <p>
          Assemble a supported physical setup and flexible workflow from
          verified laboratory primitives—no AI generation required.
        </p>
        <Link className="ui-button-secondary" href="/teacher/lab-composer">
          Open Lab Composer
        </Link>
      </section>
      {!hasPublicSupabaseEnvironment() && (
        <p className="ui-notice" data-tone="warning">
          Connect Supabase to create live classes. Demo dashboards remain
          available.
        </p>
      )}
      <section className={styles.contentCard}>
        <h2 className={styles.sectionTitle}>Class list</h2>
        {classes.length ? (
          <ul className={styles.list}>
            {classes.map((classRow) => (
              <li className={styles.listItem} key={classRow.id}>
                <Link href={`/teacher/classes/${classRow.id}`}>
                  {classRow.name}
                </Link>
                <span>Join code {classRow.join_code}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="ui-empty">
            <h3>No classes yet</h3>
            <p>Create a class above or open the seeded teacher demo.</p>
            <Link className="ui-button-secondary" href="/demo/teacher">
              Open teacher demo
            </Link>
          </div>
        )}
      </section>
    </ProductShell>
  );
}

async function loadClasses(): Promise<
  Array<{ id: string; name: string; join_code: string }>
> {
  const client = await createServerSupabaseClient();
  const { data } = await client
    .from("classes")
    .select("id,name,join_code")
    .order("created_at");
  return data ?? [];
}
