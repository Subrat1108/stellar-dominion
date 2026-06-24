// Sector panel — the actionable list behind the sector map (docs/12, docs/01
// legibility). Shown only when the map view is zoomed out to the sector tier.
//
// Lists the neighbourhood with real distances from the active system, and drives
// the warp state machine: SCAN a reachable destination (coarse preview), COMMIT
// the jump (spool → transit → arrive), or CANCEL. Reads viewState + world.warp
// directly (plain refs updated by the renderer/sim), re-rendering each tick.

import type { World } from "../sim/ecs/world.ts";
import type { GameBus } from "../app/game-bus.ts";
import { viewState } from "../app/view-state.ts";
import { dispatch } from "../app/command-bus.ts";
import { useGameTick } from "./hooks/useGameTick.ts";
import {
  sectorNodes,
  distanceLyById,
  hygIdFromSystemId,
  type SectorRole,
} from "../sim/data/sector.ts";
import { scanPreview } from "../sim/gen/scan.ts";

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
  useGameTick(bus, 10);

  if (viewState.view !== "map" || viewState.mapTier !== "sector") return null;

  const activeHygId = hygIdFromSystemId(world.activeSystemId);
  const nodes = sectorNodes();
  const warp = world.warp;

  return (
    <div
      className="interactive"
      style={{
        position: "absolute",
        top: 48,
        right: 10,
        width: 300,
        padding: "10px 12px",
        background: "rgba(5,6,10,0.92)",
        border: "1px solid #1e2030",
        borderRadius: 6,
        font: "11px/1.5 ui-monospace, monospace",
        color: "#cdd6f4",
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: 2, color: "#585b70", marginBottom: 8 }}>
        ◇ SECTOR — LOCAL NEIGHBOURHOOD
      </div>

      {warp.phase !== "idle" && <WarpStatus world={world} />}

      {nodes.map((node) => {
        const badge = ROLE_BADGE[node.def.role];
        const isActive = node.systemId === world.activeSystemId;
        const dist =
          activeHygId !== undefined && !isActive
            ? distanceLyById(activeHygId, node.def.hygId)
            : null;
        const isScanned = warp.phase === "scan" && warp.destinationSystemId === node.systemId;
        const canScan =
          node.def.role === "reachable" &&
          !isActive &&
          (warp.phase === "idle" || warp.phase === "scan");

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

            {canScan && !isScanned && (
              <button
                style={btn("#1e2030", "#a6adc8")}
                onClick={() => dispatch(world, { kind: "BeginWarpScan", systemId: node.systemId })}
              >
                ◎ SCAN
              </button>
            )}
            {isScanned && <ScanResult world={world} systemId={node.systemId} />}
          </div>
        );
      })}

      <div style={{ color: "#45475a", fontSize: 9, marginTop: 8 }}>
        Zoom in to return to the system view.
      </div>
    </div>
  );
}

/** Coarse scan readout + commit/cancel for a scanned destination. */
function ScanResult({ world, systemId }: { world: World; systemId: string }) {
  const preview = scanPreview(world.universeSeed, systemId);
  return (
    <div style={{ marginTop: 6, padding: "6px 8px", background: "rgba(137,180,250,0.06)", borderRadius: 4 }}>
      <div style={{ color: "#89dceb", fontSize: 10, marginBottom: 3 }}>TELEMETRY (coarse)</div>
      <div style={{ color: "#a6adc8", fontSize: 10 }}>
        {preview.starSpectralType} star · ≈{preview.planetCount} planet
        {preview.planetCount === 1 ? "" : "s"}
        {preview.gasGiantCount > 0 && <> ({preview.gasGiantCount} giant{preview.gasGiantCount === 1 ? "" : "s"})</>}
      </div>
      {preview.hazardLabel && (
        <div style={{ color: "#f9e2af", fontSize: 10, marginTop: 2 }}>⚠ {preview.hazardLabel}</div>
      )}
      <div style={{ color: "#45475a", fontSize: 9, marginTop: 2 }}>
        Detail resolves on arrival.
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <button style={btn("#2a3b2a", "#a6e3a1")} onClick={() => dispatch(world, { kind: "CommitWarp" })}>
          ⟫ WARP
        </button>
        <button style={btn("#1e2030", "#a6adc8")} onClick={() => dispatch(world, { kind: "CancelWarp" })}>
          CANCEL
        </button>
      </div>
    </div>
  );
}

/** Live spool/transit status with countdown. */
function WarpStatus({ world }: { world: World }) {
  const warp = world.warp;
  const secs = (warp.ticksRemaining / 60).toFixed(1);
  const label =
    warp.phase === "spool" ? `SPOOLING — ${secs}s` :
    warp.phase === "transit" ? `IN TRANSIT — ${secs}s` :
    "SCANNED";
  const color = warp.phase === "transit" ? "#f9e2af" : "#89dceb";
  return (
    <div style={{ padding: "6px 8px", marginBottom: 8, background: "rgba(137,180,250,0.08)", borderRadius: 4 }}>
      <div style={{ color, fontSize: 10, letterSpacing: 1 }}>⟫ WARP — {label}</div>
      {warp.phase === "spool" && (
        <button style={btn("#1e2030", "#a6adc8")} onClick={() => dispatch(world, { kind: "CancelWarp" })}>
          ABORT
        </button>
      )}
      {warp.phase === "transit" && (
        <div style={{ color: "#45475a", fontSize: 9, marginTop: 2 }}>Trajectory locked.</div>
      )}
    </div>
  );
}

function btn(bg: string, color: string) {
  return {
    marginTop: 6,
    padding: "4px 10px",
    fontSize: 10,
    fontFamily: "inherit",
    cursor: "pointer",
    background: bg,
    color,
    border: "1px solid #313244",
    borderRadius: 3,
    letterSpacing: 0.5,
  } as const;
}
