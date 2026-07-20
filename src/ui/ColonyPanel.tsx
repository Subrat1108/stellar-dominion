// Colony panel (Phase 2B-2C) — lives inside the surface view when the ship is
// landed. Shows population stats, resource ledger, and a build menu.
//
// Reads colony state live from the world ref (refreshed by useGameTick). When no
// colony exists yet it shows the "Found colony" action instead — so founding a
// colony swaps this into the economy view on the next tick automatically.

import type { World } from "../sim/ecs/world.ts";
import type { Colony, BuildingStatus } from "../sim/ecs/components.ts";
import type { GameBus } from "../app/game-bus.ts";
import { dispatch } from "../app/command-bus.ts";
import { useGameTick } from "./hooks/useGameTick.ts";
import { housingCapacity } from "../sim/systems/colony.ts";
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

function fmtRate(n: number): string {
  // Per-second rates; show two decimal places so small changes are legible.
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "/s";
}

function netColor(net: number): string {
  if (net > 0.001) return "#a6e3a1";
  if (net < -0.001) return "#f38ba8";
  return "#585b70";
}

export default function ColonyPanel({ world, bus, bodyId }: ColonyPanelProps) {
  useGameTick(bus, 6);

  const colony = world.components.colony.get(bodyId);

  // No colony yet — choose a landing site, which founds the colony (the landing
  // arc, docs/14). The site shapes the founded colony's starting modifiers.
  if (!colony) {
    // Founding now happens by selecting a tile on the surface map (docs/17):
    // pick a tile → SETTLE HERE. This panel just prompts until a colony exists.
    return (
      <div style={{ marginTop: 16, fontSize: 11, color: "#585b70", lineHeight: 1.5 }}>
        No colony yet. Pick a landing tile on the surface map, then{" "}
        <span style={{ color: "#a6e3a1" }}>SETTLE HERE</span> to found your first colony —
        the tile shapes its head-starts, solar efficiency, and setup cost.
      </div>
    );
  }

  const metals = colony.stockpiles.metals ?? 0;

  // Resources that are currently bottlenecking a powered building's output.
  const bottlenecks = new Set<string>();
  for (const status of Object.values(colony.buildingStatuses ?? {})) {
    if (status.state === "idle-no-input" && status.limitingResource) {
      bottlenecks.add(status.limitingResource);
    }
  }

  return (
    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Population */}
      <PopSection colony={colony} />

      {/* Resource ledger */}
      <div>
        <SectionLabel>RESOURCES</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {RESOURCES.map((res) => (
            <ResourceRow key={res} colony={colony} res={res} isBottleneck={bottlenecks.has(res)} />
          ))}
        </div>
      </div>

      {/* Buildings + build menu */}
      <div>
        <SectionLabel>STRUCTURES</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {BUILDING_TYPES.map((type) => {
            const def = BUILDINGS[type];
            const count = colony.buildings[type] ?? 0;
            const affordable = metals >= def.costMetals;
            const status = (colony.buildingStatuses ?? {})[type];
            return (
              <div key={type} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                {count > 0 && status && (
                  <BuildingStatusLine status={status} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PopSection({ colony }: { colony: Colony }) {
  const pop = Math.floor(colony.population);
  const cap = housingCapacity(colony);
  const rate = colony.popGrowthRate;
  const isGrowing = rate > 0.001;
  const isDeclining = rate < -0.001;

  return (
    <div>
      <SectionLabel>POPULATION</SectionLabel>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <span style={{ flex: 1, color: "#a6adc8" }}>Colonists</span>
        <span style={{ color: "#cdd6f4" }}>
          {pop} / {cap}
        </span>
        <span style={{ minWidth: 56, textAlign: "right", color: netColor(rate) }}>
          {fmtRate(rate)}
        </span>
      </div>
      {(isGrowing || isDeclining || colony.popLimitingFactor !== "stable") && (
        <div style={{ fontSize: 10, color: isDeclining ? "#f38ba8" : "#585b70", marginTop: 2 }}>
          {colony.popLimitingFactor}
        </div>
      )}
    </div>
  );
}

function ResourceRow({ colony, res, isBottleneck }: { colony: Colony; res: ResourceId; isBottleneck: boolean }) {
  const flow = colony.flows[res];
  const net = flow?.net ?? 0;
  const isPower = res === "power";
  const stock = colony.stockpiles[res] ?? 0;
  const labelColor = isBottleneck ? "#f9e2af" : "#a6adc8";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
      <span style={{ flex: 1, color: labelColor }}>
        {RESOURCE_LABEL[res]}
        {isBottleneck && <span style={{ marginLeft: 4, fontSize: 9, color: "#f9e2af" }}>↑ needed</span>}
      </span>
      <span style={{ minWidth: 56, textAlign: "right", color: "#cdd6f4" }}>
        {isPower ? "—" : fmt(stock)}
      </span>
      <span style={{ minWidth: 56, textAlign: "right", color: netColor(net) }}>
        {net >= 0 ? "+" : ""}{fmt(net)}/s
      </span>
    </div>
  );
}

function BuildingStatusLine({ status }: { status: BuildingStatus }) {
  let color: string;
  let text: string;

  if (status.state === "running") {
    if (status.running === status.total) return null; // fully running, no label needed
    color = "#a6e3a1";
    text = `${status.running}/${status.total} running`;
  } else if (status.state === "idle-no-power") {
    color = "#f9e2af";
    text = status.running > 0
      ? `${status.running}/${status.total} running — idle: no power`
      : "idle: no power";
  } else {
    // idle-no-input
    color = "#f9e2af";
    text = `idle: ${status.reason}`;
  }

  return (
    <div style={{ fontSize: 10, color, paddingLeft: 2, marginTop: 1 }}>
      {text}
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


const buildBtn: React.CSSProperties = {
  padding: "3px 8px",
  fontSize: 11,
  fontFamily: "inherit",
  border: "1px solid",
  borderRadius: 3,
  letterSpacing: 0.5,
};
