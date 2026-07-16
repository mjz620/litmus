import { titrationManifest } from "./titration/manifest";

export type ExperimentDifficulty = "intro" | "intermediate" | "advanced";

/** Serializable discovery and analytics metadata owned by an experiment plugin. */
export interface ExperimentMetadata {
  description: string;
  estimatedMinutes: number;
  difficulty: ExperimentDifficulty;
  readinessWeights: Readonly<Record<string, number>>;
}

/** A lightweight registry entry whose engine is loaded only when requested. */
export interface ExperimentManifest<TDefinition = unknown> {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  readonly metadata: ExperimentMetadata;
  loadDefinition: () => Promise<TDefinition>;
}

const manifests = {
  [titrationManifest.id]: titrationManifest
} as const;

export type ExperimentId = keyof typeof manifests;
export type RegisteredExperimentManifest = (typeof manifests)[ExperimentId];
export type RegisteredExperimentDefinition = Awaited<
  ReturnType<RegisteredExperimentManifest["loadDefinition"]>
>;

export class UnknownExperimentError extends Error {
  constructor(readonly experimentId: string) {
    super(`Unknown experiment: ${experimentId}`);
    this.name = "UnknownExperimentError";
  }
}

/** Return all registered manifests without loading their experiment engines. */
export function listExperimentManifests(): readonly RegisteredExperimentManifest[] {
  return Object.values(manifests);
}

export function getExperimentManifest<TId extends ExperimentId>(
  experimentId: TId
): (typeof manifests)[TId];
export function getExperimentManifest(
  experimentId: string
): RegisteredExperimentManifest;
export function getExperimentManifest(
  experimentId: string
): RegisteredExperimentManifest {
  const manifest = (
    manifests as Readonly<Record<string, RegisteredExperimentManifest>>
  )[experimentId];

  if (!manifest) {
    throw new UnknownExperimentError(experimentId);
  }

  return manifest;
}

export function loadExperimentDefinition<TId extends ExperimentId>(
  experimentId: TId
): ReturnType<(typeof manifests)[TId]["loadDefinition"]>;
export function loadExperimentDefinition(
  experimentId: string
): Promise<RegisteredExperimentDefinition>;
export async function loadExperimentDefinition(
  experimentId: string
): Promise<RegisteredExperimentDefinition> {
  const manifest = getExperimentManifest(experimentId);
  return manifest.loadDefinition();
}
