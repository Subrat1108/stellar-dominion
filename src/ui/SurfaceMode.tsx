// Full-screen surface mode (Slice 1, docs/17) — while LANDED, the planet surface
// is the whole screen: a top bar (planet name + compact stats + TAKE OFF) over a
// full-screen pan/zoom tile map. App renders this INSTEAD of the flight overlays
// when landed, so the flight HUD never overlays the surface. TAKE OFF returns to
// the orbital/flight view.
//
// Commit 1 keeps a single temporary COLONY drawer so the economy + terraforming
// stay reachable; commit 2 replaces it with top-bar toggle menus (TERRAFORMING /
// ECONOMY / TECH / CIVIC).

import { useEffect, useState, type CSSProperties } from "react";
import type { World } from "../sim/ecs/world.ts";
import type { GameBus } from "../app/game-bus.ts";
import type { CelestialBody } from "../sim/ecs/components.ts";
import { dispatch } from "../app/command-bus.ts";
import { useLandingState } from "./hooks/useLandingState.ts";
import { useGameTick } from "./hooks/useGameTick.ts";
import ColonyPanel from "./ColonyPanel.tsx";
import SurfaceMap from "./SurfaceMap.tsx";
import { surfaceGravityG } from "../sim/math/physics.ts";
import { habitabilityLabel, habitabilityColor } from "../sim/math/habitability.ts";
import {
  localStrategicResources,
  isStrategicallyIncomplete,
  STRATEGIC_RESOURCES,
  STRATEGIC_RESOURCE_LABEL,
} from "../sim/gen/strategic.ts";

interface SurfaceModeProps {
  world: World;
  bus: GameBus;
}

export default function SurfaceMode({ world, bus }: SurfaceModeProps) {
  const landedBodyId = useLandingState(bus);
  // Re-render on tick so the founded marker / founding availability stay current.
  useGameTick(bus, 10);
  const [mounted, setMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (landedBodyId === null) return null;
  const bodyId = landedBodyId;
  const body: CelestialBody | undefined = world.components.celestialBody.get(bodyId);
  if (!body) return null;
  const colony = world.components.colony.get(bodyId);

  const gravityG = surfaceGravityG(body.massKg, body.radiusM);
  const habColor = body.habitability !== undefined ? habitabilityColor(body.habitability) : "#cdd6f4";

  return (
    <div
      className="interactive"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "#05060a",
        opacity: mounted ? 1 : 0,
        transition: "opacity 400ms ease",
        zIndex: 50,
      }}
    >
      {/* Top bar */}
      <div style={topBar}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, minWidth: 0 }}>
          <span style={{ fontSize: 10, letterSpacing: 2, color: "#585b70" }}>SURFACE</span>
          <span style={{ fontSize: 16, fontWeight: "bold", color: "#89b4fa", whiteSpace: "nowrap" }}>{body.name}</span>
          <span style={topStat}>{gravityG.toFixed(2)} g</span>
          {body.surfaceTempK !== undefined && (
            <span style={topStat}>{(body.surfaceTempK - 273).toFixed(0)} °C</span>
          )}
          {body.habitability !== undefined && (
            <span style={{ ...topStat, color: habColor }}>
              {habitabilityLabel(body.habitability)} ({Math.round(body.habitability * 100)}%)
            </span>
          )}
          <StrategicBadge world={world} body={body} />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setDrawerOpen((o) => !o)}
            style={{ ...topBtn, ...(drawerOpen ? topBtnActive : null) }}
          >
            ▤ COLONY
          </button>
          <button onClick={() => dispatch(world, { kind: "TakeOff" })} style={takeOffBtn}>
            ▲ TAKE OFF
          </button>
        </div>
      </div>

      {/* Map fills the rest; the drawer overlays it on the right. */}
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        {body.kind === "planet" ? (
          <SurfaceMap
            world={world}
            bodyId={bodyId}
            foundedTile={colony?.tile ?? null}
            {...(colony ? {} : { onFound: (tile) => dispatch(world, { kind: "FoundColony", bodyId, tile }) })}
          />
        ) : (
          <div style={{ display: "grid", placeItems: "center", height: "100%", color: "#585b70" }}>
            No walkable surface here.
          </div>
        )}

        {drawerOpen && (
          <div style={drawer}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: "#585b70", marginBottom: 10 }}>COLONY & TERRAFORMING</div>
            {body.kind === "planet" && <StrategicRow world={world} body={body} />}
            <ColonyPanel world={world} bus={bus} bodyId={bodyId} />
          </div>
        )}
      </div>
    </div>
  );
}

function StrategicBadge({ world, body }: { world: World; body: CelestialBody }) {
  if (body.kind !== "planet") return null;
  const avail = localStrategicResources(world.universeSeed, body);
  const incomplete = isStrategicallyIncomplete(avail);
  const present = STRATEGIC_RESOURCES.filter((r) => avail[r]).map((r) => STRATEGIC_RESOURCE_LABEL[r]);
  return (
    <span style={{ ...topStat, color: incomplete ? "#f9e2af" : "#a6e3a1" }} title="Local strategic resources">
      {incomplete ? "no local strategic" : present.join(", ")}
    </span>
  );
}

function StrategicRow({ world, body }: { world: World; body: CelestialBody }) {
  const avail = localStrategicResources(world.universeSeed, body);
  const incomplete = isStrategicallyIncomplete(avail);
  if (!incomplete) return null;
  return (
    <div style={{ fontSize: 10, color: "#7a6a4a", marginBottom: 10, lineHeight: 1.4 }}>
      ⚠ No local Fissiles — a colony here will depend on imports for Tier-2 capability.
      (Trade routes arrive with the economy layer.)
    </div>
  );
}

const topBar: CSSProperties = {
  flex: "0 0 auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "8px 14px",
  background: "rgba(5,6,10,0.95)",
  borderBottom: "1px solid #1e2030",
  font: "12px/1.4 ui-monospace, monospace",
  color: "#cdd6f4",
};

const topStat: CSSProperties = { fontSize: 11, color: "#a6adc8", whiteSpace: "nowrap" };

const topBtn: CSSProperties = {
  padding: "6px 12px", fontSize: 11, fontFamily: "inherit", cursor: "pointer",
  background: "#1e2030", color: "#a6adc8", border: "1px solid #313244", borderRadius: 4, letterSpacing: 0.5,
};
const topBtnActive: CSSProperties = { background: "#28304a", color: "#cdd6f4", borderColor: "#3a4668" };

const takeOffBtn: CSSProperties = {
  padding: "6px 14px", fontSize: 11, fontFamily: "inherit", cursor: "pointer",
  background: "#1e3a5f", color: "#89b4fa", border: "1px solid #2a4a7f", borderRadius: 4, letterSpacing: 0.5,
};

const drawer: CSSProperties = {
  position: "absolute", top: 0, right: 0, bottom: 0, width: 360, maxWidth: "80vw",
  overflowY: "auto", padding: "16px 18px",
  background: "rgba(5,6,10,0.96)", borderLeft: "1px solid #2a2c3f",
  font: "13px/1.6 ui-monospace, monospace", color: "#cdd6f4",
  boxShadow: "-8px 0 40px rgba(0,0,0,0.5)",
};
