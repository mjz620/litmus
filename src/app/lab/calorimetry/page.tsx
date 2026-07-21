import { NativeSetupDrivenWorkspace } from "../../../components/lab/setup-driven/NativeSetupDrivenWorkspace";
import { validateDissolutionCalorimetryV2 } from "../../../lab-workflows/definitions/calorimetry";
import {
  CALORIMETRY_PRACTICE_PATH,
  CALORIMETRY_PRACTICE_SEED
} from "../../../components/ui/experimentRoutes";

/**
 * Guest practice defaults to the measured dissolution lab so students use the
 * balance, rather than receiving an asserted solute amount. The hot/cold-water
 * workflow remains available as a Composer template.
 */
export default function CalorimetryPracticePage() {
  const workflow = validateDissolutionCalorimetryV2(CALORIMETRY_PRACTICE_SEED);

  return (
    <NativeSetupDrivenWorkspace
      key={workflow.validation.canonicalSpecHash}
      workflow={workflow}
      replaySeed={`guest-practice:${CALORIMETRY_PRACTICE_PATH}`}
      mode="practice"
      title="Dissolution calorimetry practice"
      sessionIdPrefix="practice-calorimetry"
    />
  );
}
