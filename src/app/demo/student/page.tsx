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
  const runtimeMode = resolveLabSessionRuntimeMode(
    "acid_base_titration",
    requestedRuntime
  );
  const useSetupDriven = runtimeMode === "setup_driven_v2";
  return (
    <>
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
    </>
  );
}
