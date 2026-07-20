// Surface view (Phase 2A overlay, Phase 2B colony economy).
//
// When the ship lands on a body (a Landed event), this overlay eases in over the
// space view — a fade + zoom, NOT a seamless descent (docs/08): the space scene
// stays put underneath and we cross-fade to a surface "deck". It shows the body's
// key stats — including surface gravity computed from mass/radius (the first use
// of gravity-as-a-stat, docs/09 Session 10) — the colony panel (ColonyPanel:
// found a colony, manage resources, build structures), and Take off.

import { useRef, type CSSProperties } from "react";
import type { World } from "../sim/ecs/world.ts";
import type { GameBus } from "../app/game-bus.ts";
import type { CelestialBody } from "../sim/ecs/components.ts";
import { dispatch } from "../app/command-bus.ts";
import { useLandingState } from "./hooks/useLandingState.ts";
import ColonyPanel from "./ColonyPanel.tsx";
import SurfaceMap from "./SurfaceMap.tsx";
import { surfaceGravityG } from "../sim/math/physics.ts";
import { habitabilityLabel, habitabilityColor, esiTierLabel } from "../sim/math/habitability.ts";
import {
  localStrategicResources,
  isStrategicallyIncomplete,
  STRATEGIC_RESOURCES,
  STRATEGIC_RESOURCE_LABEL,
} from "../sim/gen/strategic.ts";

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
        transform: visible ? "scale(1)" : "scale(1.02)",
        transition: "opacity 600ms ease, transform 600ms ease",
        pointerEvents: visible ? "auto" : "none",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        gap: 16,
        padding: 16,
        boxSizing: "border-box",
        // A simple horizon gradient stands in behind the surface map.
        background:
          "linear-gradient(180deg, #060810 0%, #0a0d16 60%, #12101a 100%)",
        zIndex: 50,
      }}
    >
      {body && (
        <>
          {/* The 2D tile surface map — the centerpiece (docs/17). */}
          <div
            className="interactive"
            style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: "1 1 auto", minWidth: 0 }}
          >
            {displayId !== null && displayId !== undefined && body.kind === "planet" && (
              <SurfaceMap world={world} bodyId={displayId} />
            )}
          </div>

          {/* Side panel — body stats, colony/founding controls, take off. */}
          <div
            className="interactive"
            style={{
              width: 340,
              flex: "0 0 340px",
              maxWidth: "40vw",
              padding: "18px 20px",
              overflowY: "auto",
              background: "rgba(5,6,10,0.92)",
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
            {body.habitability !== undefined && (
              <StatRow label="ESI tier" value={esiTierLabel(body.habitability)} />
            )}

            {/* Local strategic resources — the interdependence seed (docs/14 §5, docs/16). */}
            {body.kind === "planet" && <StrategicRow world={world} body={body} />}

            {/* Colony economy — found, manage resources, build structures. */}
            {displayId !== null && displayId !== undefined && (
              <ColonyPanel world={world} bus={bus} bodyId={displayId} />
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={takeOff} style={secondaryBtn}>
                ▲ TAKE OFF
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Local strategic-resource readout (the interdependence seed). Shows which
 * Strategic-Core resources this world hosts locally — and, when it hosts none,
 * that the colony here will depend on imports (the pull toward other worlds).
 */
function StrategicRow({ world, body }: { world: World; body: CelestialBody }) {
  const avail = localStrategicResources(world.universeSeed, body);
  const present = STRATEGIC_RESOURCES.filter((r) => avail[r]);
  const incomplete = isStrategicallyIncomplete(avail);
  return (
    <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #1e2030" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span style={{ color: "#585b70" }}>Local strategic</span>
        <span style={{ color: incomplete ? "#f9e2af" : "#a6e3a1" }}>
          {incomplete ? "none" : present.map((r) => STRATEGIC_RESOURCE_LABEL[r]).join(", ")}
        </span>
      </div>
      {incomplete && (
        <div style={{ fontSize: 10, color: "#7a6a4a", marginTop: 4 }}>
          ⚠ No local Fissiles — a colony here will depend on imports for Tier-2
          capability. (Trade routes arrive with the economy layer.)
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
