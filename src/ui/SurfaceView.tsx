// Placeholder surface view (Phase 2A).
//
// When the ship lands on a body (a Landed event), this overlay eases in over the
// space view — a fade + zoom, NOT a seamless descent (docs/08): the space scene
// stays put underneath and we cross-fade to a surface "deck". It shows the body's
// key stats — including surface gravity computed from mass/radius (the first use
// of gravity-as-a-stat, docs/09 Session 10) — and two stubbed actions:
//   • Found colony here → FoundColony command (no colony sim yet — Phase 2B).
//   • Take off          → TakeOff command, returning the ship to space.

import { useRef, type CSSProperties } from "react";
import type { World } from "../sim/ecs/world.ts";
import type { GameBus } from "../app/game-bus.ts";
import type { CelestialBody } from "../sim/ecs/components.ts";
import { dispatch } from "../app/command-bus.ts";
import { useLandingState } from "./hooks/useLandingState.ts";
import { surfaceGravityG } from "../sim/math/physics.ts";
import { habitabilityLabel, habitabilityColor } from "../sim/math/habitability.ts";

interface SurfaceViewProps {
  world: World;
  bus: GameBus;
}

const KIND_LABEL: Record<string, string> = {
  star: "Star",
  planet: "Rocky Planet",
  "gas-giant": "Gas Giant",
};

export default function SurfaceView({ world, bus }: SurfaceViewProps) {
  const landedBodyId = useLandingState(bus);

  // Remember the last landed body so its stats stay visible during the fade-out.
  const lastIdRef = useRef<number | null>(null);
  if (landedBodyId !== null) lastIdRef.current = landedBodyId;
  const displayId = landedBodyId ?? lastIdRef.current;

  const visible = landedBodyId !== null;
  const body: CelestialBody | undefined =
    displayId !== null && displayId !== undefined
      ? world.components.celestialBody.get(displayId)
      : undefined;

  function foundColony() {
    if (landedBodyId !== null) dispatch(world, { kind: "FoundColony", bodyId: landedBodyId });
  }
  function takeOff() {
    if (landedBodyId !== null) dispatch(world, { kind: "TakeOff" });
  }

  const gravityG = body ? surfaceGravityG(body.massKg, body.radiusM) : 0;
  const habColor = body?.habitability !== undefined ? habitabilityColor(body.habitability) : "#cdd6f4";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        // Eased fade + zoom in/out — surface "deck" over the space view.
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(1.08)",
        transition: "opacity 600ms ease, transform 600ms ease",
        pointerEvents: visible ? "auto" : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // A simple horizon gradient stands in for the surface render.
        background:
          "linear-gradient(180deg, #0a0d18 0%, #11121f 55%, #1b1410 75%, #2a1c12 100%)",
        zIndex: 50,
      }}
    >
      {body && (
        <div
          className="interactive"
          style={{
            width: 420,
            maxWidth: "90vw",
            padding: "20px 24px",
            background: "rgba(5,6,10,0.9)",
            border: "1px solid #2a2c3f",
            borderRadius: 8,
            color: "#cdd6f4",
            font: "13px/1.6 ui-monospace, monospace",
            boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: 2, color: "#585b70", marginBottom: 4 }}>
            SURFACE — LANDED
          </div>
          <div style={{ fontSize: 20, fontWeight: "bold", color: "#89b4fa" }}>{body.name}</div>
          <div style={{ fontSize: 11, color: "#585b70", marginBottom: 14 }}>
            {KIND_LABEL[body.kind] ?? body.kind}
          </div>

          <StatRow label="Surface gravity" value={`${gravityG.toFixed(2)} g`} />
          {body.surfaceTempK !== undefined && (
            <StatRow
              label="Surface temp"
              value={`${body.surfaceTempK} K (${(body.surfaceTempK - 273).toFixed(0)} °C)`}
            />
          )}
          {body.habitability !== undefined && (
            <StatRow
              label="Habitability"
              value={`${habitabilityLabel(body.habitability)} (${Math.round(body.habitability * 100)}%)`}
              valueColor={habColor}
            />
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={foundColony} style={primaryBtn}>
              ⛶ FOUND COLONY HERE
            </button>
            <button onClick={takeOff} style={secondaryBtn}>
              ▲ TAKE OFF
            </button>
          </div>
          <div style={{ fontSize: 10, color: "#45475a", marginTop: 10 }}>
            Colony construction arrives in Phase 2B — this button is wired but inert.
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0" }}>
      <span style={{ color: "#585b70" }}>{label}</span>
      <span style={{ color: valueColor ?? "#cdd6f4" }}>{value}</span>
    </div>
  );
}

const primaryBtn: CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  fontSize: 12,
  fontFamily: "inherit",
  cursor: "pointer",
  background: "#1e3a5f",
  color: "#89b4fa",
  border: "1px solid #2a4a7f",
  borderRadius: 4,
  letterSpacing: 0.5,
};

const secondaryBtn: CSSProperties = {
  padding: "8px 12px",
  fontSize: 12,
  fontFamily: "inherit",
  cursor: "pointer",
  background: "#1e2030",
  color: "#a6adc8",
  border: "1px solid #313244",
  borderRadius: 4,
  letterSpacing: 0.5,
};
