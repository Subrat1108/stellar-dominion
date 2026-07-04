// HUD — top strip showing the survival clock, crew status, materials, and speed.
//
// Reads live from the world ref each render (triggered by useGameTick).
// Deliberately minimal: dark, monospace, no external CSS framework.

import type { World } from "../sim/ecs/world.ts";
import type { GameBus } from "../app/game-bus.ts";
import { useGameTick } from "./hooks/useGameTick.ts";
import { dispatch } from "../app/command-bus.ts";
import { lifeSupportFraction, ticksRemaining } from "../sim/systems/life-support.ts";
import { FIXED_DT } from "../sim/loop.ts";

interface HUDProps {
  world: World;
  bus: GameBus;
}

/** Format a tick count as MM:SS of real time at 60 ticks/sec. */
function formatCountdown(ticks: number): string {
  const totalSec = Math.ceil(ticks * FIXED_DT);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function LifeSupportBar({ fraction }: { fraction: number }) {
  const pct = Math.round(fraction * 100);
  const color =
    fraction > 0.5 ? "#4caf50" : fraction > 0.25 ? "#ff9800" : "#f44336";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ minWidth: 36, textAlign: "right" }}>{pct}%</span>
      <div
        style={{
          width: 120,
          height: 6,
          background: "#1e2030",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            transition: "width 0.3s, background 0.3s",
          }}
        />
      </div>
    </div>
  );
}

export default function HUD({ world, bus }: HUDProps) {
  useGameTick(bus, 6);

  const ctrl = world.components.shipControl.get(world.shipId);
  const autopilotActive = ctrl?.autopilotActive ?? false;
  const vel = world.components.shipVelocity.get(world.shipId);
  const speedU = vel ? Math.hypot(vel.vx, vel.vy, vel.vz) : 0;

  function cancelAutopilot() {
    dispatch(world, { kind: "CancelCourse" });
  }

  const ls = world.components.lifeSupport.get(world.shipId);
  const crew = world.components.crew.get(world.shipId);
  const inv = world.components.inventory.get(world.shipId);

  const fraction = ls ? lifeSupportFraction(ls.current, ls.capacity) : 1;
  const remaining = ls ? ticksRemaining(ls.current, ls.depletionRatePerTick) : Infinity;
  const countdown = Number.isFinite(remaining) ? formatCountdown(remaining) : "--:--";
  const crewCount = crew?.members.length ?? 0;
  const avgHealth = crew
    ? crew.members.reduce((s, m) => s + m.health, 0) / crewCount
    : 1;

  return (
    <div
      className="interactive"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        padding: "8px 14px",
        background: "rgba(5,6,10,0.82)",
        borderBottom: "1px solid #1e2030",
        display: "flex",
        alignItems: "center",
        gap: 24,
        lineHeight: 1.4,
        userSelect: "none",
      }}
    >
      {/* Ship name */}
      <span style={{ fontWeight: "bold", color: "#89b4fa", letterSpacing: 1 }}>
        ISS PROMETHEUS
      </span>

      {/* Life support */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#a6adc8", fontSize: 11 }}>LIFE SUPPORT</span>
        <LifeSupportBar fraction={fraction} />
        <span
          style={{
            color: fraction < 0.25 ? "#f38ba8" : "#a6adc8",
            fontSize: 11,
            minWidth: 50,
          }}
        >
          {countdown}
        </span>
      </div>

      {/* Crew */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "#a6adc8", fontSize: 11 }}>CREW</span>
        <span>{crewCount}</span>
        <span style={{ color: "#a6adc8", fontSize: 11 }}>
          ({Math.round(avgHealth * 100)}% health)
        </span>
      </div>

      {/* Materials */}
      {inv && (
        <div style={{ display: "flex", gap: 14 }}>
          <MatChip label="METAL" value={inv.metals} />
          <MatChip label="FUEL" value={inv.fuel} />
          <MatChip label="FOOD" value={inv.food} />
        </div>
      )}

      {/* Autopilot cancel — shown only when active */}
      {autopilotActive && (
        <button
          onClick={cancelAutopilot}
          style={{
            padding: "2px 9px",
            fontSize: 11,
            fontFamily: "inherit",
            cursor: "pointer",
            background: "#3a1e2f",
            color: "#f38ba8",
            border: "1px solid #6e3050",
            borderRadius: 3,
          }}
        >
          ✕ AUTOPILOT
        </button>
      )}

      {/* Speed readout — right-aligned (no throttle gears; W/S accelerate) */}
      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ color: "#585b70", fontSize: 11 }}>SPEED</span>
        <span style={{ color: "#cdd6f4", fontSize: 12, minWidth: 64, textAlign: "right" }}>
          {speedU.toFixed(1)} u/s
        </span>
      </div>
    </div>
  );
}

function MatChip({ label, value }: { label: string; value: number }) {
  return (
    <span>
      <span style={{ color: "#585b70", fontSize: 11 }}>{label} </span>
      <span>{value}</span>
    </span>
  );
}
