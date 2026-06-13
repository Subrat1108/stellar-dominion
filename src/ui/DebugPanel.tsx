// Debug overlay — live ship telemetry for testing the flight model.
//
// Bottom-left, monospace. Reads straight from the world ref each tick so a
// screenshot is enough to verify position / velocity / orientation / view.
// Also mirrors the same line to the console (throttled) for log-based testing.

import { useRef } from "react";
import type { World } from "../sim/ecs/world.ts";
import type { GameBus } from "../app/game-bus.ts";
import type { SpeedMultiplier } from "../app/speed-state.ts";
import { viewState } from "../app/view-state.ts";
import { useGameTick } from "./hooks/useGameTick.ts";

interface DebugPanelProps {
  world: World;
  bus: GameBus;
  speedState: { value: SpeedMultiplier };
}

const DEG = 180 / Math.PI;
const f = (n: number, d = 2) => n.toFixed(d);

export default function DebugPanel({ world, bus, speedState }: DebugPanelProps) {
  useGameTick(bus, 10);
  const lastLog = useRef(0);

  const pos  = world.components.transform.get(world.shipId)?.position;
  const vel  = world.components.shipVelocity.get(world.shipId);
  const ctrl = world.components.shipControl.get(world.shipId);
  if (!pos || !vel || !ctrl) return null;

  const speed = Math.hypot(vel.vx, vel.vy, vel.vz);
  const distStar = Math.hypot(pos.x, pos.y, pos.z); // star sits at sim origin

  // Nearest body to the ship — a simple proximity readout for approach feel.
  // The star carries no Transform; it sits at the sim origin (0,0,0).
  let nearestName = "—";
  let nearestDist = Infinity;
  for (const [entity, body] of world.components.celestialBody) {
    const bp = world.components.transform.get(entity)?.position ?? { x: 0, y: 0, z: 0 };
    const d = Math.hypot(pos.x - bp.x, pos.y - bp.y, pos.z - bp.z);
    if (d < nearestDist) { nearestDist = d; nearestName = body.name; }
  }
  const heading = ((ctrl.heading * DEG) % 360 + 360) % 360;
  const pitch = ctrl.pitch * DEG;

  // Throttled console log (≈1 Hz) for log-based testing.
  const now = performance.now();
  if (now - lastLog.current > 1000) {
    lastLog.current = now;
    // eslint-disable-next-line no-console
    console.log(
      `[flight] view=${viewState.view} tick=${world.tick} ` +
      `pos=(${f(pos.x)},${f(pos.y)},${f(pos.z)}) speed=${f(speed)} ` +
      `hdg=${f(heading, 1)}° pitch=${f(pitch, 1)}° distStar=${f(distStar)} ` +
      `throttle=${speedState.value}x autopilot=${ctrl.autopilotActive}`,
    );
  }

  const rows: [string, string][] = [
    ["VIEW", viewState.view.toUpperCase()],
    ["THROTTLE", `${speedState.value}×`],
    ["POS", `${f(pos.x)}, ${f(pos.y)}, ${f(pos.z)}`],
    ["VEL", `${f(vel.vx)}, ${f(vel.vy)}, ${f(vel.vz)}`],
    ["SPEED", f(speed)],
    ["HEADING", `${f(heading, 1)}°`],
    ["PITCH", `${f(pitch, 1)}°`],
    ["DIST→STAR", f(distStar)],
    ["NEAREST", `${nearestName} ${f(nearestDist, 1)}`],
    ["AUTOPILOT", ctrl.autopilotActive ? "ON" : "off"],
  ];

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        bottom: 0,
        margin: 10,
        padding: "8px 12px",
        background: "rgba(5,6,10,0.82)",
        border: "1px solid #1e2030",
        borderRadius: 4,
        font: "11px/1.5 ui-monospace, monospace",
        color: "#a6adc8",
        pointerEvents: "none",
        minWidth: 190,
      }}
    >
      <div style={{ color: "#f9e2af", letterSpacing: 1, marginBottom: 4 }}>
        ⚙ DEBUG
      </div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ color: "#585b70" }}>{k}</span>
          <span style={{ color: "#cdd6f4" }}>{v}</span>
        </div>
      ))}
      <div style={{ color: "#585b70", marginTop: 6, fontSize: 10 }}>
        W/S thrust · A/D steer · ↑↓ pitch · C view · M map
      </div>
    </div>
  );
}
