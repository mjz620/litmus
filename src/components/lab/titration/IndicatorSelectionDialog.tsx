/**
 * The indicator review dialog now lives with the setup-driven bench (the
 * native workspace is its primary host). This module remains as a re-export
 * for titration-era import sites until the legacy titration UI is retired.
 */
export {
  getIndicatorLabel,
  IndicatorSelectionDialog
} from "../setup-driven/IndicatorSelectionDialog";
