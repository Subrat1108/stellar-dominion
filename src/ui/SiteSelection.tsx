// Landing-site selection (the landing arc, docs/14) — shown in the surface view
// when the ship is landed on a body with no colony yet. Presents the ~3
// deterministic candidate sites (gen/sites.ts) as cards; picking one founds the
// colony at that site (FoundColony{siteIndex}). This is the "choose where to
// settle" beat — options to weigh, NOT a tile map.

import { useMemo, type CSSProperties } from "react";
import type { World } from "../sim/ecs/world.ts";
import type { GameBus } from "../app/game-bus.ts";
import { dispatch } from "../app/command-bus.ts";
import { generateCandidateSites, siteModifiers, type CandidateSite } from "../sim/gen/sites.ts";
import { landingViability, edlSetupCost, type LandingViability } from "../sim/math/edl.ts";

interface SiteSelectionProps {
  world: World;
  bus: GameBus;
  bodyId: number;
}

/** Qualitative 3-band label for a 0–1 attribute. */
function band(x: number, low: string, mid: string, high: string): string {
  return x < 0.34 ? low : x < 0.67 ? mid : high;
}

function AttrRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "1px 0" }}>
      <span style={{ color: "#585b70" }}>{label}</span>
      <span style={{ color: "#a6adc8" }}>{value}</span>
    </div>
  );
}

function SiteCard({ site, edlCost, onPick }: { site: CandidateSite; edlCost: number; onPick: () => void }) {
  const mods = siteModifiers(site);
  const setup = mods.setupMetalsCost + mods.shieldingMetalsCost + edlCost;
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 13, color: "#89b4fa", fontWeight: "bold", marginBottom: 2 }}>
        {site.name}
      </div>
      <div style={{ fontSize: 10, color: "#585b70", marginBottom: 6 }}>
        {site.latitude.toFixed(0)}° latitude
      </div>
      <div style={{ fontSize: 11 }}>
        <AttrRow label="Sunlight" value={band(site.insolationFactor, "weak", "fair", "strong")} />
        <AttrRow label="Volatiles" value={band(site.volatileProximity, "sparse", "some", "rich")} />
        <AttrRow label="Terrain" value={band(site.slope, "flat", "rolling", "steep")} />
        <AttrRow label="Radiation" value={band(site.radiation, "low", "moderate", "harsh")} />
      </div>
      {/* Derived founding effects — what choosing this site actually does. */}
      <div style={{ marginTop: 6, fontSize: 10, color: "#a6e3a1", display: "flex", flexWrap: "wrap", gap: 6 }}>
        <span>solar ×{mods.solarEfficiency.toFixed(2)}</span>
        {mods.startWaterBonus > 0 && <span>+{mods.startWaterBonus} water</span>}
        {mods.startOxygenBonus > 0 && <span>+{mods.startOxygenBonus} O₂</span>}
        {setup > 0 && <span style={{ color: "#f9e2af" }}>setup −{setup} metals</span>}
      </div>
      <button onClick={onPick} style={pickBtn}>SETTLE HERE</button>
    </div>
  );
}

export default function SiteSelection({ world, bus, bodyId }: SiteSelectionProps) {
  void bus;
  const body = world.components.celestialBody.get(bodyId);
  // Sites are a pure function of (universe seed, body) — memoise on identity.
  const sites = useMemo(
    () => (body ? generateCandidateSites(world.universeSeed, body) : []),
    [world.universeSeed, body],
  );
  if (!body) return null;

  const edl: LandingViability = landingViability(body);
  const edlCost = edlSetupCost(edl);

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: "#585b70", marginBottom: 8 }}>
        CHOOSE A LANDING SITE
      </div>
      {/* Body-level EDL affordance (docs/14 §3) — how hard heavy drops are here. */}
      <div style={{ fontSize: 10, color: "#94a3c4", marginBottom: 8 }}>
        EDL: <span style={{ color: "#cdd6f4" }}>{edl.edlClass}</span> — {edl.note}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sites.map((site) => (
          <SiteCard
            key={site.index}
            site={site}
            edlCost={edlCost}
            onPick={() => dispatch(world, { kind: "FoundColony", bodyId, siteIndex: site.index })}
          />
        ))}
      </div>
      <div style={{ fontSize: 10, color: "#45475a", marginTop: 8 }}>
        The site shapes the founded colony (head-starts, efficiencies, upfront
        costs). Seeds an outpost from ship supplies (metals, food, propellant, and
        water + oxygen from the life-support reserve).
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  padding: "10px 12px",
  background: "#12131f",
  border: "1px solid #2a2c3f",
  borderRadius: 6,
};

const pickBtn: CSSProperties = {
  width: "100%",
  marginTop: 8,
  padding: "6px 10px",
  fontSize: 11,
  fontFamily: "inherit",
  cursor: "pointer",
  background: "#1e3a5f",
  color: "#89b4fa",
  border: "1px solid #2a4a7f",
  borderRadius: 4,
  letterSpacing: 0.5,
};
