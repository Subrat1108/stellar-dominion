// Sector panel — the actionable list behind the sector map (docs/12, docs/01
// legibility). Shown only when the map view is zoomed out to the sector tier.
//
// Reads viewState directly (plain ref updated by the renderer, like Scanner).
// Step 1B commit 2: informational — lists the neighbourhood with real distances
// from the active system and marks "you are here". Scan/Warp actions are added
// with the warp state machine (commit 3).

import type { World } from "../sim/ecs/world.ts";
import type { GameBus } from "../app/game-bus.ts";
import { viewState } from "../app/view-state.ts";
import { useGameTick } from "./hooks/useGameTick.ts";
import {
  sectorNodes,
  distanceLyById,
  hygIdFromSystemId,
  type SectorRole,
} from "../sim/data/sector.ts";

interface SectorPanelProps {
  world: World;
  bus: GameBus;
}

const ROLE_BADGE: Record<SectorRole, { label: string; color: string }> = {
  home: { label: "HOME", color: "#89b4fa" },
  reachable: { label: "REACHABLE", color: "#a6e3a1" },
  locked: { label: "LOCKED", color: "#585b70" },
};

export default function SectorPanel({ world, bus }: SectorPanelProps) {
  useGameTick(bus, 6);

  if (viewState.view !== "map" || viewState.mapTier !== "sector") return null;

  const activeHygId = hygIdFromSystemId(world.activeSystemId);
  const nodes = sectorNodes();

  return (
    <div
      className="interactive"
      style={{
        position: "absolute",
        top: 48,
        right: 10,
        width: 280,
        padding: "10px 12px",
        background: "rgba(5,6,10,0.9)",
        border: "1px solid #1e2030",
        borderRadius: 6,
        font: "11px/1.5 ui-monospace, monospace",
        color: "#cdd6f4",
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: 2, color: "#585b70", marginBottom: 8 }}>
        ◇ SECTOR — LOCAL NEIGHBOURHOOD
      </div>

      {nodes.map((node) => {
        const badge = ROLE_BADGE[node.def.role];
        const isActive = node.systemId === world.activeSystemId;
        const dist =
          activeHygId !== undefined && !isActive
            ? distanceLyById(activeHygId, node.def.hygId)
            : null;
        return (
          <div
            key={node.systemId}
            style={{
              padding: "6px 0",
              borderTop: "1px solid #161824",
              opacity: node.def.role === "locked" ? 0.6 : 1,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ color: "#cdd6f4", fontWeight: "bold" }}>{node.def.name}</span>
              <span style={{ color: badge.color, fontSize: 9, letterSpacing: 1 }}>
                {isActive ? "◉ YOU ARE HERE" : badge.label}
              </span>
            </div>
            <div style={{ color: "#585b70", fontSize: 10 }}>
              {node.star.spect ?? "?"}
              {dist !== null && <> · {dist.toFixed(2)} ly</>}
            </div>
            <div style={{ color: "#6c7086", fontSize: 10, marginTop: 2 }}>{node.def.note}</div>
          </div>
        );
      })}

      <div style={{ color: "#45475a", fontSize: 9, marginTop: 8 }}>
        Zoom in to return to the system view.
      </div>
    </div>
  );
}
