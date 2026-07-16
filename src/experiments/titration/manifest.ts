import type { ExperimentManifest } from "../registry";
import type { titration } from "./titration";

export const titrationManifest = {
  id: "acid_base_titration",
  title: "Acid–Base Titration",
  version: "1.0.0",
  metadata: {
    description:
      "Practice burette preparation, endpoint control, volumetric reading, and titration stoichiometry.",
    estimatedMinutes: 20,
    difficulty: "intermediate",
    readinessWeights: {
      burette_conditioning: 0.25,
      endpoint_control: 0.3,
      volumetric_reading: 0.2,
      stoichiometry: 0.25
    }
  },
  async loadDefinition() {
    const definitionModule = await import("./titration");
    return definitionModule.titration;
  }
} as const satisfies ExperimentManifest<typeof titration>;
