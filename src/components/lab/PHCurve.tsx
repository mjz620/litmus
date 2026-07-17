import {
  formatBuretteVolume,
  formatPH
} from "../../experiments/titration/display";

import styles from "./PHCurve.module.css";

export interface PHCurvePoint {
  volumeML: number;
  pH: number;
}

interface PHCurveProps {
  points: readonly PHCurvePoint[];
  maxVolumeML: number;
}

const WIDTH = 720;
const HEIGHT = 300;
const MARGIN = { top: 20, right: 24, bottom: 48, left: 54 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

export function PHCurve({ points, maxVolumeML }: PHCurveProps) {
  const currentPoint = points.at(-1);

  if (!currentPoint) {
    return (
      <section className={styles.card} aria-labelledby="ph-curve-heading">
        <p className={styles.eyebrow}>Live measurement</p>
        <h2 id="ph-curve-heading" className={styles.heading}>
          pH curve
        </h2>
        <p className={styles.empty}>
          Add titrant to record the first pH measurement.
        </p>
      </section>
    );
  }

  const xMaximum = Math.max(maxVolumeML, currentPoint.volumeML, 1);
  const coordinates = points
    .map((point) => `${scaleX(point.volumeML, xMaximum)},${scaleY(point.pH)}`)
    .join(" ");
  const currentX = scaleX(currentPoint.volumeML, xMaximum);
  const currentY = scaleY(currentPoint.pH);
  const measurementLabel = points.length === 1 ? "measurement" : "measurements";
  const summary = `Curve contains ${points.length} ${measurementLabel}. Current reading: ${formatBuretteVolume(currentPoint.volumeML)} mL titrant added, pH ${formatPH(currentPoint.pH)}.`;

  return (
    <section className={styles.card} aria-labelledby="ph-curve-heading">
      <div className={styles.headingRow}>
        <div>
          <p className={styles.eyebrow}>Live measurement</p>
          <h2 id="ph-curve-heading" className={styles.heading}>
            pH curve
          </h2>
        </div>
        <output className={styles.currentReading}>
          {formatBuretteVolume(currentPoint.volumeML)} mL · pH{" "}
          {formatPH(currentPoint.pH)}
        </output>
      </div>

      <p className={styles.summary}>{summary}</p>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={summary}
        className={styles.chart}
        data-point-count={points.length}
      >
        <title>pH versus titrant volume</title>
        <desc>{summary}</desc>

        {[0, 7, 14].map((tick) => {
          const y = scaleY(tick);
          return (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={y}
                y2={y}
                stroke="var(--lab-border, #cbd8d3)"
                strokeWidth="1"
              />
              <text
                x={MARGIN.left - 12}
                y={y + 5}
                textAnchor="end"
                fill="var(--lab-ink-muted, #566762)"
                fontSize="13"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {[0, xMaximum / 2, xMaximum].map((tick) => {
          const x = scaleX(tick, xMaximum);
          return (
            <g key={tick}>
              <line
                x1={x}
                x2={x}
                y1={MARGIN.top}
                y2={HEIGHT - MARGIN.bottom}
                stroke="var(--lab-surface-muted, #edf3ef)"
                strokeWidth="1"
              />
              <text
                x={x}
                y={HEIGHT - 18}
                textAnchor="middle"
                fill="var(--lab-ink-muted, #566762)"
                fontSize="13"
              >
                {formatBuretteVolume(tick)}
              </text>
            </g>
          );
        })}

        <line
          x1={MARGIN.left}
          x2={MARGIN.left}
          y1={MARGIN.top}
          y2={HEIGHT - MARGIN.bottom}
          stroke="var(--lab-ink-muted, #566762)"
          strokeWidth="2"
        />
        <line
          x1={MARGIN.left}
          x2={WIDTH - MARGIN.right}
          y1={HEIGHT - MARGIN.bottom}
          y2={HEIGHT - MARGIN.bottom}
          stroke="var(--lab-ink-muted, #566762)"
          strokeWidth="2"
        />

        {points.length > 1 && (
          <polyline
            points={coordinates}
            fill="none"
            stroke="var(--lab-primary, #0f766e)"
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        <circle
          cx={currentX}
          cy={currentY}
          r="6"
          fill="var(--lab-primary, #0f766e)"
          stroke="var(--lab-surface, #fffdf8)"
          strokeWidth="3"
        />

        <text
          x={18}
          y={HEIGHT / 2}
          textAnchor="middle"
          fill="var(--lab-ink, #172925)"
          fontSize="14"
          fontWeight="700"
          transform={`rotate(-90 18 ${HEIGHT / 2})`}
        >
          pH
        </text>
        <text
          x={MARGIN.left + PLOT_WIDTH / 2}
          y={HEIGHT - 2}
          textAnchor="middle"
          fill="var(--lab-ink, #172925)"
          fontSize="14"
          fontWeight="700"
        >
          Titrant added (mL)
        </text>
      </svg>
    </section>
  );
}

function scaleX(volumeML: number, maxVolumeML: number): number {
  const clamped = Math.max(0, Math.min(maxVolumeML, volumeML));
  return MARGIN.left + (clamped / maxVolumeML) * PLOT_WIDTH;
}

function scaleY(pH: number): number {
  const clamped = Math.max(0, Math.min(14, pH));
  return MARGIN.top + ((14 - clamped) / 14) * PLOT_HEIGHT;
}
