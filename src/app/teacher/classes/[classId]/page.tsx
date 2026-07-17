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

  return (
    <ProductShell width="wide">
      <PageHeader
        eyebrow="Teacher readiness"
        title="Class readiness"
        description="All values below are deterministic aggregates of persisted session evidence."
        backHref="/teacher/classes"
        backLabel="Classes"
      />
      <AnalyticsCards analytics={analytics} />
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
