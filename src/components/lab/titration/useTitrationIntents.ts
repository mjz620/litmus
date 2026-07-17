"use client";

import { useMemo } from "react";

import {
  type IndicatorId,
  type TitrationAction
} from "../../../experiments/titration/titration";
import { useLabStore } from "../../../stores/labStore";

export type TitrationIntent =
  | { type: "indicator_bottle_clicked"; indicator: IndicatorId }
  | { type: "wash_bottle_clicked" }
  | { type: "titrant_bottle_clicked" }
  | { type: "funnel_clicked" };

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
      return { type: "fill_burette" };
  }
}

/**
 * Sole new T0112 dispatcher. Scene components report physical gesture facts;
 * this UI-layer hook translates them into existing experiment actions.
 */
export function useTitrationIntents(): TitrationIntentHandlers {
  const dispatch = useLabStore((store) => store.dispatch);

  return useMemo(
    () => ({
      onIndicatorBottleClick: (indicator: IndicatorId) =>
        dispatch(
          actionForTitrationIntent({
            type: "indicator_bottle_clicked",
            indicator
          })
        ),
      onWashBottleClick: () =>
        dispatch(actionForTitrationIntent({ type: "wash_bottle_clicked" })),
      onTitrantBottleClick: () =>
        dispatch(actionForTitrationIntent({ type: "titrant_bottle_clicked" })),
      onFunnelClick: () =>
        dispatch(actionForTitrationIntent({ type: "funnel_clicked" }))
    }),
    [dispatch]
  );
}
