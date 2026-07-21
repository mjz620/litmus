import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader, ProductShell } from "../../components/ui/ProductShell";
import styles from "../../components/ui/ContentSurface.module.css";
import { hasPublicSupabaseEnvironment } from "../../lib/env";
import { createServerSupabaseClient } from "../../lib/supabase/server";

interface StudentAssignmentInboxRow {
  readonly id: string;
  readonly title: string;
  readonly className: string;
  readonly dueAt: string | null;
  readonly pinned: boolean;
}

export default async function StudentAssignmentsPage() {
  if (!hasPublicSupabaseEnvironment()) {
    return (
      <ProductShell>
        <PageHeader
          eyebrow="My assignments"
          title="Assignments unavailable"
          description="Class assignments need a configured Litmus backend. Guest practice labs remain open without an account."
          backHref="/experiments"
          backLabel="Experiments"
        />
        <p>
          <Link className="ui-button" href="/experiments">
            Open guest experiments
          </Link>
        </p>
      </ProductShell>
    );
  }

  const client = await createServerSupabaseClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) {
    redirect("/auth/sign-in?next=/assignments");
  }

  const assignments = await loadStudentAssignments(client);

  return (
    <ProductShell>
      <PageHeader
        eyebrow="Student workspace"
        title="My assignments"
        description="Labs your teachers assigned to classes you have joined. Guest practice stays on Experiments."
        backHref="/experiments"
        backLabel="Experiments"
      >
        <p>
          <Link className="ui-button-secondary" href="/join">
            Join a class
          </Link>
        </p>
      </PageHeader>

      <section className={styles.contentCard} aria-label="Assigned labs">
        <h2 className={styles.sectionTitle}>Assigned labs</h2>
        {assignments.length ? (
          <ul className={styles.list}>
            {assignments.map((row) => (
              <li className={styles.listItem} key={row.id}>
                <Link href={`/assignments/${row.id}`}>{row.title}</Link>
                <span>
                  {row.className}
                  {row.pinned ? " · pinned definition" : " · static lab"}
                  {row.dueAt ? ` · due ${row.dueAt.slice(0, 10)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="ui-empty">
            <h3>No assignments yet</h3>
            <p>
              Join a class with your teacher’s code, then return here when they
              assign a lab.
            </p>
            <Link className="ui-button" href="/join">
              Join a class
            </Link>
          </div>
        )}
      </section>
    </ProductShell>
  );
}

async function loadStudentAssignments(
  client: Awaited<ReturnType<typeof createServerSupabaseClient>>
): Promise<StudentAssignmentInboxRow[]> {
  const { data: memberships, error: membershipError } = await client
    .from("class_members")
    .select("class_id, classes(name)");
  if (membershipError || !memberships?.length) return [];

  const classNames = new Map<string, string>();
  for (const row of memberships) {
    const classId = typeof row.class_id === "string" ? row.class_id : null;
    if (!classId) continue;
    const related = row.classes as { name?: string } | { name?: string }[] | null;
    const name = Array.isArray(related)
      ? related[0]?.name
      : related?.name;
    classNames.set(classId, typeof name === "string" ? name : "Class");
  }

  const classIds = [...classNames.keys()];
  if (classIds.length === 0) return [];

  const { data: rows, error } = await client
    .from("assignments")
    .select(
      "id, title, class_id, due_at, lab_definition_version_id, created_at"
    )
    .in("class_id", classIds)
    .order("created_at", { ascending: false });
  if (error || !rows) return [];

  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    className: classNames.get(String(row.class_id)) ?? "Class",
    dueAt: typeof row.due_at === "string" ? row.due_at : null,
    pinned: row.lab_definition_version_id != null
  }));
}
