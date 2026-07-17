import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { CSSProperties } from "react";
import { MeshBasicMaterial, MeshStandardMaterial } from "three";

import type { IndicatorId } from "../../../experiments/titration/titration";
import { SHELF } from "./benchLayout";
import { LAB_PALETTE } from "./labPalette";

interface IndicatorBottle {
  id: IndicatorId;
  label: string;
  capColor: string;
}

interface IndicatorShelfProps {
  focused: boolean;
  selectedIndicator: IndicatorId;
  onBottleClick: (indicator: IndicatorId) => void;
}

const INDICATOR_BOTTLES: readonly IndicatorBottle[] = [
  {
    id: "phenolphthalein",
    label: "Phenolphthalein",
    capColor: LAB_PALETTE.phenolphthalein
  },
  {
    id: "bromothymol_blue",
    label: "Bromothymol blue",
    capColor: LAB_PALETTE.bromothymolBlue
  },
  {
    id: "methyl_orange",
    label: "Methyl orange",
    capColor: LAB_PALETTE.methylOrange
  }
];

const shelfMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.wood,
  roughness: 0.78,
  metalness: 0
});
const bottleMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.ceramic,
  roughness: 0.76,
  metalness: 0
});
const hotspotMaterial = new MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  colorWrite: false
});

const HOTSPOT_LABEL_STYLE: CSSProperties = {
  padding: "0.3rem 0.48rem",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--lab-surface) 94%, transparent)",
  boxShadow: "var(--lab-floating-shadow)",
  color: "var(--lab-ink)",
  fontFamily: "system-ui, sans-serif",
  fontSize: "0.64rem",
  fontWeight: 750,
  lineHeight: 1,
  whiteSpace: "nowrap"
};

/**
 * Raised rack of three indicator dropper bottles. Bottle clicks report the
 * selected indicator upward only while the shelf is focused.
 */
export function IndicatorShelf({
  focused,
  selectedIndicator,
  onBottleClick
}: IndicatorShelfProps) {
  return (
    <group>
      <mesh position={[0, SHELF.riserHeight / 2, 0]} material={shelfMaterial}>
        <boxGeometry args={[SHELF.width, SHELF.riserHeight, SHELF.depth]} />
      </mesh>
      <mesh
        position={[0, SHELF.riserHeight + 0.012, -SHELF.depth / 2 + 0.012]}
        material={shelfMaterial}
      >
        <boxGeometry args={[SHELF.width, 0.024, 0.024]} />
      </mesh>

      {INDICATOR_BOTTLES.map((bottle, index) => {
        const x = (index - 1) * SHELF.bottleSpacing;
        const pulledForward =
          focused && selectedIndicator === bottle.id
            ? SHELF.selectedPullForwardZ
            : 0;
        const bodyCenterY = SHELF.riserHeight + SHELF.bottleBodyHeight / 2;
        const capCenterY =
          SHELF.riserHeight +
          SHELF.bottleBodyHeight +
          SHELF.bottleCapHeight / 2;

        function handleClick(event: ThreeEvent<MouseEvent>) {
          event.stopPropagation();
          if (focused) onBottleClick(bottle.id);
        }

        return (
          <group
            key={bottle.id}
            position={[x, 0, pulledForward]}
            onClick={focused ? handleClick : undefined}
          >
            <mesh position={[0, bodyCenterY, 0]} material={bottleMaterial}>
              <cylinderGeometry
                args={[
                  SHELF.bottleRadius * 0.88,
                  SHELF.bottleRadius,
                  SHELF.bottleBodyHeight,
                  12
                ]}
              />
            </mesh>
            <mesh position={[0, capCenterY, 0]}>
              <coneGeometry
                args={[SHELF.bottleRadius * 0.72, SHELF.bottleCapHeight, 12]}
              />
              <meshStandardMaterial
                color={bottle.capColor}
                roughness={0.76}
                metalness={0}
              />
            </mesh>
            <mesh
              position={[
                0,
                SHELF.riserHeight + SHELF.bottleBodyHeight * 0.57,
                SHELF.bottleRadius * 0.9
              ]}
            >
              <boxGeometry
                args={[
                  SHELF.bottleRadius * 1.25,
                  SHELF.bottleBodyHeight * 0.28,
                  0.003
                ]}
              />
              <meshBasicMaterial color={bottle.capColor} />
            </mesh>

            {focused && (
              <>
                <mesh position={[0, bodyCenterY, 0]} material={hotspotMaterial}>
                  <boxGeometry args={[0.12, 0.16, 0.11]} />
                </mesh>
                <Html
                  position={[0, bodyCenterY, 0]}
                  center
                  pointerEvents="auto"
                  style={{ pointerEvents: "auto" }}
                  zIndexRange={[3, 0]}
                  aria-hidden="true"
                >
                  <span
                    data-indicator-bottle-hotspot={bottle.id}
                    style={{
                      ...HOTSPOT_LABEL_STYLE,
                      cursor: "pointer",
                      pointerEvents: "auto"
                    }}
                    onClick={() => onBottleClick(bottle.id)}
                  >
                    {bottle.label}
                  </span>
                </Html>
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}
