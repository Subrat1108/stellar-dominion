// System panel — right-side body list + body inspector.
//
// Lets the player click a body to inspect its physical properties and
// habitability. Pointer-events enabled only on the panel itself so that
// OrbitControls keep working over the Three.js canvas.

import { useState, type CSSProperties } from "react";
import type { World } from "../sim/ecs/world.ts";
import type { GameBus } from "../app/game-bus.ts";
import type { CelestialBody } from "../sim/ecs/components.ts";
import { useGameTick } from "./hooks/useGameTick.ts";
import { dispatch } from "../app/command-bus.ts";
import { landingRange, enterOrbitRange } from "../sim/presentation.ts";
import { habitabilityLabel, habitabilityColor } from "../sim/math/habitability.ts";
import { viewState } from "../app/view-state.ts";

interface SystemPanelProps {
  world: World;
  bus: GameBus;
}

const KIND_ICON: Record<string, string> = {
  star: "★",
  planet: "◉",
  "gas-giant": "◎",
};

const TAG_STYLE: Record<string, CSSProperties> = {
  real: { color: "#a6e3a1", fontSize: 10 },
  derived: { color: "#89dceb", fontSize: 10 },
  fictional: { color: "#cba6f7", fontSize: 10 },
};

export default function SystemPanel({ world, bus }: SystemPanelProps) {
  useGameTick(bus, 12); // low freq — panel content is mostly static
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Hidden at the sector zoom tier — the SectorPanel takes over there.
  if (viewState.view === "map" && viewState.mapTier === "sector") return null;

  const bodies: [number, CelestialBody][] = [
    ...world.components.celestialBody.entries(),
  ];

  const shipPos = world.components.transform.get(world.shipId)?.position
    ?? { x: 0, y: 0, z: 0 };

  function distFromShip(entityId: number): number {
    const bp = world.components.transform.get(entityId)?.position
      ?? { x: 0, y: 0, z: 0 };
    return Math.hypot(shipPos.x - bp.x, shipPos.y - bp.y, shipPos.z - bp.z);
  }

  const selected = selectedId !== null
    ? world.components.celestialBody.get(selectedId) ?? null
    : null;

  // Live ship-control state drives the flight-action buttons (mode + gating).
  const ctrl = world.components.shipControl.get(world.shipId);
  const autopilotActive = ctrl?.autopilotActive ?? false;
  const landed = ctrl?.landedBodyId !== undefined;
  const orbitingId = ctrl?.orbitingBodyId;

  function handleSetCourse(entityId: number) {
    dispatch(world, { kind: "SetCourse", bodyId: entityId });
  }

  // AUTOPILOT toggles: engage flight to this body, or cancel back to manual.
  function handleAutopilot(entityId: number) {
    if (autopilotActive) dispatch(world, { kind: "CancelCourse" });
    else dispatch(world, { kind: "EngageAutopilot", bodyId: entityId });
  }

  function handleEnterOrbit(entityId: number) {
    dispatch(world, { kind: "EnterOrbit", bodyId: entityId });
  }

  function handleLand(entityId: number) {
    dispatch(world, { kind: "LandAtBody", bodyId: entityId });
  }

  return (
    <div
      className="interactive"
      style={{
        position: "absolute",
        top: 40,
        right: 0,
        bottom: 0,
        width: 280,
        display: "flex",
        flexDirection: "column",
        background: "rgba(5,6,10,0.88)",
        borderLeft: "1px solid #1e2030",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #1e2030",
          color: "#89b4fa",
          fontWeight: "bold",
          letterSpacing: 1,
          fontSize: 11,
        }}
      >
        TAU CETI SYSTEM
      </div>

      {/* Body list */}
      <div style={{ overflowY: "auto", flex: "0 0 auto", maxHeight: 220 }}>
        {bodies.map(([id, body]) => (
          <BodyRow
            key={id}
            body={body}
            distFromShip={distFromShip(id)}
            selected={selectedId === id}
            onClick={() => setSelectedId(selectedId === id ? null : id)}
          />
        ))}
      </div>

      {/* Inspector */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          borderTop: "1px solid #1e2030",
        }}
      >
        {selected && selectedId !== null ? (
          <BodyInspector
            body={selected}
            entityId={selectedId}
            distFromShip={distFromShip(selectedId)}
            autopilotActive={autopilotActive}
            landed={landed}
            orbitingHere={orbitingId === selectedId}
            onSetCourse={handleSetCourse}
            onAutopilot={handleAutopilot}
            onEnterOrbit={handleEnterOrbit}
            onLand={handleLand}
          />
        ) : (
          <div style={{ padding: 12, color: "#585b70", fontSize: 11 }}>
            Select a body to inspect.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Body row

function BodyRow({
  body,
  distFromShip,
  selected,
  onClick,
}: {
  body: CelestialBody;
  distFromShip: number;
  selected: boolean;
  onClick: () => void;
}) {
  const hab = body.habitability;
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        width: "100%",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        background: selected ? "#1e2030" : "transparent",
        border: "none",
        borderBottom: "1px solid #181825",
        color: "#cdd6f4",
        cursor: "pointer",
        textAlign: "left",
        font: "inherit",
        fontSize: 12,
      }}
    >
      <span style={{ color: colorForBody(body), fontSize: 14 }}>
        {KIND_ICON[body.kind] ?? "·"}
      </span>
      <span style={{ flex: 1 }}>{body.name}</span>
      <span style={{ color: "#45475a", fontSize: 10, minWidth: 40, textAlign: "right" }}>
        {distFromShip.toFixed(0)}u
      </span>
      {hab !== undefined && (
        <HabBadge score={hab} />
      )}
    </button>
  );
}

