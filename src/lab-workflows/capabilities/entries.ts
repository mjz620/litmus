import type {
  CapabilityAvailability,
  CapabilityDefinition,
  ChemistryCapabilityDefinition,
  EquipmentCapabilityDefinition
} from "./types";
import type { ChemistryCapabilityId, EquipmentCapabilityId } from "./ids";

function equipment(
  id: EquipmentCapabilityId,
  displayName: string,
  description: string,
  availability: CapabilityAvailability
): EquipmentCapabilityDefinition {
  return {
    kind: "equipment",
    id,
    version: "1.0.0",
    displayName,
    description,
    availability
  };
}

function chemistry(
  id: ChemistryCapabilityId,
  displayName: string,
  description: string,
  availability: CapabilityAvailability = "declared"
): ChemistryCapabilityDefinition {
  return {
    kind: "chemistry",
    id,
    version: "1.0.0",
    displayName,
    description,
    availability,
    providerCardinality: "exclusive"
  };
}

export const CAPABILITY_REGISTRY_ENTRIES = [
  equipment(
    "capability.contain_liquid.v1",
    "Contain liquid",
    "Maintains a bounded liquid inventory in an equipment instance.",
    "verified"
  ),
  equipment(
    "capability.receive_liquid.v1",
    "Receive liquid",
    "Accepts a deterministic liquid transfer from another instance.",
    "verified"
  ),
  equipment(
    "capability.dispense_liquid.v1",
    "Dispense liquid",
    "Releases liquid through a verified bounded mechanic.",
    "verified"
  ),
  equipment(
    "capability.transfer_liquid.v1",
    "Transfer liquid",
    "Moves a bounded quantity between compatible containers.",
    "verified"
  ),
  equipment(
    "capability.measure_volume.v1",
    "Measure volume",
    "Exposes a verified quantitative volume measurement.",
    "verified"
  ),
  equipment(
    "capability.rinse.v1",
    "Rinse",
    "Supports a verified equipment-conditioning rinse mechanic.",
    "verified"
  ),
  equipment(
    "capability.mix.v1",
    "Mix",
    "Supports a deterministic mechanical mixing operation.",
    "verified"
  ),
  equipment(
    "capability.mount.v1",
    "Mount",
    "Can be positioned in a verified support or stand.",
    "verified"
  ),
  equipment(
    "capability.observe_color.v1",
    "Observe color",
    "Projects an engine-owned color observation without recomputing chemistry.",
    "verified"
  ),
  equipment(
    "capability.fill_to_mark.v1",
    "Fill to mark",
    "Supports filling a volumetric vessel to its registered calibration mark.",
    "verified"
  ),
  chemistry(
    "chemistry.material_ledger.v1",
    "Material ledger",
    "Tracks registered material quantities through deterministic transitions.",
    "verified"
  ),
  chemistry(
    "chemistry.volume_conservation.v1",
    "Volume conservation",
    "Applies verified volume-conservation behavior.",
    "verified"
  ),
  chemistry(
    "chemistry.solution_mixing.v1",
    "Solution mixing",
    "Derives deterministic mixed-solution state from registered materials.",
    "verified"
  ),
  chemistry(
    "chemistry.concentration_dilution.v1",
    "Concentration and dilution",
    "Derives concentration changes for supported dilution transitions.",
    "verified"
  ),
  chemistry(
    "chemistry.acid_base_equilibrium.v1",
    "Acid-base equilibrium",
    "Provides verified acid-base equilibrium observables.",
    "verified"
  ),
  chemistry(
    "chemistry.indicator_response.v1",
    "Indicator response",
    "Derives registered indicator observables from deterministic solution state.",
    "verified"
  ),
  chemistry(
    "chemistry.instrument_observables.v1",
    "Instrument observables",
    "Projects deterministic model state into registered instrument readings.",
    "verified"
  )
] as const satisfies readonly CapabilityDefinition[];
