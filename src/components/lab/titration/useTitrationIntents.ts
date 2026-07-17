"use client";

import { useMemo } from "react";

import {
  type IndicatorId,
  type TitrationAction
} from "../../../experiments/titration/titration";
import { useLabStore } from "../../../stores/labStore";
import { getLabSounds } from "../three/labSounds";

export type TitrationIntent =
  | { type: "indicator_bottle_clicked"; indicator: IndicatorId }
  | { type: "wash_bottle_clicked" }
  | { type: "titrant_bottle_clicked" }
  | { type: "funnel_clicked"; volumeML: number };

export interface TitrationIntentHandlers {
  onIndicatorBottleClick: (indicator: IndicatorId) => void;
  onWashBottleClick: () => void;
  onTitrantBottleClick: () => void;
  onFunnelClick: () => void;
}

/** Pure gesture-fact to existing typed engine-action mapping. */
export function actionForTitrationIntent(
  intent: TitrationIntent
): TitrationAction {
  switch (intent.type) {
    case "indicator_bottle_clicked":
      return {
        type: "select_indicator",
        indicator: intent.indicator
      };
    case "wash_bottle_clicked":
      return { type: "rinse_burette", solvent: "water" };
    case "titrant_bottle_clicked":
      return { type: "rinse_burette", solvent: "titrant" };
    case "funnel_clicked":
      return { type: "fill_burette", volumeML: intent.volumeML };
  }
}

/**
 * Sole new T0112 dispatcher. Scene components report physical gesture facts;
 * this UI-layer hook translates them into existing experiment actions.
 */
export function useTitrationIntents(): TitrationIntentHandlers {
  const dispatch = useLabStore((store) => store.dispatch);
  const fillVolumeML = useLabStore((store) => {
    const state = store.state;
    return state && "buretteAvailableML" in state
      ? state.config.buretteCapacityML - state.buretteAvailableML
      : 0;
  });

  return useMemo(
    () => ({
      onIndicatorBottleClick: (indicator: IndicatorId) => {
        dispatch(
          actionForTitrationIntent({
            type: "indicator_bottle_clicked",
            indicator
          })
        );
        getLabSounds().playFromGesture("indicator");
      },
      onWashBottleClick: () => {
        dispatch(actionForTitrationIntent({ type: "wash_bottle_clicked" }));
        getLabSounds().playFromGesture("rinse_fill");
      },
      onTitrantBottleClick: () => {
        dispatch(actionForTitrationIntent({ type: "titrant_bottle_clicked" }));
        getLabSounds().playFromGesture("rinse_fill");
      },
      onFunnelClick: () => {
        dispatch(
          actionForTitrationIntent({
            type: "funnel_clicked",
            volumeML: fillVolumeML
          })
        );
        getLabSounds().playFromGesture("rinse_fill");
      }
    }),
    [dispatch, fillVolumeML]
  );
}
