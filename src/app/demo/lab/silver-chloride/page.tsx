import { NativeSetupDrivenWorkspace } from "../../../../components/lab/setup-driven/NativeSetupDrivenWorkspace";
import { validatePrecipitationV2 } from "../../../../lab-workflows/definitions/precipitation";
import { PRECIPITATION_PRACTICE_SEED } from "../../../../components/ui/experimentRoutes";

/**
 * Gravimetric precipitation inside the judge demo — the same validated seed
 * and shell as /lab/silver-chloride.
 */
export default function DemoSilverChloridePage() {
  const workflow = validatePrecipitationV2(PRECIPITATION_PRACTICE_SEED);

  return (
    <NativeSetupDrivenWorkspace
      workflow={workflow}
      replaySeed="judge-demo:silver-chloride"
      mode="practice"
      title="Gravimetric precipitation"
      sessionIdPrefix="demo-precipitation"
    />
  );
}
