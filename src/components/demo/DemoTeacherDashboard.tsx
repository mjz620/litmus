"use client";

import { AnalyticsCards } from "../teacher/AnalyticsCards";
import { RosterTable } from "../teacher/RosterTable";
import styles from "../teacher/TeacherDashboard.module.css";
import { computeClassAnalytics } from "../../lib/analytics/classAnalytics";
import {
  DEMO_CLASS_ID,
  demoAnalyticsFixture
} from "../../lib/analytics/demoFixture";
import demoStyles from "./DemoTeacherDashboard.module.css";

/**
 * Teacher readiness view for the judge demo. Rows come from the seeded class
 * fixture and run through the same aggregate functions the real dashboard
 * uses, so what an evaluator reads here is computed exactly as it is in
 * production.
 */
export function DemoTeacherDashboard() {
  const analytics = computeClassAnalytics(demoAnalyticsFixture);
  return (
    <main className={demoStyles.page}>
      <div className={demoStyles.container}>
        <header className={demoStyles.header}>
          <p className={demoStyles.eyebrow}>Teacher readiness</p>
          <h1>Chemistry 1 — Demo readiness</h1>
          <p>
            Every figure below is computed from the seeded class by the same
            aggregate functions the live teacher dashboard uses.
          </p>
          <span className={demoStyles.status}>
            <span aria-hidden="true" />
            Seeded class
          </span>
          <p>
            <a className="ui-button-secondary" href="/demo/composer">
              Open Lab Composer
            </a>
          </p>
        </header>
        <AnalyticsCards analytics={analytics} />
        <section className={`${styles.panel} ${demoStyles.rosterPanel}`}>
          <div className={demoStyles.panelHeading}>
            <div>
              <p className={demoStyles.eyebrow}>Class detail</p>
              <h2>Roster</h2>
            </div>
            <span>{analytics.students.length} students</span>
          </div>
          <RosterTable classId={DEMO_CLASS_ID} students={analytics.students} />
        </section>
      </div>
    </main>
  );
}
