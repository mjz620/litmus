interface LitmusMarkProps {
  readonly className?: string;
}

/**
 * Litmus identity mark: a paper test strip whose teal tip has reacted.
 * The silhouette stays legible at favicon size and does not imply that AI owns
 * the chemistry—the measured colour change remains the visual idea.
 */
export function LitmusMark({ className }: LitmusMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      height="40"
      viewBox="0 0 64 64"
      width="40"
    >
      <rect width="64" height="64" rx="15" fill="#d98963" />
      <g transform="rotate(-15 32 32)">
        <rect
          x="22"
          y="7"
          width="20"
          height="50"
          rx="6"
          fill="#fffdf8"
          stroke="#172925"
          strokeWidth="3"
        />
        <path
          d="M23.5 38.5c4.5-2.6 8.7 2.6 17 0V51a4.5 4.5 0 0 1-4.5 4.5h-8a4.5 4.5 0 0 1-4.5-4.5V38.5Z"
          fill="#0f766e"
        />
        <path
          d="M28 17h8M28 23h8M28 29h8"
          fill="none"
          stroke="#aebfb9"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}
