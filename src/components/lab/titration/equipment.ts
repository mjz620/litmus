// Selectable lab equipment metadata and the mapping from a selection to the
// contextual 2D control groups it exposes. Pure data and functions so the
// interaction contract is unit-testable without a WebGL context. Selection
// remains presentation state; precision controls and useTitrationIntents own
// typed action dispatch while scene metadata reports no actions itself.

export type EquipmentId =
  | "burette"
  | "flask"
  | "meniscus"
  | "indicatorShelf"
  | "washStation";

export type ControlGroupId = "prepare" | "deliver" | "indicator" | "reading";

export interface EquipmentInfo {
  id: EquipmentId;
  name: string;
  purpose: string;
  controlGroups: readonly ControlGroupId[];
}

export const EQUIPMENT: Record<EquipmentId, EquipmentInfo> = {
  burette: {
    id: "burette",
    name: "Burette",
    purpose: "Rinse, fill, and deliver titrant through the stopcock.",
    controlGroups: ["prepare", "deliver"]
  },
  flask: {
    id: "flask",
    name: "Flask & indicator",
    purpose: "Choose an indicator and watch the solution color.",
    controlGroups: ["indicator"]
  },
  meniscus: {
    id: "meniscus",
    name: "Meniscus",
    purpose: "Read the burette at eye level and record the volume.",
    controlGroups: ["reading"]
  },
  indicatorShelf: {
    id: "indicatorShelf",
    name: "Indicator shelf",
    purpose: "Choose an indicator bottle for the titration.",
    controlGroups: ["indicator"]
  },
  washStation: {
    id: "washStation",
    name: "Wash station",
    purpose: "Rinse and fill the burette before delivering titrant.",
    controlGroups: ["prepare"]
  }
};

export const EQUIPMENT_IDS: readonly EquipmentId[] = [
  "burette",
  "flask",
  "meniscus",
  "indicatorShelf",
  "washStation"
];

const ALL_CONTROL_GROUPS: readonly ControlGroupId[] = [
  "prepare",
  "indicator",
  "deliver",
  "reading"
];

/**
 * Control groups to render for a selection. No selection keeps every
 * precision action reachable from the full bench view.
 */
export function getVisibleControlGroups(
  selected: EquipmentId | null
): readonly ControlGroupId[] {
  if (!selected) return ALL_CONTROL_GROUPS;
  return EQUIPMENT[selected].controlGroups;
}
