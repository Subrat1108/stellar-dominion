// Unified map overlay (Exploration Polish C) — labels + clicks + detail popup.
//
// The renderer (scene.ts) draws the 3D map tiers and each frame publishes every
// visible node's screen position into `mapState` (app/map-state.ts). This DOM
// overlay reads that ref (polled via a game tick) and draws a clickable label per
// node; clicking opens a detail popup that offers only the context actions valid
// for that node + ship state (pure `bodyActions`).
//
//  - SYSTEM tier: bodies in the active system → SET COURSE / AUTOPILOT / ENTER
//    ORBIT / LAND, plus the reused <BodyDetails> field block.
//  - SECTOR tier: reachable star SYSTEM nodes → SCAN (coarse preview) → WARP, or
//    GET DETAILS for a visited system. This folds the old SectorPanel in.

import { useState } from "react";
import type { World } from "../sim/ecs/world.ts";
import type { GameBus } from "../app/game-bus.ts";
import { viewState } from "../app/view-state.ts";
import { mapState, type MapNode } from "../app/map-state.ts";
import { dispatch } from "../app/command-bus.ts";
import { useGameTick } from "./hooks/useGameTick.ts";
import { landingRange, enterOrbitRange } from "../sim/presentation.ts";
import { bodyActions, type MapAction } from "../sim/map/actions.ts";
import {
  reachableSectorNodes,
  isWarpReachable,
} from "../sim/data/sector.ts";
import { SPOOL_TICKS, transitTicksForLy } from "../sim/systems/warp.ts";
import { scanPreview } from "../sim/gen/scan.ts";
import BodyDetails, { ProvenanceTag } from "./BodyDetails.tsx";

interface MapViewProps {
  world: World;
  bus: GameBus;
}

export default function MapView({ world, bus }: MapViewProps) {
  useGameTick(bus, 20); // poll renderer-published node positions
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (viewState.view !== "map") return null;
  // Galactic / intergalactic scaffold tiers are wired in the next commit.
  if (viewState.mapTier !== "system" && viewState.mapTier !== "sector") return null;

  const nodes = mapState.nodes;
  const selected = selectedId ? nodes.find((n) => n.id === selectedId) ?? null : null;
  const showWarpStatus = viewState.mapTier === "sector" && world.warp.phase !== "idle";

  return (
    <>
      {nodes.map((node) => (
        <NodeLabel
          key={node.id}
          node={node}
          selected={node.id === selectedId}
          onClick={() => setSelectedId(node.id === selectedId ? null : node.id)}
        />
      ))}

      {selected?.entityId !== undefined && (
        <BodyDetailPopup world={world} entityId={selected.entityId} onClose={() => setSelectedId(null)} />
      )}
      {selected?.systemId !== undefined && (
        <SystemNodePopup world={world} systemId={selected.systemId} onClose={() => setSelectedId(null)} />
      )}

      {showWarpStatus && <WarpStatusBanner world={world} />}
    </>
  );
}

function NodeLabel({ node, selected, onClick }: { node: MapNode; selected: boolean; onClick: () => void }) {
  if (!node.onScreen) return null;
  return (
    <button
      className="interactive"
      onClick={onClick}
      style={{
        position: "absolute",
        left: node.screenX,
        top: node.screenY,
        transform: "translate(-50%,-50%)",
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 7px",
        background: selected ? "rgba(30,32,48,0.95)" : "rgba(5,6,10,0.6)",
        border: `1px solid ${selected ? "#89b4fa" : "#313244"}`,
        borderRadius: 4,
        color: "#cdd6f4",
        cursor: "pointer",
        font: "11px/1.1 ui-monospace, monospace",
        whiteSpace: "nowrap",
        pointerEvents: "auto",
        zIndex: 7,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: node.color, flex: "0 0 auto" }} />
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.1 }}>
        <span>{node.label}</span>
        <span style={{ color: "#585b70", fontSize: 9 }}>{node.typeLabel}</span>
      </span>
    </button>
  );
}

const ACTION_STYLE: Record<MapAction, { label: string; color: string; bg: string; border: string }> = {
  SET_COURSE: { label: "▶ SET COURSE", color: "#89b4fa", bg: "#1e3a5f", border: "#2a4a7f" },
  AUTOPILOT: { label: "✈ AUTOPILOT", color: "#f9e2af", bg: "#3a341e", border: "#5c4a1e" },
  ENTER_ORBIT: { label: "◎ ENTER ORBIT", color: "#89dceb", bg: "#173a44", border: "#245c6a" },
  LAND: { label: "⬇ LAND", color: "#a6e3a1", bg: "#1e3a5f", border: "#2f5f3a" },
  WARP: { label: "⟫ WARP", color: "#a6e3a1", bg: "#2a3b2a", border: "#3f5f3a" },
  SCAN: { label: "◎ SCAN", color: "#a6adc8", bg: "#1e2030", border: "#313244" },
  GET_DETAILS: { label: "GET DETAILS", color: "#a6adc8", bg: "#1e2030", border: "#313244" },
};

