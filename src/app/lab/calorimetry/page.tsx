import { NativeSetupDrivenWorkspace } from "../../../components/lab/setup-driven/NativeSetupDrivenWorkspace";
import { validateCalorimetryV2 } from "../../../lab-workflows/definitions/calorimetry";
import {
  CALORIMETRY_PRACTICE_PATH,
  CALORIMETRY_PRACTICE_SEED
} from "../../../components/ui/experimentRoutes";

/** Guest practice for the verified native calorimetry seed — same immersive shell as titration. */
export default function CalorimetryPracticePage() {
  const workflow = validateCalorimetryV2(CALORIMETRY_PRACTICE_SEED);

  return (
    <NativeSetupDrivenWorkspace
      workflow={workflow}
      replaySeed={`guest-practice:${CALORIMETRY_PRACTICE_PATH}`}
      mode="practice"
      title="Calorimetry practice"
      sessionIdPrefix="practice-calorimetry"
    />
  );
}
