import { create } from "zustand";

import type { EquipmentId } from "../components/lab/titration/equipment";

export interface LabUiStore {
  focused: EquipmentId | null;
  hovered: EquipmentId | null;
  lookActive: boolean;
  setFocused: (focused: EquipmentId | null) => void;
  setHovered: (hovered: EquipmentId | null) => void;
  setLookActive: (lookActive: boolean) => void;
  clearFocus: () => void;
}

/** Shared presentation state for equipment focus/hover and camera look mode. */
export const useLabUiStore = create<LabUiStore>((set) => ({
  focused: null,
  hovered: null,
  lookActive: false,
  setFocused: (focused) => set({ focused }),
  setHovered: (hovered) => set({ hovered }),
  setLookActive: (lookActive) => set({ lookActive }),
  clearFocus: () => set({ focused: null })
}));
