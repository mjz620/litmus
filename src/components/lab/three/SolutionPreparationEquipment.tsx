import { CanvasTexture, DoubleSide } from "three";

import { GlassMaterial, type GlassQuality } from "./glassMaterials";
import { LAB_PALETTE } from "./labPalette";

/** Dry reagent shown in the boat, the stock jar, and before it dissolves. */
const SOLID_REAGENT_COLOR = LAB_PALETTE.solidReagent;
import {
  WASH_SQUEEZE_BOTTLE_HIT,
  WashSqueezeBottle
} from "./WashSqueezeBottle";

/**
 * Default liquid tint for a vessel whose contents publish no appearance —
 * distilled water, and every colourless solute. Previously every vessel in
 * this file hard-coded this value, so a dilution looked identical at every
 * concentration.
 */
const DEFAULT_LIQUID_COLOR = "#8FC9DF";

interface LiquidFillProps {
  readonly fillFraction?: number;
  /** Shared laboratory-glass tier; matches the titration flask. */
  readonly quality?: GlassQuality;
  /**
   * Engine-projected liquid colour. Resolved from the reagent's published
   * appearance and its current concentration, so the same vessel darkens or
   * pales as the solution is made up.
   */
  readonly liquidColor?: string;
}

/*
 * Balance readouts are drawn once per distinct displayed string and reused.
 * The scene renders on demand and a reading only changes when the engine
 * reports a new mass, so the working set stays small; the cap is a backstop
 * against a long session accumulating textures.
 */
const balanceReadoutTextures = new Map<string, CanvasTexture>();
const MAX_BALANCE_READOUT_TEXTURES = 48;

function getBalanceReadoutTexture(text: string): CanvasTexture | null {
  const cached = balanceReadoutTextures.get(text);
  if (cached) return cached;
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 74;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.fillStyle = "#0d2b26";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#7ef2d6";
  context.textAlign = "right";
  context.textBaseline = "middle";
  context.font = "600 44px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(text, canvas.width - 14, canvas.height / 2 + 2);

  const texture = new CanvasTexture(canvas);
  texture.anisotropy = 1;
  if (balanceReadoutTextures.size >= MAX_BALANCE_READOUT_TEXTURES) {
    const oldest = balanceReadoutTextures.keys().next().value;
    if (oldest !== undefined) {
      balanceReadoutTextures.get(oldest)?.dispose();
      balanceReadoutTextures.delete(oldest);
    }
  }
  balanceReadoutTextures.set(text, texture);
  return texture;
}

/**
 * Registered balance projection. Chemistry and mass stay in the engine.
 *
 * `readingG` is the engine-owned mass already quantised to the balance's
 * resolution — this only prints it. The tare pad is a real hit target so the
 * technique can be performed on the instrument rather than only in the side
 * panel, which is where a student would reach for it.
 */
export function LaboratoryBalance({
  readingG = null,
  tareHighlighted = false
}: {
  readonly readingG?: number | null;
  readonly tareHighlighted?: boolean;
}) {
  const display = readingG === null ? "—— g" : `${readingG.toFixed(2)} g`;
  const readout = getBalanceReadoutTexture(display);
  return (
    <group>
      <mesh position={[0, 0.035, 0]}>
        <boxGeometry args={[0.27, 0.07, 0.2]} />
        <meshStandardMaterial color="#d8d9d3" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.018, 24]} />
        <meshStandardMaterial
          color="#aeb8b5"
          metalness={0.35}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, 0.052, 0.102]}>
        <boxGeometry args={[0.12, 0.035, 0.012]} />
        <meshStandardMaterial
          color="#173d36"
          emissive="#1d6a5d"
          emissiveIntensity={0.2}
        />
      </mesh>
      {readout && (
        <mesh position={[0, 0.052, 0.1085]}>
          <planeGeometry args={[0.112, 0.03]} />
          <meshBasicMaterial map={readout} toneMapped={false} />
        </mesh>
      )}
      {/* Tare pad, front-left of the display. */}
      <mesh position={[-0.082, 0.0715, 0.075]}>
        <boxGeometry args={[0.038, 0.008, 0.024]} />
        <meshStandardMaterial
          color={tareHighlighted ? LAB_PALETTE.hoverMint : "#8d9995"}
          emissive={tareHighlighted ? LAB_PALETTE.hoverMint : "#000000"}
          emissiveIntensity={tareHighlighted ? 0.35 : 0}
          roughness={0.5}
        />
      </mesh>
    </group>
  );
}

