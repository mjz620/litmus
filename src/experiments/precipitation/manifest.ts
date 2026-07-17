import type { ExperimentManifest } from "../registry";
import type { precipitation } from "./precipitation";

export const precipitationManifest = {
  id: "precipitation_solubility",
  title: "Precipitation & Solubility",
  version: "1.0.0",
  metadata: {
    description:
      "Mix verified ionic solutions, observe precipitates, and practice net ionic equations.",
    estimatedMinutes: 15,
    difficulty: "intermediate",
    readinessWeights: {
      ion_dissociation: 0.2,
      solubility_rules: 0.35,
      net_ionic_equation: 0.3,
      spectator_ions: 0.15
    }
  },
  async loadDefinition() {
    const pluginModule = await import("./precipitation");
    return pluginModule.precipitation;
  }
} as const satisfies ExperimentManifest<typeof precipitation>;
