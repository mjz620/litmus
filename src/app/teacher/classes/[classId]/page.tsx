import Link from "next/link";

import {
  AnalyticsCards,
  formatPercent
} from "../../../../components/teacher/AnalyticsCards";
import { RosterTable } from "../../../../components/teacher/RosterTable";
import {
  PageHeader,
  ProductShell
} from "../../../../components/ui/ProductShell";
import { computeClassAnalytics } from "../../../../lib/analytics/classAnalytics";
import { loadClassAnalyticsInput } from "../../../../lib/analytics/server";
import { hasPublicSupabaseEnvironment } from "../../../../lib/env";
import { createLabAssignmentService } from "../../../../lib/persistence/labDefinitionApi";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

import styles from "../../../../components/teacher/TeacherDashboard.module.css";

interface PageProps {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ filter?: string }>;
}

export default async function ClassDashboardPage({
  params,
  searchParams
}: PageProps) {
  const { classId } = await params;
  const { filter } = await searchParams;
  const analytics = computeClassAnalytics(
    await loadClassAnalyticsInput(classId)
  );
  const students = analytics.students.filter((student) =>
    filter === "attention"
      ? student.needsAttention
      : filter === "complete"
        ? student.completedSessions > 0
        : true
  );
  /*
   * Assignments are listed for the signed-in teacher, who must own the class.
   * A failure here means unavailable or unauthorized, not "none assigned", so
   * it is no longer swallowed into an empty list that reads as a real result.
   */
  const viewer = hasPublicSupabaseEnvironment()
    ? (await (await createServerSupabaseClient()).auth.getUser()).data.user
    : null;
  const assignments =
    hasPublicSupabaseEnvironment() && viewer
      ? await createLabAssignmentService().listForClass(classId, viewer.id)
      : [];
  const classMeta = hasPublicSupabaseEnvironment()
    ? await loadClassMeta(classId)
    : null;

  return (
    <ProductShell width="wide">
      <PageHeader
        eyebrow="Teacher readiness"
        title={classMeta?.name ?? "Class readiness"}
        description="All values below are deterministic aggregates of persisted session evidence."
        backHref="/teacher/classes"
        backLabel="Classes"
      />
      {classMeta && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <span aria-hidden="true">⌘</span>
            <h2>Student join</h2>
          </div>
          <p className={styles.emptyText}>
            Share join code <strong>{classMeta.joinCode}</strong> or link{" "}
            <Link href={`/join?code=${encodeURIComponent(classMeta.joinCode)}`}>
              /join?code={classMeta.joinCode}
            </Link>
            . Students land on Assignments after joining.
          </p>
        </section>
      )}
      <AnalyticsCards analytics={analytics} />
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <span aria-hidden="true">✎</span>
          <h2>Assigned labs</h2>
        </div>
        {assignments.length ? (
          <ul className={styles.insightList}>
            {assignments.map((assignment) => {
              const hash = assignment.labDefinitionCanonicalHash;
              const shortHash = hash ? `${hash.slice(0, 18)}…` : "legacy static";
              return (
                <li key={assignment.id}>
                  <strong>{assignment.title}</strong>
                  {" — "}
                  pinned {shortHash}
                  {" · "}
                  <Link href={`/assignments/${assignment.id}`}>
                    Student start link
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.emptyText}>
            No assignments yet. Approve a runnable lab in{" "}
            <Link href="/lab-composer">Lab Composer</Link> and assign it to this
            class.
          </p>
        )}
      </section>
      <div className={styles.grid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <span aria-hidden="true">△</span>
            <h2>Common misconceptions</h2>
          </div>
          {analytics.misconceptions.length ? (
            <ul className={styles.insightList}>
              {analytics.misconceptions.map(({ flag, count }) => (
                <li key={flag}>
                  {flag.replaceAll("_", " ")} — {count}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptyText}>No flagged evidence yet.</p>
          )}
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <span aria-hidden="true">⌁</span>
            <h2>Skill averages</h2>
          </div>
          <ul className={styles.insightList}>
            {Object.entries(analytics.skillAverages).map(([skill, mastery]) => (
              <li key={skill}>
                {skill.replaceAll("_", " ")} — {formatPercent(mastery)}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className={styles.panel}>
        <div className={styles.rosterHeader}>
          <div className={styles.panelHeader}>
            <span aria-hidden="true">▤</span>
            <h2>Roster</h2>
          </div>
          <form className={styles.filterForm} method="get">
            <label className="ui-field">
              <span>Filter</span>
              <select name="filter" defaultValue={filter ?? "all"}>
                <option value="all">All students</option>
                <option value="attention">Needs attention</option>
                <option value="complete">Completed</option>
              </select>
            </label>
            <button className="ui-button-secondary" type="submit">
              Apply
            </button>
          </form>
        </div>
        <RosterTable classId={classId} students={students} />
      </section>
    </ProductShell>
  );
}

async function loadClassMeta(
  classId: string
): Promise<{ name: string; joinCode: string } | null> {
  const client = await createServerSupabaseClient();
  const { data } = await client
    .from("classes")
    .select("name,join_code")
    .eq("id", classId)
    .maybeSingle();
  if (!data?.join_code || !data.name) return null;
  return { name: data.name, joinCode: data.join_code };
}