export const LABORATORY_BALANCE_HIT = {
  radius: 0.16,
  height: 0.12,
  centerY: 0.06,
  labelY: 0.18
} as const;

/**
 * Low-mass weighing vessel used for tare and transfer technique.
 *
 * A weighing boat is a shallow dish that holds a sample, so it has to read as
 * concave. This previously capped a flat base with an upward hemisphere, which
 * rendered as a solid dome — the boat looked inverted and nothing could
 * visibly sit in it. It is now a square flared frustum with an open top: a
 * flat base, walls splaying outward, and a visible well.
 *
 * `solidFraction` is the engine-owned amount of solid resting in the well.
 */
export function WeighingBoat({
  solidFraction = 0,
  solidColor = SOLID_REAGENT_COLOR
}: {
  readonly solidFraction?: number;
  readonly solidColor?: string;
}) {
  const heaped = Math.max(0, Math.min(1, solidFraction));
  return (
    <group>
      <mesh position={[0, 0.003, 0]} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[0.052, 0.052, 0.006, 4]} />
        <meshStandardMaterial color="#f5f1df" roughness={0.85} />
      </mesh>
      {/* Open-ended so the inside of the dish is visible from the bench camera. */}
      <mesh position={[0, 0.018, 0]} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[0.078, 0.052, 0.024, 4, 1, true]} />
        <meshStandardMaterial
          color="#f5f1df"
          roughness={0.85}
          side={DoubleSide}
        />
      </mesh>
      {heaped > 0 && (
        /*
         * A cone that rises past the 0.024 m rim.
         *
         * A low, flat bed sat entirely inside the well and the flared walls
         * occluded it at bench camera height — the sample was present in the
         * engine and invisible on screen. Weighed solid mounds up anyway, so
         * the pile peaks above the rim and reads from any angle.
         */
        <mesh position={[0, 0.006 + (0.018 + heaped * 0.022) / 2, 0]}>
          <cylinderGeometry
            args={[0, 0.026 + heaped * 0.016, 0.018 + heaped * 0.022, 14]}
          />
          <meshStandardMaterial color={solidColor} roughness={0.95} />
        </mesh>
      )}
    </group>
  );
}

export const WEIGHING_BOAT_HIT = {
  radius: 0.11,
  height: 0.08,
  centerY: 0.04,
  labelY: 0.13
} as const;

/** Local-origin verified visual for the registered 10 mL volumetric pipette. */
export function VolumetricPipette({
  fillFraction = 0,
  quality = "high",
  liquidColor = DEFAULT_LIQUID_COLOR
}: LiquidFillProps) {
  const clamped = Math.max(0, Math.min(1, fillFraction));
  return (
    <group>
      <mesh position={[0, 0.012, 0]}>
        <cylinderGeometry args={[0.075, 0.09, 0.025, 20]} />
        <meshStandardMaterial color="#5b6663" roughness={0.55} />
      </mesh>
      <mesh position={[-0.06, 0.28, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.58, 12]} />
        <meshStandardMaterial color="#606b68" roughness={0.48} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.014, 0.009, 0.74, 16]} />
        <GlassMaterial quality={quality} thickness={0.0025} />
      </mesh>
      <mesh position={[0, 0.43, 0]} scale={[1, 1.5, 1]}>
        <sphereGeometry args={[0.032, 18, 12]} />
        <GlassMaterial quality={quality} thickness={0.0025} />
      </mesh>
      {clamped > 0 && (
        <mesh position={[0, 0.1 + clamped * 0.29, 0]}>
          <cylinderGeometry args={[0.009, 0.009, clamped * 0.58, 12]} />
          <meshStandardMaterial
            color={liquidColor}
            transparent
            opacity={0.78}
          />
        </mesh>
      )}
      <mesh position={[0, 0.63, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.017, 0.0016, 6, 24]} />
        <meshStandardMaterial color="#2f4d4a" />
      </mesh>
    </group>
  );
}

export const VOLUMETRIC_PIPETTE_HIT = {
  // Spans the stand base (r 0.09) and the offset support rod at x -0.072,
  // both of which are part of the visual and were previously unclickable.
  radius: 0.095,
  height: 0.8,
  centerY: 0.4,
  labelY: 0.84
} as const;

