import type { CSSProperties } from "react";

import {
  formatBuretteVolume,
  formatPH
} from "../../experiments/titration/display";

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
      <section style={styles.card} aria-labelledby="ph-curve-heading">
        <p style={styles.eyebrow}>Live measurement</p>
        <h2 id="ph-curve-heading" style={styles.heading}>
          pH curve
        </h2>
        <p style={styles.empty}>
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
    <section style={styles.card} aria-labelledby="ph-curve-heading">
      <div style={styles.headingRow}>
        <div>
          <p style={styles.eyebrow}>Live measurement</p>
          <h2 id="ph-curve-heading" style={styles.heading}>
            pH curve
          </h2>
        </div>
        <output style={styles.currentReading}>
          {formatBuretteVolume(currentPoint.volumeML)} mL · pH{" "}
          {formatPH(currentPoint.pH)}
        </output>
      </div>

      <p style={styles.summary}>{summary}</p>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={summary}
        style={styles.chart}
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
                stroke="#d8e2df"
                strokeWidth="1"
              />
              <text
                x={MARGIN.left - 12}
                y={y + 5}
                textAnchor="end"
                fill="#52616b"
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
                stroke="#edf3f1"
                strokeWidth="1"
              />
              <text
                x={x}
                y={HEIGHT - 18}
                textAnchor="middle"
                fill="#52616b"
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
          stroke="#52616b"
          strokeWidth="2"
        />
        <line
          x1={MARGIN.left}
          x2={WIDTH - MARGIN.right}
          y1={HEIGHT - MARGIN.bottom}
          y2={HEIGHT - MARGIN.bottom}
          stroke="#52616b"
          strokeWidth="2"
        />

        {points.length > 1 && (
          <polyline
            points={coordinates}
            fill="none"
            stroke="#0f766e"
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        <circle
          cx={currentX}
          cy={currentY}
          r="6"
          fill="#0f766e"
          stroke="#ffffff"
          strokeWidth="3"
        />

        <text
          x={18}
          y={HEIGHT / 2}
          textAnchor="middle"
          fill="#34434d"
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
          fill="#34434d"
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

const styles: Record<string, CSSProperties> = {
  card: {
    display: "grid",
    gap: "0.9rem",
    marginTop: "1.5rem",
    paddingTop: "1.5rem",
    borderTop: "1px solid #d8e2df"
  },
  headingRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "1rem"
  },
  eyebrow: {
    margin: "0 0 0.5rem",
    color: "#0f766e",
    fontSize: "0.72rem",
    fontWeight: 750,
    letterSpacing: "0.08em",
    textTransform: "uppercase"
  },
  heading: {
    margin: 0,
    fontSize: "1.35rem"
  },
  currentReading: {
    padding: "0.55rem 0.75rem",
    borderRadius: "999px",
    background: "#e6f4f1",
    color: "#115e59",
    fontSize: "0.85rem",
    fontWeight: 750,
    fontVariantNumeric: "tabular-nums"
  },
  summary: {
    margin: 0,
    color: "#52616b",
    fontSize: "0.9rem",
    lineHeight: 1.5
  },
  empty: {
    margin: 0,
    padding: "1.25rem",
    border: "1px dashed #aebfbb",
    borderRadius: "0.8rem",
    background: "#f8faf9",
    color: "#52616b"
  },
  chart: {
    display: "block",
    width: "100%",
    height: "auto",
    overflow: "visible",
    border: "1px solid #d8e2df",
    borderRadius: "0.8rem",
    background: "#ffffff"
  }
};
