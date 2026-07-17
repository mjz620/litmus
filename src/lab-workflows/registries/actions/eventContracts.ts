import { createSupportingRegistry } from "./supportingRegistry";
import type { ActionEventContractEntry } from "./types";

export const ACTION_EVENT_CONTRACT_ENTRIES = [
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
  }
] as const satisfies readonly ActionEventContractEntry[];

export const actionEventContractRegistry = createSupportingRegistry(
  "action event contract",
  "event-contracts.1.0.0",
  ACTION_EVENT_CONTRACT_ENTRIES
);