/** Local-origin verified visual for the registered 100 mL volumetric flask. */
export function VolumetricFlask({
  fillFraction = 0,
  quality = "high",
  liquidColor = DEFAULT_LIQUID_COLOR
}: LiquidFillProps) {
  const clamped = Math.max(0, Math.min(1, fillFraction));
  return (
    <group>
      <mesh position={[0, 0.06, 0]} scale={[1, 1.15, 1]}>
        <sphereGeometry args={[0.105, 24, 16]} />
        <GlassMaterial quality={quality} thickness={0.004} />
      </mesh>
      {clamped > 0 && (
        <mesh position={[0, 0.015 + clamped * 0.035, 0]} scale={[1, 0.7, 1]}>
          <sphereGeometry args={[0.092 * Math.max(0.38, clamped), 20, 12]} />
          <meshStandardMaterial
            color={liquidColor}
            transparent
            opacity={0.72}
          />
        </mesh>
      )}
      <mesh position={[0, 0.23, 0]}>
        <cylinderGeometry args={[0.025, 0.035, 0.28, 18, 1, true]} />
        <GlassMaterial quality={quality} thickness={0.003} />
      </mesh>
      <mesh position={[0, 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.028, 0.0018, 6, 30]} />
        <meshStandardMaterial color={LAB_PALETTE.selectionTeal} />
      </mesh>
      <mesh position={[0, 0.39, 0]}>
        <cylinderGeometry args={[0.029, 0.032, 0.04, 16]} />
        <meshStandardMaterial color="#49615c" roughness={0.65} />
      </mesh>
    </group>
  );
}

export const VOLUMETRIC_FLASK_HIT = {
  radius: 0.12,
  height: 0.42,
  centerY: 0.2,
  labelY: 0.46
} as const;

/**
 * Distilled-water wash bottle — same squeeze-bottle model as the titration
 * wash station, seated on the local placement origin.
 */
export function DistilledWaterWashBottle({
  fillFraction = 0.75,
  quality = "high"
}: LiquidFillProps) {
  return (
    <WashSqueezeBottle
      showLabel
      fillFraction={fillFraction}
      quality={quality}
    />
  );
}

export const DISTILLED_WASH_BOTTLE_HIT = WASH_SQUEEZE_BOTTLE_HIT;

/** Local-origin stock-solution / aqueous reagent bottle. */
export function RegisteredReagentBottle({
  fillFraction = 0.7,
  quality = "high",
  contents = "liquid",
  liquidColor = DEFAULT_LIQUID_COLOR
}: LiquidFillProps & {
  /**
   * Phase of the registered material inside. A solid stock jar previously
   * rendered the same translucent blue column as an aqueous reagent, so
   * ammonium nitrate crystals read as a bottle of clear liquid. Solids get an
   * opaque, flat-topped granular bed instead.
   */
  readonly contents?: "liquid" | "solid";
}) {
  const clamped = Math.max(0, Math.min(1, fillFraction));
  const solid = contents === "solid";
  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.062, 0.07, 0.24, 20]} />
        <GlassMaterial quality={quality} thickness={0.004} />
      </mesh>
      {clamped > 0 && (
        <mesh position={[0, 0.005 + clamped * 0.085, 0]}>
          <cylinderGeometry args={[0.057, 0.062, clamped * 0.18, 18]} />
          {solid ? (
            <meshStandardMaterial
              color={SOLID_REAGENT_COLOR}
              roughness={0.95}
            />
          ) : (
            <meshStandardMaterial
              color={liquidColor}
              transparent
              opacity={0.76}
            />
          )}
        </mesh>
      )}
      <mesh position={[0, 0.245, 0]}>
        <cylinderGeometry args={[0.035, 0.043, 0.07, 16]} />
        <meshStandardMaterial color="#263f3b" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.1, 0.063]}>
        <planeGeometry args={[0.082, 0.07]} />
        <meshStandardMaterial color="#f7f2df" roughness={0.85} />
      </mesh>
    </group>
  );
}

export const REAGENT_BOTTLE_HIT = {
  radius: 0.075,
  height: 0.3,
  centerY: 0.14,
  labelY: 0.34
} as const;

/** Expanded-polystyrene surface: matte, unlit-looking, no specular sheen. */
const STYROFOAM_MATERIAL = {
  color: "#f7f6f2",
  roughness: 0.97,
  metalness: 0
} as const;

/** Lid cut from the same foam stock, shaded a touch darker to read separately. */
const STYROFOAM_LID_MATERIAL = {
  color: "#e9e7e0",
  roughness: 0.95,
  metalness: 0
} as const;

const CUP_RIM_Y = 0.16;
const CUP_LID_OPEN_Y = 0.26;

