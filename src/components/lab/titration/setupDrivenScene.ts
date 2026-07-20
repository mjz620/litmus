/**
 * The lab scene resolver now lives with the setup-driven bench as
 * `setup-driven/labScene.ts` (it resolves scenes for every lab family, not
 * just titration). This module remains as a re-export for titration-era
 * import sites until the legacy titration UI is retired.
 */
export * from "../setup-driven/labScene";
