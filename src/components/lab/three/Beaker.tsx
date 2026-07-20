import { LAB_PALETTE } from "./labPalette";

const BEAKER_RADIUS = 0.075;
const BEAKER_HEIGHT = 0.115;

interface BeakerProps {
  /** Fill level as a fraction of working volume. */
  readonly fillFraction?: number;
  /** Engine-owned contents appearance; "clear" renders as plain water. */
  readonly contentsColor?: string;
}

/**
 * Named appearances the engines project into vessel contents. Precipitate
 * colours are authored words, not hex, so they stay readable in state and
 * events; the mapping to pixels belongs here in the view layer.
 */
const CONTENTS_COLORS: Readonly<Record<string, string>> = Object.freeze({
  clear: "#cfe6ef",
  white: "#eef2f4",
  blue: "#5b9fd4",
  "rust brown": "#a35c33",
  yellow: "#e3c65a",
  pink: "#e39ec2"
});

function resolveContentsColor(contentsColor: string): string {
  return CONTENTS_COLORS[contentsColor] ?? CONTENTS_COLORS.clear;
}

/**
 * Local-origin general-purpose beaker. Straight walls, a rolled rim and a
 * moulded pour spout — the everyday vessel labs pour into.
 */
export function Beaker({
  fillFraction = 0,
  contentsColor = "clear"
}: BeakerProps) {
  const clamped = Math.max(0, Math.min(1, fillFraction));
  const liquidHeight = clamped * (BEAKER_HEIGHT - 0.014);

  return (
    <group>
      {/* Wall — open-ended and double-sided so the interior reads correctly. */}
      <mesh position={[0, BEAKER_HEIGHT / 2, 0]}>
        <cylinderGeometry
          args={[BEAKER_RADIUS, BEAKER_RADIUS * 0.94, BEAKER_HEIGHT, 28, 1, true]}
        />
        <meshPhysicalMaterial
          color={LAB_PALETTE.glassFallback}
          transparent
          opacity={0.34}
          roughness={0.08}
          transmission={0.6}
          thickness={0.015}
          side={2}
        />
      </mesh>

      <mesh position={[0, 0.004, 0]}>
        <cylinderGeometry args={[BEAKER_RADIUS * 0.94, BEAKER_RADIUS * 0.94, 0.008, 28]} />
        <meshPhysicalMaterial
          color={LAB_PALETTE.glassFallback}
          transparent
          opacity={0.42}
          roughness={0.08}
          transmission={0.5}
          thickness={0.012}
        />
      </mesh>

      {/* Rolled rim. */}
      <mesh position={[0, BEAKER_HEIGHT, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[BEAKER_RADIUS, 0.0035, 8, 32]} />
        <meshPhysicalMaterial
          color={LAB_PALETTE.glassFallback}
          transparent
          opacity={0.5}
          roughness={0.06}
          transmission={0.5}
        />
      </mesh>

      {/* Pour spout — the detail that reads "beaker" rather than "jar". */}
      <mesh
        position={[BEAKER_RADIUS * 0.96, BEAKER_HEIGHT - 0.004, 0]}
        rotation={[0, 0, -0.42]}
      >
        <cylinderGeometry args={[0.016, 0.022, 0.02, 12, 1, true]} />
        <meshPhysicalMaterial
          color={LAB_PALETTE.glassFallback}
          transparent
          opacity={0.4}
          roughness={0.08}
          transmission={0.5}
          side={2}
        />
      </mesh>

      {clamped > 0 && (
        <mesh position={[0, 0.008 + liquidHeight / 2, 0]}>
          <cylinderGeometry
            args={[BEAKER_RADIUS * 0.93, BEAKER_RADIUS * 0.9, liquidHeight, 24]}
          />
          <meshStandardMaterial
            color={resolveContentsColor(contentsColor)}
            transparent
            opacity={contentsColor === "clear" ? 0.62 : 0.85}
            roughness={0.42}
          />
        </mesh>
      )}

      {/* Graduation ticks — moulded, so deliberately coarse. */}
      {[0.3, 0.55, 0.8].map((level) => (
        <mesh
          key={level}
          position={[0, BEAKER_HEIGHT * level, BEAKER_RADIUS * 0.99]}
        >
          <planeGeometry args={[0.018, 0.0022]} />
          <meshBasicMaterial color={LAB_PALETTE.graduationInk} transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/** Bounding shell for Interactable hover / hit targeting. */
export const BEAKER_HIT = {
  radius: BEAKER_RADIUS + 0.012,
  height: BEAKER_HEIGHT + 0.02,
  centerY: BEAKER_HEIGHT / 2,
  labelY: BEAKER_HEIGHT + 0.07
} as const;

/** Mouth height for pour targeting. */
export const BEAKER_MOUTH_Y = BEAKER_HEIGHT;
