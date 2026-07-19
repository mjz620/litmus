"use client";

import { AnalyticsCards } from "../teacher/AnalyticsCards";
import { RosterTable } from "../teacher/RosterTable";
import styles from "../teacher/TeacherDashboard.module.css";
import { computeClassAnalytics } from "../../lib/analytics/classAnalytics";
import {
  DEMO_CLASS_ID,
  demoAnalyticsFixture
} from "../../lib/analytics/demoFixture";
import { extendAnalyticsWithDemoTrace } from "../../lib/demo/demoTrace";
import { useDemoTrace } from "./useDemoTrace";
import demoStyles from "./DemoTeacherDashboard.module.css";

export function DemoTeacherDashboard() {
  const trace = useDemoTrace();
  const analytics = computeClassAnalytics(
    extendAnalyticsWithDemoTrace(demoAnalyticsFixture, trace)
  );
  return (
    <main className={demoStyles.page}>
      <div className={demoStyles.container}>
        <header className={demoStyles.header}>
          <p className={demoStyles.eyebrow}>Teacher readiness</p>
          <h1>Chemistry 1 — Demo readiness</h1>
          <p>
            Seeded rows and the highlighted live row use the same deterministic
            aggregate functions.
          </p>
          <span className={demoStyles.status}>
            <span aria-hidden="true" />
            Live demo view
          </span>
          <p>
            <a className="ui-button-secondary" href="/lab-composer">
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
