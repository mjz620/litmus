import { notFound } from "next/navigation";

import { formatPercent } from "../../../../../../components/teacher/AnalyticsCards";
import {
  PageHeader,
  ProductShell
} from "../../../../../../components/ui/ProductShell";
import styles from "../../../../../../components/teacher/TeacherDashboard.module.css";
import { computeClassAnalytics } from "../../../../../../lib/analytics/classAnalytics";
import { loadClassAnalyticsInput } from "../../../../../../lib/analytics/server";

interface PageProps {
  params: Promise<{ classId: string; studentId: string }>;
}

export default async function StudentDetailPage({ params }: PageProps) {
  const { classId, studentId } = await params;
  const input = await loadClassAnalyticsInput(classId);
  const student = computeClassAnalytics(input).students.find(
    (item) => item.studentId === studentId
  );
  if (!student) notFound();
  const sessionIds = new Set(
    input.sessions
      .filter((session) => session.studentId === studentId)
      .map(({ id }) => id)
  );
  const events = input.events.filter((event) =>
    sessionIds.has(event.sessionId)
  );

  return (
    <ProductShell>
      <PageHeader
        eyebrow="Student evidence"
        title={student.name}
        description={`Readiness ${formatPercent(student.readiness)} · ${student.evidenceCount} evidence items`}
        backHref={`/teacher/classes/${classId}`}
        backLabel="Class dashboard"
      />
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <span aria-hidden="true">⌁</span>
          <h2>Skills</h2>
        </div>
        <div className={styles.cards}>
          {Object.entries(student.skills).map(([skill, mastery]) => (
            <article className={styles.card} key={skill}>
              <span>{skill.replaceAll("_", " ")}</span>
              <strong>{formatPercent(mastery)}</strong>
            </article>
          ))}
        </div>
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <span aria-hidden="true">↳</span>
          <h2>Evidence timeline</h2>
        </div>
        {events.length ? (
          <ol className={styles.timeline}>
            {events.map((event, index) => (
              <li key={`${event.sessionId}-${event.tSim}-${index}`}>
                <strong>{event.type.replaceAll("_", " ")}</strong> at simulation
                time {event.tSim}s
                {event.flags.length
                  ? ` · ${event.flags.join(", ")}`
                  : " · routine success"}
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.emptyText}>No semantic events yet.</p>
        )}
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <span aria-hidden="true">▤</span>
          <h2>Report feedback</h2>
        </div>
        <p className={styles.emptyText}>
          No report has been submitted for this fixture.
        </p>
      </section>
    </ProductShell>
  );
}
