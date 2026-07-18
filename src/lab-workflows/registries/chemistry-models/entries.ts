import { LEGACY_TITRATION_CHEMISTRY_MODEL } from "../../adapters/titration/metadata";
import type { ChemistryModelMetadataEntry } from "./types";

export const CHEMISTRY_MODEL_REGISTRY_ENTRIES = Object.freeze([
  {
    id: LEGACY_TITRATION_CHEMISTRY_MODEL.id,
    version: LEGACY_TITRATION_CHEMISTRY_MODEL.version,
    displayName: "Legacy deterministic titration truth adapter",
    providedCapabilityIds: [
      "chemistry.material_ledger.v1",
      "chemistry.volume_conservation.v1",
      "chemistry.solution_mixing.v1",
      "chemistry.acid_base_equilibrium.v1",
      "chemistry.indicator_response.v1",
      "chemistry.instrument_observables.v1"
    ],
    requiredCapabilityIds: [],
    availability: "verified",
    compatibilityRuntimeAdapterId: "runtime-adapter.titration.v1"
  }
] as const satisfies readonly ChemistryModelMetadataEntry[]);
