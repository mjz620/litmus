import { equivalenceVolumeML, type TitrationConfig } from "./titration";

const ANALYTE_CONCENTRATIONS_M = [0.05, 0.075, 0.1, 0.125, 0.15] as const;
const ANALYTE_VOLUMES_ML = [10, 15, 20, 25, 30] as const;
const TITRANT_CONCENTRATIONS_M = [0.05, 0.075, 0.1, 0.125, 0.15] as const;
const BURETTE_CAPACITY_ML = 50;
const MAX_GENERATION_ATTEMPTS = 64;

/**
 * Produce a varied titration configuration that is stable for a given session
 * seed and whose equivalence point fits within one burette fill.
 */
export function generateTitrationSessionConfig(
  sessionSeed: string
): TitrationConfig {
  const random = createSeededRandom(sessionSeed);

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const config: TitrationConfig = {
      analyte: {
        name: "HCl",
        type: "strong_acid",
        concentrationM: pick(ANALYTE_CONCENTRATIONS_M, random),
        volumeML: pick(ANALYTE_VOLUMES_ML, random)
      },
      titrant: {
        name: "NaOH",
        concentrationM: pick(TITRANT_CONCENTRATIONS_M, random)
      },
      indicator: "phenolphthalein",
      buretteCapacityML: BURETTE_CAPACITY_ML
    };
    const equivalenceML = equivalenceVolumeML(config);

    if (
      Number.isFinite(equivalenceML) &&
      equivalenceML > 0 &&
      equivalenceML <= config.buretteCapacityML
    ) {
      return config;
    }
  }

  // Every configured range has valid pairings; retain a deterministic safe
  // fallback so future range edits cannot make session initialization fail.
  return {
    analyte: {
      name: "HCl",
      type: "strong_acid",
      concentrationM: 0.1,
      volumeML: 25
    },
    titrant: { name: "NaOH", concentrationM: 0.1 },
    indicator: "phenolphthalein",
    buretteCapacityML: BURETTE_CAPACITY_ML
  };
}

function pick<T>(values: readonly T[], random: () => number): T {
  return values[Math.floor(random() * values.length)]!;
}

function createSeededRandom(seed: string): () => number {
  let state = hashSeed(seed);

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
