import { DemoTraceRecorder } from "../../../components/demo/DemoTraceRecorder";
import { LabRouteShell } from "../../lab/[experimentId]/LabRouteShell";

import styles from "./page.module.css";

export default function DemoStudentPage() {
  return (
    <>
      <aside className={styles.guide} role="note">
        <span className={styles.guideIcon} aria-hidden="true">
          ✦
        </span>
        <p>
          <strong>Try this demo path</strong>
          The burette begins at 22.00 mL. Add about 2–4 mL quickly to surface
          endpoint-control evidence, then ask the coach why overshoot matters.
        </p>
      </aside>
      <LabRouteShell
        experimentId="acid_base_titration"
        title="Acid–Base Titration — Demo"
        retrySkillId="endpoint_control"
        mode="demo"
      />
      <DemoTraceRecorder />
    </>
  );
}
