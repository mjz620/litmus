import {
  listExperimentManifests,
  type ExperimentDifficulty,
  type ExperimentId
} from "../../experiments/registry";
import {
  CALORIMETRY_PRACTICE_PATH,
  PRECIPITATION_PRACTICE_PATH,
  SOLUTION_PREPARATION_PRACTICE_PATH,
  getExperimentPath
} from "./experimentRoutes";

/**
 * What a student needs to choose a lab: what it is, how long it takes, and how
 * hard it is.
 *
 * Deliberately separate from the experiment registry. The registry answers
 * "what can the runtime execute" — engine-backed experiments with an
 * `ExperimentDefinition`. Setup-driven v2 workflows have no engine and no
 * `ExperimentId`; adding them to the registry would make `/lab/[experimentId]`
 * try to load a definition that does not exist.
 *
 * Conflating the two is why three of these labs used to be hand-inlined into
 * the catalog page with their own copy of the card markup.
 */
export interface ExperimentCatalogEntry {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly estimatedMinutes: number;
  readonly difficulty: ExperimentDifficulty;
  readonly href: string;
}

/** Ordered so a first-timer meets the gentlest lab first. */
const DIFFICULTY_ORDER: Readonly<Record<ExperimentDifficulty, number>> =
  Object.freeze({ intro: 0, intermediate: 1, advanced: 2 });

const SETUP_DRIVEN_ENTRIES: readonly ExperimentCatalogEntry[] = Object.freeze([
  {
    key: "calorimetry",
    title: "Mix hot and cold water",
    description:
      "Pour measured hot and cold water into a coffee-cup calorimeter, mix, and read the temperature they settle at.",
    estimatedMinutes: 10,
    difficulty: "intro",
    href: CALORIMETRY_PRACTICE_PATH
  },
  {
    key: "solution-preparation",
    title: "Prepare a sodium chloride dilution",
    description:
      "Condition a pipette, transfer a measured aliquot, dilute to the mark, and mix a solution of known concentration.",
    estimatedMinutes: 12,
    difficulty: "intermediate",
    href: SOLUTION_PREPARATION_PRACTICE_PATH
  },
  {
    key: "silver-chloride",
    title: "Precipitate silver chloride",
    description:
      "Combine two ionic solutions in a beaker, watch what forms, and work out which ions made it.",
    estimatedMinutes: 15,
    difficulty: "intermediate",
    href: PRECIPITATION_PRACTICE_PATH
  }
]);

/** Every lab a student can start, gentlest first. */
export function listExperimentCatalog(): readonly ExperimentCatalogEntry[] {
  const registered = listExperimentManifests().map((manifest) => ({
    key: manifest.id,
    title: manifest.title,
    description: manifest.metadata.description,
    estimatedMinutes: manifest.metadata.estimatedMinutes,
    difficulty: manifest.metadata.difficulty,
    href: getExperimentPath(manifest.id as ExperimentId)
  }));

  return [...registered, ...SETUP_DRIVEN_ENTRIES].sort(
    (left, right) =>
      DIFFICULTY_ORDER[left.difficulty] - DIFFICULTY_ORDER[right.difficulty] ||
      left.estimatedMinutes - right.estimatedMinutes
  );
}
