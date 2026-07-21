import Link from "next/link";

import type { StudentAnalytics } from "../../lib/analytics/classAnalytics";
import { formatPercent } from "./AnalyticsCards";

import styles from "./TeacherDashboard.module.css";

export function RosterTable({
  classId,
  students,
  studentHref
}: {
  classId: string;
  students: StudentAnalytics[];
  /**
   * Overrides the row link target. The demo dashboard points rows at its
   * /demo-scoped evidence page so visitors stay inside the demo shell.
   */
  studentHref?: (studentId: string) => string;
}) {
  const hrefFor =
    studentHref ??
    ((studentId: string) => `/teacher/classes/${classId}/students/${studentId}`);
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Student</th>
          <th>Readiness</th>
          <th>Completed</th>
          <th>Evidence</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {students.map((student) => (
          <tr key={student.studentId}>
            <td>
              <Link href={hrefFor(student.studentId)}>{student.name}</Link>
            </td>
            <td>{formatPercent(student.readiness)}</td>
            <td>{student.completedSessions}</td>
            <td>{student.evidenceCount}</td>
            <td
              className={student.needsAttention ? styles.attention : undefined}
            >
              {student.needsAttention ? "Needs attention" : "On track"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
