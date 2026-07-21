import { notFound } from "next/navigation";

import { computeClassAnalytics } from "../../lib/analytics/classAnalytics";
import { loadClassAnalyticsInput } from "../../lib/analytics/server";
import { PageHeader, ProductShell } from "../ui/ProductShell";
import { formatPercent } from "./AnalyticsCards";

import styles from "./TeacherDashboard.module.css";

interface StudentEvidenceViewProps {
  classId: string;
  studentId: string;
  backHref: string;
  backLabel: string;
  /** The demo playground renders its own bar; see ProductShell. */
  hideSiteHeader?: boolean;
}

/**
 * Evidence flags arrive as machine codes (`endpoint_overshoot`); teachers
 * read them as plain words, same treatment as the event type above them.
 */
function humanizeFlag(flag: string): string {
  return flag.replaceAll("_", " ");
}

/**
 * One student's skills, evidence timeline, and report feedback. Shared by the
 * teacher dashboard route and the demo playground so a demo visitor can open
 * a roster row without being ejected from the demo shell.
 */
export async function StudentEvidenceView({
  classId,
  studentId,
  backHref,
  backLabel,
  hideSiteHeader = false
}: StudentEvidenceViewProps) {
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
    <ProductShell hideSiteHeader={hideSiteHeader}>
      <PageHeader
        eyebrow="Student evidence"
        title={student.name}
        description={`Readiness ${formatPercent(student.readiness)} · ${student.evidenceCount} evidence items`}
        backHref={backHref}
        backLabel={backLabel}
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
                  ? ` · ${event.flags.map(humanizeFlag).join(", ")}`
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
          This student has not submitted a lab report yet.
        </p>
      </section>
    </ProductShell>
  );
}
