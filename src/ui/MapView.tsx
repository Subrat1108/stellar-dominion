// Unified map overlay (Exploration Polish C) — labels + clicks + detail popup.
//
// The renderer (scene.ts) draws the 3D map tiers and each frame publishes every
// visible node's screen position into `mapState` (app/map-state.ts). This DOM
// overlay reads that ref (polled via a game tick) and draws a clickable label per
// node; clicking opens a detail popup that reuses <BodyDetails> and offers only
// the context actions valid for that body + ship state (pure `bodyActions`).
//
// This commit wires the SYSTEM tier (bodies in the active system → SET COURSE /
// AUTOPILOT / ENTER ORBIT / LAND). The sector tier (warp/scan nodes, reachability)
// is added in the next commit, which folds SectorPanel in here.

import { useState } from "react";
import type { World } from "../sim/ecs/world.ts";
import type { GameBus } from "../app/game-bus.ts";
import { viewState } from "../app/view-state.ts";
import { mapState, type MapNode } from "../app/map-state.ts";
import { dispatch } from "../app/command-bus.ts";
import { useGameTick } from "./hooks/useGameTick.ts";
import { landingRange, enterOrbitRange } from "../sim/presentation.ts";
import { bodyActions, type MapAction } from "../sim/map/actions.ts";
import BodyDetails, { ProvenanceTag } from "./BodyDetails.tsx";

interface MapViewProps {
  world: World;
  bus: GameBus;
}

export default function MapView({ world, bus }: MapViewProps) {
  useGameTick(bus, 20); // poll renderer-published node positions
  const [selectedEntity, setSelectedEntity] = useState<number | null>(null);

  // Only the in-system tier for this commit; the sector tier still uses SectorPanel.
  if (viewState.view !== "map" || viewState.mapTier !== "system") return null;

  const nodes = mapState.nodes;
  const selectedBody =
    selectedEntity !== null ? world.components.celestialBody.get(selectedEntity) ?? null : null;

  return (
    <>
      {/* Node labels — clickable chips at renderer-projected screen positions. */}
      {nodes.map((node) => (
        <NodeLabel
          key={node.id}
          node={node}
          selected={node.entityId === selectedEntity}
          onClick={() =>
            setSelectedEntity(node.entityId === selectedEntity ? null : node.entityId ?? null)
          }
        />
      ))}

      {selectedBody && selectedEntity !== null && (
        <DetailPopup
          world={world}
          entityId={selectedEntity}
          onClose={() => setSelectedEntity(null)}
        />
      )}
    </>
  );
}

function NodeLabel({
  node,
  selected,
  onClick,
}: {
  node: MapNode;
  selected: boolean;
  onClick: () => void;
}) {
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

function DetailPopup({
  world,
  entityId,
  onClose,
}: {
  world: World;
  entityId: number;
  onClose: () => void;
}) {
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
      default: break; // WARP/SCAN wired at the sector tier (next commit)
    }
  }

  return (
    <div
      className="interactive"
      style={{
        position: "absolute",
        top: 48,
        left: 200,
        width: 288,
        maxHeight: "calc(100% - 96px)",
        overflowY: "auto",
        padding: "10px 12px",
        background: "rgba(5,6,10,0.94)",
        border: "1px solid #1e2030",
        borderRadius: 6,
        color: "#cdd6f4",
        zIndex: 9,
      }}
    >
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
        <button
          onClick={onClose}
          style={{
            background: "transparent", border: "none", color: "#585b70",
            cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0,
          }}
          title="Close"
        >
          ✕
        </button>
      </div>

      {actions.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0" }}>
          {actions.map((a) => {
            const s = ACTION_STYLE[a];
            const label = a === "AUTOPILOT" && autopilotActive ? "✈ AUTOPILOT ON" : s.label;
            return (
              <button
                key={a}
                onClick={() => run(a)}
                style={{
                  padding: "4px 10px", fontSize: 11, fontFamily: "inherit", cursor: "pointer",
                  background: s.bg, color: s.color, border: `1px solid ${s.border}`,
                  borderRadius: 4, letterSpacing: 0.5,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <BodyDetails body={body} distFromShip={dist} showEsi />
    </div>
  );
}
