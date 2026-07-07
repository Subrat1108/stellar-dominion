// Shared body-detail field renderer (Exploration Polish C).
//
// Extracted from SystemPanel's inspector so the SAME field set is reused by both
// the system panel and the unified map's click popup (the old Polish D, folded
// into the map). Read-only presentation only — no actions, no ship state; the
// parent renders the name/tag header + the context-action row and drops this in
// for the physical/atmosphere/habitability fields.

import type { CSSProperties } from "react";
import type { CelestialBody } from "../sim/ecs/components.ts";
import { habitabilityLabel, habitabilityColor, esiTierLabel } from "../sim/math/habitability.ts";

const TAG_STYLE: Record<string, CSSProperties> = {
  real: { color: "#a6e3a1", fontSize: 10 },
  derived: { color: "#89dceb", fontSize: 10 },
  fictional: { color: "#cba6f7", fontSize: 10 },
};

/** CSS hex for a body's renderer colour (e.g. 0xffd493 → "#ffd493"). */
export function bodyHexColor(body: CelestialBody): string {
  return "#" + body.color.toString(16).padStart(6, "0");
}

/**
 * The physical / atmosphere / habitability field block for a body. `distFromShip`
 * (scene units) is shown when provided; `showEsi` adds the ESI tier line (the map
 * popup wants it; the system panel already shows habitability alone).
 */
export default function BodyDetails({
  body,
  distFromShip,
  showEsi = false,
}: {
  body: CelestialBody;
  distFromShip?: number;
  showEsi?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ color: "#a6adc8", fontSize: 11, lineHeight: 1.55, margin: 0 }}>
        {body.description}
      </p>

      <Divider />

      {/* Star stats */}
      {body.kind === "star" && (
        <>
          {distFromShip !== undefined && (
            <Row label="Distance from ship" value={`${distFromShip.toFixed(1)} u`} valueColor="#89dceb" />
          )}
          <Row label="Luminosity" value={`${body.luminositySol?.toFixed(3) ?? "?"} L☉`} />
          <Row label="Temperature" value={`${body.tempK?.toLocaleString() ?? "?"} K`} />
          <Row label="Mass" value={`${(body.massKg / 1.989e30).toFixed(3)} M☉`} />
          <Row label="Spectral type" value={body.spectralType ?? "—"} />
        </>
      )}

      {/* Planet / gas-giant stats */}
      {body.kind !== "star" && (
        <>
          <Row label="Orbital distance" value={`${body.orbitalDistanceAu?.toFixed(2) ?? "?"} AU`} />
          {distFromShip !== undefined && (
            <Row label="Distance from ship" value={`${distFromShip.toFixed(1)} u`} valueColor="#89dceb" />
          )}
          <Row label="Mass" value={`${(body.massKg / 5.972e24).toFixed(2)} M⊕`} />
          <Row label="Radius" value={`${(body.radiusM / 6.371e6).toFixed(2)} R⊕`} />
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
              <div style={{ color: "#a6adc8", fontSize: 11, fontWeight: "bold" }}>Atmosphere</div>
              <Row label="Pressure" value={`${(body.atmosphere.pressurePa / 101325).toFixed(2)} atm`} />
              <Row label="Composition" value={body.atmosphere.composition} />
              <Row
                label="Toxicity"
                value={toxicityLabel(body.atmosphere.toxicity)}
                valueColor={
                  body.atmosphere.toxicity > 0.7 ? "#f38ba8" : body.atmosphere.toxicity > 0.3 ? "#fab387" : "#a6e3a1"
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
              {showEsi && <Row label="ESI tier" value={esiTierLabel(body.habitability)} />}
            </>
          )}
        </>
      )}
    </div>
  );
}

/** The provenance tag ([real]/[derived]/[fictional]) — reused by both surfaces. */
export function ProvenanceTag({ tag }: { tag: string }) {
  return <span style={TAG_STYLE[tag] ?? {}}>[{tag}]</span>;
}

export function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ color: "#585b70", fontSize: 11 }}>{label}</span>
      <span style={{ color: valueColor ?? "#cdd6f4", fontSize: 11, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export function Divider() {
  return <div style={{ height: 1, background: "#1e2030" }} />;
}

export function HabitabilityDisplay({ score }: { score: number }) {
  const color = habitabilityColor(score);
  const label = habitabilityLabel(score);
  const pct = Math.round(score * 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "#a6adc8" }}>Habitability</span>
        <span style={{ fontSize: 11, color }}>{label}</span>
      </div>
      <div style={{ height: 6, background: "#1e2030", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <div style={{ textAlign: "right", fontSize: 10, color }}>{pct}%</div>
    </div>
  );
}

export function toxicityLabel(t: number): string {
  if (t >= 0.9) return "Lethal";
  if (t >= 0.6) return "Very high";
  if (t >= 0.3) return "Moderate";
  if (t >= 0.1) return "Low";
  return "Safe";
}