/**
 * Local-origin coffee-cup calorimeter: two nested expanded-polystyrene cups
 * with a foam lid, which is what "coffee-cup calorimetry" actually uses. It is
 * not a ceramic mug — there is no handle, and the taper widens toward the rim.
 */
export function Calorimeter({
  fillFraction = 0,
  lidClosed = true,
  hideLid = false
}: LiquidFillProps & {
  readonly lidClosed?: boolean;
  readonly hideLid?: boolean;
}) {
  const clamped = Math.max(0, Math.min(1, fillFraction));
  return (
    <group>
      {/* Outer cup — the insulating sleeve of the nested pair. */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.1, 0.074, CUP_RIM_Y, 28, 1, true]} />
        <meshStandardMaterial {...STYROFOAM_MATERIAL} side={2} />
      </mesh>
      <mesh position={[0, 0.002, 0]}>
        <cylinderGeometry args={[0.074, 0.074, 0.004, 28]} />
        <meshStandardMaterial {...STYROFOAM_MATERIAL} />
      </mesh>

      {/* Inner cup — seated inside, holding the reaction mixture. */}
      <mesh position={[0, 0.088, 0]}>
        <cylinderGeometry args={[0.092, 0.068, 0.148, 28, 1, true]} />
        <meshStandardMaterial {...STYROFOAM_MATERIAL} side={2} />
      </mesh>
      <mesh position={[0, 0.016, 0]}>
        <cylinderGeometry args={[0.068, 0.068, 0.004, 28]} />
        <meshStandardMaterial {...STYROFOAM_MATERIAL} />
      </mesh>

      {/* Rolled rim — the thick lip a foam cup is recognisable by. */}
      <mesh position={[0, CUP_RIM_Y, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.098, 0.006, 8, 32]} />
        <meshStandardMaterial {...STYROFOAM_MATERIAL} />
      </mesh>

      {clamped > 0 && (
        <mesh position={[0, 0.022 + clamped * 0.05, 0]}>
          <cylinderGeometry args={[0.082, 0.07, clamped * 0.1, 24]} />
          <meshStandardMaterial color="#8fc9df" transparent opacity={0.72} />
        </mesh>
      )}

      {!hideLid && (
        <group
          position={[0, lidClosed ? CUP_RIM_Y + 0.012 : CUP_LID_OPEN_Y, 0]}
        >
          <mesh>
            <cylinderGeometry args={[0.103, 0.103, 0.012, 28]} />
            <meshStandardMaterial {...STYROFOAM_LID_MATERIAL} />
          </mesh>
          {/* Port the thermometer probe drops through. */}
          <mesh position={[0, 0.007, 0]}>
            <cylinderGeometry args={[0.011, 0.011, 0.004, 12]} />
            <meshStandardMaterial color="#4a544f" roughness={0.8} />
          </mesh>
        </group>
      )}
    </group>
  );
}

export const CALORIMETER_HIT = {
  // Tall enough to keep the lifted lid inside the hit volume.
  radius: 0.11,
  height: 0.29,
  centerY: 0.145,
  labelY: 0.33
} as const;

/** Local-origin digital thermometer probe for coffee-cup calorimetry. */
/** Vertical drop applied to the probe while it rests at its own station. */
export const THERMOMETER_PLACED_DROP = 0.04;

/**
 * Lift applied to the probe when it is seated in a vessel, measured so the
 * bulb (local y -0.11) sits just above the cup floor while the readout head
 * stays clear of the rim.
 */
export const THERMOMETER_SEATED_LIFT = 0.14;

export function Thermometer({
  placed = false,
  hidden = false
}: {
  readonly placed?: boolean;
  readonly hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <group position={[0, placed ? -THERMOMETER_PLACED_DROP : 0, 0]}>
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[0.045, 0.09, 0.02]} />
        <meshStandardMaterial color="#2f3d3a" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.16, 0.011]}>
        <planeGeometry args={[0.032, 0.05]} />
        <meshStandardMaterial
          color="#8fd6c4"
          emissive="#1a4a3f"
          emissiveIntensity={0.25}
        />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.22, 10]} />
        <meshStandardMaterial
          color="#c5d0cc"
          metalness={0.35}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, -0.1, 0]}>
        <sphereGeometry args={[0.01, 12, 10]} />
        <meshStandardMaterial color="#b85c4a" roughness={0.4} />
      </mesh>
    </group>
  );
}

export const THERMOMETER_HIT = {
  // Spans the readout head down to the bulb tip at y -0.11.
  radius: 0.04,
  height: 0.33,
  centerY: 0.05,
  labelY: 0.28
} as const;
