import { LabRouteShell } from "../../../lab/[experimentId]/LabRouteShell";
import { NATIVE_FULL_TITRATION_SETUP_SELECTION } from "../../../../stores/setupDrivenLabSession";

/**
 * Acid–base titration inside the judge demo.
 *
 * Deliberately the same capability-native runtime and selection a student gets
 * at /lab/titration. The demo used to pin the setup-driven strangler rollback,
 * so evaluators were shown an interface no student uses; isolation belongs to
 * the route area and its endpoints, never to a different interface.
 */
export default function DemoTitrationPage() {
  return (
    <LabRouteShell
      experimentId="acid_base_titration"
      title="Acid–base titration"
      runtimeMode="native_v2"
      mode="demo"
      replaySeed="judge-demo:titration"
      setupDrivenSelection={NATIVE_FULL_TITRATION_SETUP_SELECTION}
    />
  );
}
