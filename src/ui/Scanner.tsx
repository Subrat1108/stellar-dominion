// Cockpit scanner — appears in flight views when a body is within range.
//
// Reads viewState directly (a plain mutable ref updated by the renderer)
// rather than via a prop, because the renderer runs outside React. Updates
// with each game tick so distance/visibility are always current.

import type { World } from "../sim/ecs/world.ts";
import type { GameBus } from "../app/game-bus.ts";
import type { CelestialBody } from "../sim/ecs/components.ts";
import { viewState } from "../app/view-state.ts";
import { habitabilityLabel, habitabilityColor } from "../sim/math/habitability.ts";
import { useGameTick } from "./hooks/useGameTick.ts";

interface ScannerProps {
  world: World;
  bus: GameBus;
}

const KIND_LABEL: Record<string, string> = {
  star: "Star",
  planet: "Rocky Planet",
  "gas-giant": "Gas Giant",
};

export default function Scanner({ world, bus }: ScannerProps) {
  useGameTick(bus, 10);

  // Hidden in map view.
  if (viewState.view === "map") return null;

  const shipPos = world.components.transform.get(world.shipId)?.position;
  if (!shipPos) return null;

  // Always report the nearest body — at honest scale a fixed detection range is
  // meaningless (bodies are tiny dots), so the scanner is a constant nav aid.
  let nearestId: number | null = null;
  let nearestDist = Infinity;
  let nearestBody: CelestialBody | null = null;

  for (const [id, body] of world.components.celestialBody) {
    const bp = world.components.transform.get(id)?.position ?? { x: 0, y: 0, z: 0 };
    const d = Math.hypot(shipPos.x - bp.x, shipPos.y - bp.y, shipPos.z - bp.z);
    if (d < nearestDist) {
      nearestDist = d;
      nearestId = id;
      nearestBody = body;
    }
  }

  if (!nearestBody || nearestId === null) return null;

  const body = nearestBody;
  const dist = nearestDist;

  const habColor = body.habitability !== undefined
    ? habitabilityColor(body.habitability)
    : null;
  const habLabel = body.habitability !== undefined
    ? habitabilityLabel(body.habitability)
    : null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        minWidth: 220,
        padding: "8px 14px",
        background: "rgba(5,6,10,0.88)",
        border: "1px solid #1e2030",
        borderRadius: 4,
        font: "11px/1.6 ui-monospace, monospace",
        color: "#a6adc8",
        pointerEvents: "none",
        textAlign: "center",
      }}
    >
      <div style={{ color: "#89dceb", fontWeight: "bold", letterSpacing: 1, marginBottom: 2 }}>
        ⊕ {body.name.toUpperCase()}
      </div>
      <div style={{ color: "#585b70", fontSize: 10, marginBottom: 4 }}>
        {KIND_LABEL[body.kind] ?? body.kind}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
        <ScanRow label="DIST" value={`${dist.toFixed(1)} u`} />
        {body.surfaceTempK !== undefined && (
          <ScanRow label="TEMP" value={`${body.surfaceTempK} K`} />
        )}
        {habLabel && habColor && (
          <ScanRow label="HAB" value={habLabel} valueColor={habColor} />
        )}
      </div>
    </div>
  );
}

function ScanRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <span style={{ color: "#585b70", fontSize: 9, letterSpacing: 0.5 }}>{label}</span>
      <span style={{ color: valueColor ?? "#cdd6f4", fontSize: 11 }}>{value}</span>
    </div>
  );
}
