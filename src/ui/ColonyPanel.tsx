// Colony panel (Phase 2B) — lives inside the surface view when the ship is
// landed. Shows each resource's stockpile and net per-tick flow, the buildings,
// and a build menu that issues BuildStructure commands. Functional, not fancy.
//
// Reads colony state live from the world ref (refreshed by useGameTick). When no
// colony exists yet it shows the "Found colony" action instead — so founding a
// colony swaps this into the economy view on the next tick automatically.

import type { World } from "../sim/ecs/world.ts";
import type { Colony } from "../sim/ecs/components.ts";
import type { GameBus } from "../app/game-bus.ts";
import { dispatch } from "../app/command-bus.ts";
import { useGameTick } from "./hooks/useGameTick.ts";
import {
  RESOURCES,
  RESOURCE_LABEL,
  BUILDING_TYPES,
  BUILDINGS,
  type ResourceId,
} from "../sim/data/colony.ts";

interface ColonyPanelProps {
  world: World;
  bus: GameBus;
  bodyId: number;
}

function fmt(n: number): string {
  return Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(1);
}

function netColor(net: number): string {
  if (net > 0.001) return "#a6e3a1";
  if (net < -0.001) return "#f38ba8";
  return "#585b70";
}

export default function ColonyPanel({ world, bus, bodyId }: ColonyPanelProps) {
  useGameTick(bus, 6);

  const colony = world.components.colony.get(bodyId);

  // No colony yet — offer to found one.
  if (!colony) {
    return (
      <div style={{ marginTop: 16 }}>
        <button
          onClick={() => dispatch(world, { kind: "FoundColony", bodyId })}
          style={foundBtn}
        >
          ⛶ FOUND COLONY HERE
        </button>
        <div style={{ fontSize: 10, color: "#45475a", marginTop: 8 }}>
          Seeds an outpost from ship supplies (metals, food, propellant, and
          water + oxygen drawn from the life-support reserve).
        </div>
      </div>
    );
  }

  const metals = colony.stockpiles.metals ?? 0;

  return (
    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Resource ledger */}
      <div>
        <SectionLabel>RESOURCES</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {RESOURCES.map((res) => (
            <ResourceRow key={res} colony={colony} res={res} />
          ))}
        </div>
      </div>

      {/* Buildings + build menu */}
      <div>
        <SectionLabel>STRUCTURES</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {BUILDING_TYPES.map((type) => {
            const def = BUILDINGS[type];
            const count = colony.buildings[type] ?? 0;
            const affordable = metals >= def.costMetals;
            return (
              <div
                key={type}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <span style={{ flex: 1, color: "#cdd6f4" }}>
                  {def.name}
                  {count > 0 && (
                    <span style={{ color: "#585b70" }}> ×{count}</span>
                  )}
                </span>
                <button
                  onClick={() =>
                    affordable &&
                    dispatch(world, { kind: "BuildStructure", bodyId, building: type })
                  }
                  disabled={!affordable}
                  title={def.description}
                  style={{
                    ...buildBtn,
                    cursor: affordable ? "pointer" : "not-allowed",
                    color: affordable ? "#a6e3a1" : "#45475a",
                    borderColor: affordable ? "#2f5f3a" : "#1e2030",
                    background: affordable ? "#16241a" : "transparent",
                  }}
                >
                  + {def.costMetals}⛏
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ResourceRow({ colony, res }: { colony: Colony; res: ResourceId }) {
  const flow = colony.flows[res];
  const net = flow?.net ?? 0;
  const isPower = res === "power";
  const stock = colony.stockpiles[res] ?? 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
      <span style={{ flex: 1, color: "#a6adc8" }}>{RESOURCE_LABEL[res]}</span>
      <span style={{ minWidth: 56, textAlign: "right", color: "#cdd6f4" }}>
        {isPower ? "—" : fmt(stock)}
      </span>
      <span style={{ minWidth: 56, textAlign: "right", color: netColor(net) }}>
        {net >= 0 ? "+" : ""}{fmt(net)}/s
      </span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#585b70", marginBottom: 6 }}>
      {children}
    </div>
  );
}

const foundBtn: React.CSSProperties = {
  width: "100%",
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

const buildBtn: React.CSSProperties = {
  padding: "3px 8px",
  fontSize: 11,
  fontFamily: "inherit",
  border: "1px solid",
  borderRadius: 3,
  letterSpacing: 0.5,
};
