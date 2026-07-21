import { NativeSetupDrivenWorkspace } from "../../../../components/lab/setup-driven/NativeSetupDrivenWorkspace";
import { validateSolutionPreparationV2 } from "../../../../lab-workflows/definitions/solution-preparation";
import { SOLUTION_PREPARATION_PRACTICE_SEED } from "../../../../components/ui/experimentRoutes";

/**
 * Serial dilution inside the judge demo — the same validated seed and shell as
 * /lab/solution-preparation, on the demo's isolated endpoints.
 */
export default function DemoSolutionPreparationPage() {
  const workflow = validateSolutionPreparationV2(
    SOLUTION_PREPARATION_PRACTICE_SEED
  );

  return (
    <NativeSetupDrivenWorkspace
      workflow={workflow}
      replaySeed="judge-demo:solution-preparation"
      mode="practice"
      title="Solution preparation"
      sessionIdPrefix="demo-dilution"
    />
  );
}