function HabBadge({ score }: { score: number }) {
  return (
    <span
      style={{
        fontSize: 10,
        padding: "1px 5px",
        borderRadius: 3,
        background: habitabilityColor(score) + "33",
        color: habitabilityColor(score),
        border: `1px solid ${habitabilityColor(score)}55`,
        whiteSpace: "nowrap",
      }}
    >
      {Math.round(score * 100)}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// Body inspector

function BodyInspector({
  body,
  entityId,
  distFromShip,
  autopilotActive,
  landed,
  orbitingHere,
  onSetCourse,
  onAutopilot,
  onEnterOrbit,
  onLand,
}: {
  body: CelestialBody;
  entityId: number;
  distFromShip: number;
  autopilotActive: boolean;
  landed: boolean;
  orbitingHere: boolean;
  onSetCourse: (id: number) => void;
  onAutopilot: (id: number) => void;
  onEnterOrbit: (id: number) => void;
  onLand: (id: number) => void;
}) {
  // A rocky planet within landing range can be landed on; gas giants/star can't.
  const canLand =
    body.kind === "planet" && !landed && distFromShip <= landingRange(body.renderRadius);
  // ENTER ORBIT is offered only in MANUAL mode (not autopilot, not already
  // orbiting here, not landed) and once within the gentle-insertion range.
  const canEnterOrbit =
    body.kind !== "star" &&
    !autopilotActive &&
    !orbitingHere &&
    !landed &&
    distFromShip <= enterOrbitRange(body.renderRadius);
  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Name + tag */}
      <div>
        <div style={{ fontWeight: "bold", fontSize: 14, color: "#cdd6f4" }}>
          {body.name}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 2, alignItems: "center" }}>
          <span style={{ color: "#585b70", fontSize: 11 }}>
            {body.kind === "star"
              ? body.spectralType
              : body.kind === "gas-giant"
              ? "Gas Giant"
              : "Rocky Planet"}
          </span>
          <span style={TAG_STYLE[body.dataTag] ?? {}}>
            [{body.dataTag}]
          </span>
        </div>
      </div>

      {/* Flight actions (Polish B control model) — not shown for the star.
          SET COURSE marks the target (direction indicator); AUTOPILOT flies
          there; ENTER ORBIT drops into a low orbit when close; LAND touches down. */}
      {body.kind !== "star" && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <ActionButton label="▶ SET COURSE" color="#89b4fa" bg="#1e3a5f" border="#2a4a7f"
            enabled={!landed}
            title="Mark this body — draws a heading indicator (does not move the ship)"
            onClick={() => onSetCourse(entityId)} />
          <ActionButton
            label={autopilotActive ? "✈ AUTOPILOT ON" : "✈ AUTOPILOT"}
            color="#f9e2af" bg={autopilotActive ? "#5c4a1e" : "#3a341e"} border="#5c4a1e"
            enabled={!landed}
            title={autopilotActive
              ? "Autopilot engaged — click to cancel and return to manual"
              : "Fly to this body automatically (manual thrust is locked while engaged)"}
            onClick={() => onAutopilot(entityId)} />
          <ActionButton label="◎ ENTER ORBIT" color="#89dceb" bg="#173a44" border="#245c6a"
            enabled={canEnterOrbit}
            title={canEnterOrbit ? "Drop into a low orbit" : "Fly closer to enter orbit"}
            onClick={() => onEnterOrbit(entityId)} />
          {body.kind === "planet" && (
            <ActionButton label="⬇ LAND" color="#a6e3a1" bg="#1e3a5f" border="#2f5f3a"
              enabled={canLand}
              title={canLand ? "Land on the surface" : "Fly closer to land"}
              onClick={() => onLand(entityId)} />
          )}
        </div>
      )}

      {/* Description */}
      <p style={{ color: "#a6adc8", fontSize: 11, lineHeight: 1.55 }}>
        {body.description}
      </p>

      <Divider />

      {/* Star stats */}
      {body.kind === "star" && (
        <>
          <Row label="Distance from ship" value={`${distFromShip.toFixed(1)} u`} valueColor="#89dceb" />
          <Row label="Luminosity" value={`${body.luminositySol?.toFixed(3) ?? "?"} L☉`} />
          <Row label="Temperature" value={`${body.tempK?.toLocaleString() ?? "?"} K`} />
          <Row
            label="Mass"
            value={`${((body.massKg / 1.989e30)).toFixed(3)} M☉`}
          />
          <Row
            label="Spectral type"
            value={body.spectralType ?? "—"}
          />
        </>
      )}

      {/* Planet / gas-giant stats */}
      {body.kind !== "star" && (
        <>
          <Row
            label="Orbital distance"
            value={`${body.orbitalDistanceAu?.toFixed(2) ?? "?"} AU`}
          />
          <Row
            label="Distance from ship"
            value={`${distFromShip.toFixed(1)} u`}
            valueColor="#89dceb"
          />
          <Row
            label="Mass"
            value={`${((body.massKg / 5.972e24)).toFixed(2)} M⊕`}
          />
          <Row
            label="Radius"
            value={`${((body.radiusM / 6.371e6)).toFixed(2)} R⊕`}
          />
        </>
      )}

      {/* Planet-specific */}
      {body.kind === "planet" && body.gravityMs2 !== undefined && (
        <>
          <Row
            label="Gravity"
            value={`${body.gravityMs2.toFixed(2)} m/s² (${(body.gravityMs2 / 9.81).toFixed(2)}g)`}
          />
          <Row
            label="Surface temp"
            value={`${body.surfaceTempK} K (${((body.surfaceTempK ?? 0) - 273).toFixed(0)} °C)`}
          />

          {body.atmosphere && (
            <>
              <Divider />
              <div style={{ color: "#a6adc8", fontSize: 11, fontWeight: "bold" }}>
                Atmosphere
              </div>
              <Row
                label="Pressure"
                value={`${(body.atmosphere.pressurePa / 101325).toFixed(2)} atm`}
              />
              <Row label="Composition" value={body.atmosphere.composition} />
              <Row
                label="Toxicity"
                value={toxicityLabel(body.atmosphere.toxicity)}
                valueColor={
                  body.atmosphere.toxicity > 0.7
                    ? "#f38ba8"
                    : body.atmosphere.toxicity > 0.3
                    ? "#fab387"
                    : "#a6e3a1"
                }
              />
              <Row
                label="Liquid water"
                value={body.atmosphere.hasLiquidWater ? "Present" : "None"}
                valueColor={body.atmosphere.hasLiquidWater ? "#89dceb" : "#585b70"}
              />
            </>
          )}

          {body.habitability !== undefined && (
            <>
              <Divider />
              <HabitabilityDisplay score={body.habitability} />
            </>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helper components

function ActionButton({
  label, color, bg, border, onClick, title, enabled = true,
}: {
  label: string;
  color: string;
  bg: string;
  border: string;
  onClick: () => void;
  title?: string;
  enabled?: boolean;
}) {
  return (
    <button
      onClick={() => enabled && onClick()}
      disabled={!enabled}
      title={title}
      style={{
        padding: "4px 10px",
        fontSize: 11,
        fontFamily: "inherit",
        cursor: enabled ? "pointer" : "not-allowed",
        background: enabled ? bg : "transparent",
        color: enabled ? color : "#45475a",
        border: `1px solid ${enabled ? border : "#1e2030"}`,
        borderRadius: 4,
        letterSpacing: 0.5,
      }}
    >
      {label}
    </button>
  );
}

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ color: "#585b70", fontSize: 11 }}>{label}</span>
      <span style={{ color: valueColor ?? "#cdd6f4", fontSize: 11, textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "#1e2030" }} />;
}

function HabitabilityDisplay({ score }: { score: number }) {
  const color = habitabilityColor(score);
  const label = habitabilityLabel(score);
  const pct = Math.round(score * 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "#a6adc8" }}>Habitability</span>
        <span style={{ fontSize: 11, color }}>{label}</span>
      </div>
      <div
        style={{
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
            borderRadius: 3,
          }}
        />
      </div>
      <div style={{ textAlign: "right", fontSize: 10, color }}>
        {pct}%
      </div>
    </div>
  );
}

function toxicityLabel(t: number): string {
  if (t >= 0.9) return "Lethal";
  if (t >= 0.6) return "Very high";
  if (t >= 0.3) return "Moderate";
  if (t >= 0.1) return "Low";
  return "Safe";
}

function colorForBody(body: CelestialBody): string {
  return "#" + body.color.toString(16).padStart(6, "0");
}
