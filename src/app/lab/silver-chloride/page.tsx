import { NativeSetupDrivenWorkspace } from "../../../components/lab/setup-driven/NativeSetupDrivenWorkspace";
import { validatePrecipitationV2 } from "../../../lab-workflows/definitions/precipitation";
import {
  PRECIPITATION_PRACTICE_PATH,
  PRECIPITATION_PRACTICE_SEED
} from "../../../components/ui/experimentRoutes";

/** Guest practice for the verified native precipitation seed — same immersive shell as titration. */
export default function SilverChloridePracticePage() {
  const workflow = validatePrecipitationV2(PRECIPITATION_PRACTICE_SEED);

  return (
    <NativeSetupDrivenWorkspace
      workflow={workflow}
      replaySeed={`guest-practice:${PRECIPITATION_PRACTICE_PATH}`}
      mode="practice"
      title="Precipitation practice"
      sessionIdPrefix="practice-precipitation"
    />
  );
}
