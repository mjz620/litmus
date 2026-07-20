"use client";

import { useEffect, useRef } from "react";

import {
  INDICATOR_SPECIFICATIONS,
  type IndicatorId
} from "../../../experiments/titration/titration";

import styles from "./IndicatorSelectionDialog.module.css";

const INDICATOR_LABELS: Readonly<Record<IndicatorId, string>> = {
  phenolphthalein: "Phenolphthalein",
  bromothymol_blue: "Bromothymol blue",
  methyl_orange: "Methyl orange"
};

export function getIndicatorLabel(indicator: IndicatorId): string {
  return INDICATOR_LABELS[indicator];
}

export function IndicatorSelectionDialog({
  indicator,
  onCancel,
  onConfirm
}: {
  indicator: IndicatorId;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const specification = INDICATOR_SPECIFICATIONS[indicator];
  const label = getIndicatorLabel(indicator);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="indicator-dialog-heading"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <p className={styles.eyebrow}>Review before adding</p>
      <h2 id="indicator-dialog-heading">{label}</h2>
      <p className={styles.intro}>
        This indicator changes over pH {specification.lowMax.toFixed(1)}–
        {specification.highMin.toFixed(1)}. Confirm only when you are ready to
        add it to the flask.
      </p>

      <dl className={styles.rangeList}>
        <div>
          <dt>Below pH {specification.lowMax.toFixed(1)}</dt>
          <dd data-color={specification.low}>{specification.low}</dd>
        </div>
        <div>
          <dt>
            pH {specification.lowMax.toFixed(1)}–
            {specification.highMin.toFixed(1)}
          </dt>
          <dd data-color={specification.mid}>{specification.mid}</dd>
        </div>
        <div>
          <dt>Above pH {specification.highMin.toFixed(1)}</dt>
          <dd data-color={specification.high}>{specification.high}</dd>
        </div>
      </dl>

      <p className={styles.warning}>
        Only one indicator may be added. It cannot be changed or added again
        during this session.
      </p>

      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Keep reviewing
        </button>
        <button type="button" className={styles.confirm} onClick={onConfirm}>
          Add {label} to flask
        </button>
      </div>
    </dialog>
  );
}
