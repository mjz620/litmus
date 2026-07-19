import { NativeSetupDrivenWorkspace } from "../../../components/lab/setup-driven/NativeSetupDrivenWorkspace";
import { validateSolutionPreparationV2 } from "../../../lab-workflows/definitions/solution-preparation";
import {
  SOLUTION_PREPARATION_PRACTICE_PATH,
  SOLUTION_PREPARATION_PRACTICE_SEED
} from "../../../components/ui/experimentRoutes";

/** Guest practice for the verified native dilution seed — same immersive scene as Preview/assignments. */
export default function SolutionPreparationPracticePage() {
  const workflow = validateSolutionPreparationV2(
    SOLUTION_PREPARATION_PRACTICE_SEED
  );

  return (
    <main>
      <NativeSetupDrivenWorkspace
        workflow={workflow}
        replaySeed={`guest-practice:${SOLUTION_PREPARATION_PRACTICE_PATH}`}
        mode="practice"
        title="Solution preparation practice"
        sessionIdPrefix="practice-dilution"
      />
    </main>
  );
}