function actionButton(a: MapAction, label: string, onClick: () => void) {
  const s = ACTION_STYLE[a];
  return (
    <button
      key={a}
      onClick={onClick}
      style={{
        padding: "4px 10px", fontSize: 11, fontFamily: "inherit", cursor: "pointer",
        background: s.bg, color: s.color, border: `1px solid ${s.border}`,
        borderRadius: 4, letterSpacing: 0.5,
      }}
    >
      {label}
    </button>
  );
}

const popupStyle = {
  position: "absolute" as const,
  top: 48,
  left: 200,
  width: 300,
  maxHeight: "calc(100% - 96px)",
  overflowY: "auto" as const,
  padding: "10px 12px",
  background: "rgba(5,6,10,0.94)",
  border: "1px solid #1e2030",
  borderRadius: 6,
  color: "#cdd6f4",
  zIndex: 9,
};

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      style={{ background: "transparent", border: "none", color: "#585b70", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}
      title="Close"
    >
      ✕
    </button>
  );
}

// --- System tier: a body in the active system --------------------------------
function BodyDetailPopup({ world, entityId, onClose }: { world: World; entityId: number; onClose: () => void }) {
  const body = world.components.celestialBody.get(entityId);
  if (!body) return null;

  const shipPos = world.components.transform.get(world.shipId)?.position ?? { x: 0, y: 0, z: 0 };
  const bp = world.components.transform.get(entityId)?.position ?? { x: 0, y: 0, z: 0 };
  const dist = Math.hypot(shipPos.x - bp.x, shipPos.y - bp.y, shipPos.z - bp.z);

  const ctrl = world.components.shipControl.get(world.shipId);
  const autopilotActive = ctrl?.autopilotActive ?? false;
  const landed = ctrl?.landedBodyId !== undefined;

  const actions = bodyActions({
    nodeKind: body.kind,
    tier: "system",
    landed,
    autopilotActive,
    orbitingHere: ctrl?.orbitingBodyId === entityId,
    distFromShip: dist,
    landingRange: landingRange(body.renderRadius),
    enterOrbitRange: enterOrbitRange(body.renderRadius),
    isActiveSystem: false,
    reachable: false,
    scanned: false,
    visited: false,
    locked: false,
  }).filter((a) => a !== "GET_DETAILS"); // details are shown in this popup already

  function run(action: MapAction) {
    switch (action) {
      case "SET_COURSE": dispatch(world, { kind: "SetCourse", bodyId: entityId }); break;
      case "AUTOPILOT":
        if (autopilotActive) dispatch(world, { kind: "CancelCourse" });
        else dispatch(world, { kind: "EngageAutopilot", bodyId: entityId });
        break;
      case "ENTER_ORBIT": dispatch(world, { kind: "EnterOrbit", bodyId: entityId }); break;
      case "LAND": dispatch(world, { kind: "LandAtBody", bodyId: entityId }); break;
      default: break;
    }
  }

  return (
    <div className="interactive" style={popupStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontWeight: "bold", fontSize: 14 }}>{body.name}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 2, alignItems: "center" }}>
            <span style={{ color: "#585b70", fontSize: 11 }}>
              {body.kind === "star" ? body.spectralType : body.kind === "gas-giant" ? "Gas Giant" : "Rocky Planet"}
            </span>
            <ProvenanceTag tag={body.dataTag} />
          </div>
        </div>
        <CloseButton onClose={onClose} />
      </div>

      {actions.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0" }}>
          {actions.map((a) =>
            actionButton(a, a === "AUTOPILOT" && autopilotActive ? "✈ AUTOPILOT ON" : ACTION_STYLE[a].label, () => run(a)),
          )}
        </div>
      )}

      <BodyDetails body={body} distFromShip={dist} showEsi />
    </div>
  );
}

