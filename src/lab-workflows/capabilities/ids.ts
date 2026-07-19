/**
 * Closed equipment capability vocabulary reserved by the Composer contract.
 * Availability is defined by the registry, not by presence in this union.
 */
export const EQUIPMENT_CAPABILITY_IDS = Object.freeze([
  "capability.contain_liquid.v1",
  "capability.receive_liquid.v1",
  "capability.dispense_liquid.v1",
  "capability.transfer_liquid.v1",
  "capability.measure_volume.v1",
  "capability.rinse.v1",
  "capability.mix.v1",
  "capability.mount.v1",
  "capability.observe_color.v1",
  "capability.fill_to_mark.v1",
  "capability.measure_temperature.v1",
  "capability.seal_lid.v1",
  "capability.accept_probe.v1"
] as const);

export type EquipmentCapabilityId = (typeof EQUIPMENT_CAPABILITY_IDS)[number];

/**
 * Closed deterministic chemistry capability vocabulary. These IDs describe
 * scientific responsibilities; they do not imply an executable provider exists.
 */
export const CHEMISTRY_CAPABILITY_IDS = Object.freeze([
  "chemistry.material_ledger.v1",
  "chemistry.volume_conservation.v1",
  "chemistry.solution_mixing.v1",
  "chemistry.concentration_dilution.v1",
  "chemistry.acid_base_equilibrium.v1",
  "chemistry.indicator_response.v1",
  "chemistry.instrument_observables.v1",
  "chemistry.thermal_energy.v1"
] as const);

export type ChemistryCapabilityId = (typeof CHEMISTRY_CAPABILITY_IDS)[number];

export type LabCapabilityId = EquipmentCapabilityId | ChemistryCapabilityId;
