import { DemoTraceRecorder } from "../../../components/demo/DemoTraceRecorder";
import {
  STRICT_TITRATION_SETUP_SELECTION,
  resolveLabSessionRuntimeMode
} from "../../../stores/setupDrivenLabSession";
import { LabRouteShell } from "../../lab/[experimentId]/LabRouteShell";

import styles from "./page.module.css";

interface DemoStudentPageProps {
  searchParams: Promise<{ runtime?: string | string[] }>;
}

export default async function DemoStudentPage({
  searchParams
}: DemoStudentPageProps) {
  const { runtime } = await searchParams;
  const requestedRuntime = Array.isArray(runtime) ? runtime[0] : runtime;
  /*
   * The scripted demo path narrates the setup-driven endpoint-control drill,
   * so the demo deliberately stays pinned to the strangler runtime while the
   * student default is native_v2; flipping the demo (and its trace/technical
   * inspection expectations) is scheduled with legacy retirement. Explicit
   * ?runtime= values still resolve as everywhere else.
   */
  const runtimeMode =
    requestedRuntime === undefined
      ? "setup_driven_v2"
      : resolveLabSessionRuntimeMode("acid_base_titration", requestedRuntime);
  const useSetupDriven = runtimeMode === "setup_driven_v2";
  return (
    <div className={styles.demoRoute}>
      <aside className={styles.guide} role="note">
        <span className={styles.guideIcon} aria-hidden="true">
          ✦
        </span>
        <p>
          <strong>Try this demo path</strong>
          {useSetupDriven
            ? " Follow the setup-driven procedure, then add titrant quickly near the endpoint and ask the coach why overshoot matters."
            : " The burette begins at 22.00 mL. Add about 2–4 mL quickly to surface endpoint-control evidence, then ask the coach why overshoot matters."}
        </p>
      </aside>
      <LabRouteShell
        experimentId="acid_base_titration"
        title="Acid–Base Titration — Demo"
        retrySkillId={useSetupDriven ? undefined : "endpoint_control"}
        mode="demo"
        runtimeMode={runtimeMode}
        setupDrivenSelection={
          useSetupDriven ? STRICT_TITRATION_SETUP_SELECTION : undefined
        }
      />
      <DemoTraceRecorder />
    </div>
  );
}
