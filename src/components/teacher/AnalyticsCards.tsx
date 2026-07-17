import type { ClassAnalytics } from "../../lib/analytics/classAnalytics";

import styles from "./TeacherDashboard.module.css";

export function AnalyticsCards({ analytics }: { analytics: ClassAnalytics }) {
  const cards = [
    ["Students", analytics.studentCount.toString()],
    ["Completed sessions", analytics.completedSessions.toString()],
    ["Completion", formatPercent(analytics.completionRate)],
    ["Average readiness", formatPercent(analytics.averageReadiness)],
    ["Needs attention", analytics.needsAttentionCount.toString()]
  ];
  return (
    <section className={styles.cards} aria-label="Class summary">
      {cards.map(([label, value]) => (
        <article className={styles.card} key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
