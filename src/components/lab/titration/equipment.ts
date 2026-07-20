/**
 * The shared equipment metadata table now lives with the setup-driven bench
 * (it serves every lab, not just titration). This module remains as a
 * re-export for titration-era import sites (TitrationScene, LabScene,
 * labUiStore, three/*) until the legacy titration UI is retired.
 */
export * from "../setup-driven/equipment";
