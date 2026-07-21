import { createSupportingRegistry } from "./supportingRegistry";
import type { ActionEventContractEntry } from "./types";

export const ACTION_EVENT_CONTRACT_ENTRIES = [
  {
    id: "event-contract.collect_precipitate.v1",
    version: "1.0.0",
    description: "Filtered-and-dried precipitate collection event contract.",
    eventTypeIds: ["event.collect_precipitate.v1"]
  },
  {
    id: "event-contract.tare_balance.v1",
    version: "1.0.0",
    description: "Balance tare event contract.",
    eventTypeIds: ["event.tare_balance.v1"]
  },
  {
    id: "event-contract.place_on_balance.v1",
    version: "1.0.0",
    description: "Balance placement event contract.",
    eventTypeIds: ["event.place_on_balance.v1"]
  },
  {
    id: "event-contract.remove_from_balance.v1",
    version: "1.0.0",
    description: "Balance removal event contract.",
    eventTypeIds: ["event.remove_from_balance.v1"]
  },
  {
    id: "event-contract.transfer_solid.v1",
    version: "1.0.0",
    description: "Conserved solid transfer event contract.",
    eventTypeIds: ["event.transfer_solid.v1"]
  },
  {
    id: "event-contract.read_balance.v1",
    version: "1.0.0",
    description: "Student-reported balance reading event contract.",
    eventTypeIds: ["event.read_balance.v1"]
  },
  {
    id: "event-contract.rinse_burette.v1",
    version: "1.0.0",
    description: "Legacy burette rinse semantic event contract.",
    eventTypeIds: ["rinse_burette"]
  },
  {
    id: "event-contract.fill_burette.v1",
    version: "1.0.0",
    description: "Initial and subsequent burette fill semantic event contract.",
    eventTypeIds: ["fill_burette", "refill_burette"]
  },
  {
    id: "event-contract.select_indicator.v1",
    version: "1.0.0",
    description: "Legacy indicator selection semantic event contract.",
    eventTypeIds: ["select_indicator"]
  },
  {
    id: "event-contract.add_indicator_legacy.v1",
    version: "1.0.0",
    description:
      "Legacy combined indicator addition mapped to select_indicator.",
    eventTypeIds: ["select_indicator"]
  },
  {
    id: "event-contract.add_titrant.v1",
    version: "1.0.0",
    description: "Titrant delivery semantic event contract.",
    eventTypeIds: ["event.add_titrant.v1"]
  },
  {
    id: "event-contract.read_meniscus.v1",
    version: "1.0.0",
    description: "Burette meniscus reading semantic event contract.",
    eventTypeIds: ["event.read_meniscus.v1"]
  },
  {
    id: "event-contract.transfer_liquid.v1",
    version: "1.0.0",
    description: "Bounded reusable liquid-transfer semantic event contract.",
    eventTypeIds: ["event.transfer_liquid.v1"]
  },
  {
    id: "event-contract.rinse_transfer_device.v1",
    version: "1.0.0",
    description:
      "Conditioning-rinse semantic event contract for a transfer device.",
    eventTypeIds: ["event.rinse_transfer_device.v1"]
  },
  {
    id: "event-contract.fill_to_mark.v1",
    version: "1.0.0",
    description: "Volumetric fill-to-mark semantic event contract.",
    eventTypeIds: ["event.fill_to_mark.v1"]
  },
  {
    id: "event-contract.mix_solution.v1",
    version: "1.0.0",
    description: "Bounded mechanical solution-mixing event contract.",
    eventTypeIds: ["event.mix_solution.v1"]
  },
  {
    id: "event-contract.pour_liquid.v1",
    version: "1.0.0",
    description: "Bounded pour into a coffee-cup calorimeter event contract.",
    eventTypeIds: ["event.pour_liquid.v1"]
  },
  {
    id: "event-contract.mix_calorimeter.v1",
    version: "1.0.0",
    description: "Bounded coffee-cup calorimeter mix event contract.",
    eventTypeIds: ["event.mix_calorimeter.v1"]
  },
  {
    id: "event-contract.set_calorimeter_lid.v1",
    version: "1.0.0",
    description: "Coffee-cup calorimeter lid open/close event contract.",
    eventTypeIds: ["event.set_calorimeter_lid.v1"]
  },
  {
    id: "event-contract.place_thermometer.v1",
    version: "1.0.0",
    description: "Thermometer placement into a calorimeter event contract.",
    eventTypeIds: ["event.place_thermometer.v1"]
  },
  {
    id: "event-contract.remove_thermometer.v1",
    version: "1.0.0",
    description: "Thermometer removal from a calorimeter event contract.",
    eventTypeIds: ["event.remove_thermometer.v1"]
  },
  {
    id: "event-contract.read_temperature.v1",
    version: "1.0.0",
    description: "Student-reported thermometer reading event contract.",
    eventTypeIds: ["event.read_temperature.v1"]
  }
] as const satisfies readonly ActionEventContractEntry[];

export const actionEventContractRegistry = createSupportingRegistry(
  "action event contract",
  "event-contracts.2.2.0",
  ACTION_EVENT_CONTRACT_ENTRIES
);
