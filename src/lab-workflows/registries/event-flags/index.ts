import { createSupportingRegistry } from "../actions";
import {
  EVENT_FLAG_REGISTRY_ENTRIES,
  EVENT_TYPE_REGISTRY_ENTRIES
} from "./entries";

export const eventFlagRegistry = createSupportingRegistry(
  "event flag",
  "event-flags.1.0.0",
  EVENT_FLAG_REGISTRY_ENTRIES
);

export const eventTypeRegistry = createSupportingRegistry(
  "event type",
  "event-types.2.0.0",
  EVENT_TYPE_REGISTRY_ENTRIES
);

export {
  EVENT_FLAG_REGISTRY_ENTRIES,
  EVENT_TYPE_REGISTRY_ENTRIES
} from "./entries";
export type {
  EventFlagRegistryEntry,
  EventFlagRegistryId,
  EventTypeRegistryEntry
} from "./types";