// --- Sector tier: a reachable star system ------------------------------------
function SystemNodePopup({ world, systemId, onClose }: { world: World; systemId: string; onClose: () => void }) {
  const info = reachableSectorNodes(world.activeSystemId).find((n) => n.systemId === systemId);
  if (!info) return null;

  const warp = world.warp;
  const isActive = systemId === world.activeSystemId;
  const reachable = isWarpReachable(world.activeSystemId, systemId);
  const visited = world.discovered.includes(systemId);
  const scanningThis = warp.phase === "scan" && warp.destinationSystemId === systemId;
  const scanned = visited || scanningThis;
  const landed = world.components.shipControl.get(world.shipId)?.landedBodyId !== undefined;

  const actions = bodyActions({
    nodeKind: "system",
    tier: "sector",
    landed,
    autopilotActive: false,
    orbitingHere: false,
    distFromShip: 0,
    landingRange: 0,
    enterOrbitRange: 0,
    isActiveSystem: isActive,
    reachable,
    scanned,
    visited,
    locked: false,
  });

  // ETA: committed spool + distance-proportional transit (display only).
  const etaSecs = (SPOOL_TICKS + transitTicksForLy(info.distanceLy)) / 60;

  function warpTo() {
    // Visited systems skip the manual preview step: scan + commit in one tick.
    if (scanningThis) dispatch(world, { kind: "CommitWarp" });
    else {
      dispatch(world, { kind: "BeginWarpScan", systemId });
      if (visited) dispatch(world, { kind: "CommitWarp" });
    }
  }

  return (
    <div className="interactive" style={popupStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontWeight: "bold", fontSize: 14 }}>{info.name}</div>
          <div style={{ color: "#585b70", fontSize: 11, marginTop: 2 }}>
            {info.star.spect ?? "?"}
            {!isActive && <> · {info.distanceLy.toFixed(2)} ly</>}
            {isActive && <> · ◉ you are here</>}
          </div>
        </div>
        <CloseButton onClose={onClose} />
      </div>

      {info.note && (
        <p style={{ color: "#a6adc8", fontSize: 11, lineHeight: 1.5, margin: "8px 0 0" }}>{info.note}</p>
      )}

      {!isActive && reachable && (
        <div style={{ color: "#585b70", fontSize: 10, marginTop: 6 }}>
          Est. travel ≈ {etaSecs.toFixed(1)} s (spool + transit; scales with distance)
        </div>
      )}
      {!isActive && !reachable && (
        <div style={{ color: "#585b70", fontSize: 10, marginTop: 6 }}>Out of warp range.</div>
      )}
      {landed && !isActive && (
        <div style={{ color: "#f9e2af", fontSize: 10, marginTop: 4 }}>Take off before warping.</div>
      )}

      {scanningThis && <ScanReadout world={world} systemId={systemId} />}

      {actions.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {actions.map((a) => {
            if (a === "WARP") return actionButton("WARP", ACTION_STYLE.WARP.label, warpTo);
            if (a === "SCAN") return actionButton("SCAN", ACTION_STYLE.SCAN.label, () => dispatch(world, { kind: "BeginWarpScan", systemId }));
            return null; // GET_DETAILS is implicit (fields are shown)
          })}
          {scanningThis && actionButton("SCAN", "CANCEL", () => dispatch(world, { kind: "CancelWarp" }))}
        </div>
      )}
    </div>
  );
}

function ScanReadout({ world, systemId }: { world: World; systemId: string }) {
  const p = scanPreview(world.universeSeed, systemId);
  return (
    <div style={{ marginTop: 8, padding: "6px 8px", background: "rgba(137,180,250,0.06)", borderRadius: 4 }}>
      <div style={{ color: "#89dceb", fontSize: 10, marginBottom: 3 }}>TELEMETRY (coarse)</div>
      <div style={{ color: "#a6adc8", fontSize: 10 }}>
        {p.starSpectralType} star · ≈{p.planetCount} planet{p.planetCount === 1 ? "" : "s"}
        {p.gasGiantCount > 0 && <> ({p.gasGiantCount} giant{p.gasGiantCount === 1 ? "" : "s"})</>}
      </div>
      {p.hazardLabel && <div style={{ color: "#f9e2af", fontSize: 10, marginTop: 2 }}>⚠ {p.hazardLabel}</div>}
      <div style={{ color: "#45475a", fontSize: 9, marginTop: 2 }}>Detail resolves on arrival.</div>
    </div>
  );
}

function WarpStatusBanner({ world }: { world: World }) {
  const warp = world.warp;
  const secs = (warp.ticksRemaining / 60).toFixed(1);
  const label =
    warp.phase === "spool" ? `SPOOLING — ${secs}s` :
    warp.phase === "transit" ? `IN TRANSIT — ${secs}s` :
    "SCANNED";
  const color = warp.phase === "transit" ? "#f9e2af" : "#89dceb";
  return (
    <div
      className="interactive"
      style={{
        position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
        padding: "6px 14px", background: "rgba(5,6,10,0.92)", border: "1px solid #1e2030",
        borderRadius: 4, font: "11px/1.4 ui-monospace, monospace", color, zIndex: 10, textAlign: "center",
      }}
    >
      ⟫ WARP — {label}
      {warp.phase === "spool" && (
        <button
          onClick={() => dispatch(world, { kind: "CancelWarp" })}
          style={{ marginLeft: 10, padding: "2px 8px", fontSize: 10, fontFamily: "inherit", cursor: "pointer", background: "#1e2030", color: "#a6adc8", border: "1px solid #313244", borderRadius: 3 }}
        >
          ABORT
        </button>
      )}
    </div>
  );
}
