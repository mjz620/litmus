import { NativeSetupDrivenWorkspace } from "../../../../components/lab/setup-driven/NativeSetupDrivenWorkspace";
import { validateDissolutionCalorimetryV2 } from "../../../../lab-workflows/definitions/calorimetry";
import { CALORIMETRY_PRACTICE_SEED } from "../../../../components/ui/experimentRoutes";

/**
 * Dissolution calorimetry inside the judge demo — the measured variant, so the
 * balance and weighing workflow are exercised rather than an asserted amount.
 */
export default function DemoCalorimetryPage() {
  const workflow = validateDissolutionCalorimetryV2(CALORIMETRY_PRACTICE_SEED);

  return (
    <NativeSetupDrivenWorkspace
      key={workflow.validation.canonicalSpecHash}
      workflow={workflow}
      replaySeed="judge-demo:calorimetry"
      mode="practice"
      title="Dissolution calorimetry"
      sessionIdPrefix="demo-calorimetry"
    />
  );
}
