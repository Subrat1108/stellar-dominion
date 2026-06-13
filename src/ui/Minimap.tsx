// System minimap — a small top-down radar in the corner.
//
// Shows the star, planets, and the ship to scale (projected onto the orbital
// plane: world X horizontal, world Z vertical). Clicking a body sets an
// autopilot course to it (same path as SystemPanel's "SET COURSE").
//
// System-scale only — no galaxy/interstellar zoom (deferred to Phase 5, docs/05).
// Reads live from the world ref each tick (low-frequency).

import type { World } from "../sim/ecs/world.ts";
import type { GameBus } from "../app/game-bus.ts";
import { useGameTick } from "./hooks/useGameTick.ts";

interface MinimapProps {
  world: World;
  bus: GameBus;
}

const SIZE = 168;          // px, square
const PAD = 10;            // inner margin so edge markers aren't clipped
const SYSTEM_RADIUS = 760; // scene units mapped to the radar edge (Titan's Eye ~704 + margin)
const R = SIZE / 2 - PAD;  // px radius for SYSTEM_RADIUS scene units

function colorForBody(color: number): string {
  return "#" + color.toString(16).padStart(6, "0");
}

export default function Minimap({ world, bus }: MinimapProps) {
  useGameTick(bus, 8);

  const cx = SIZE / 2;
  const cy = SIZE / 2;

  // World (x, z) → radar px, clamped to the radar disc so far-flung markers
  // pin to the edge instead of escaping the box.
  function project(wx: number, wz: number): { x: number; y: number } {
    let px = (wx / SYSTEM_RADIUS) * R;
    let py = (wz / SYSTEM_RADIUS) * R;
    const mag = Math.hypot(px, py);
    if (mag > R) { px = (px / mag) * R; py = (py / mag) * R; }
    return { x: cx + px, y: cy + py };
  }

  function setCourse(entityId: number) {
    const ctrl = world.components.shipControl.get(world.shipId);
    if (ctrl) {
      ctrl.autopilotTargetId = entityId;
      ctrl.autopilotActive = true;
    }
  }

  const shipPos = world.components.transform.get(world.shipId)?.position ?? { x: 0, y: 0, z: 0 };
  const ship = project(shipPos.x, shipPos.z);

  const bodies = [...world.components.celestialBody.entries()];

  return (
    <div
      className="interactive"
      style={{
        position: "absolute",
        top: 48,
        left: 10,
        width: SIZE,
        height: SIZE,
        background: "rgba(5,6,10,0.82)",
        border: "1px solid #1e2030",
        borderRadius: 6,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 4,
          left: 8,
          font: "10px/1 ui-monospace, monospace",
          color: "#585b70",
          letterSpacing: 1,
          pointerEvents: "none",
        }}
      >
        ◎ SYSTEM
      </div>

      <svg width={SIZE} height={SIZE} style={{ display: "block" }}>
        {/* radar rings */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#1e2030" />
        <circle cx={cx} cy={cy} r={R * 0.5} fill="none" stroke="#161824" />

        {/* bodies */}
        {bodies.map(([id, body]) => {
          const bp = world.components.transform.get(id)?.position ?? { x: 0, y: 0, z: 0 };
          const p = project(bp.x, bp.z);
          const isStar = body.kind === "star";
          const r = isStar ? 4 : 3;
          const fill = colorForBody(body.color);
          return (
            <circle
              key={id}
              cx={p.x}
              cy={p.y}
              r={r}
              fill={fill}
              stroke={isStar ? "#000" : "transparent"}
              style={{ cursor: isStar ? "default" : "pointer" }}
              onClick={isStar ? undefined : () => setCourse(id)}
            >
              <title>{body.name}{isStar ? "" : " — set course"}</title>
            </circle>
          );
        })}

        {/* ship marker */}
        <circle cx={ship.x} cy={ship.y} r={2.5} fill="#89b4fa" />
        <circle cx={ship.x} cy={ship.y} r={5} fill="none" stroke="#89b4fa" strokeOpacity={0.5} />
      </svg>
    </div>
  );
}
