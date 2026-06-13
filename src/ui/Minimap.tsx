// Compass minimap — ship-centric radar, heading pointing up.
//
// The ship is fixed at centre; all bodies are projected into ship-relative
// space and rotated by -heading so the nose always points toward the top of
// the display. Clicking a blip sets an autopilot course (same mechanism as
// SystemPanel's SET COURSE). Scroll wheel or ± buttons cycle through four
// zoom levels. System-scale only — no galaxy/interstellar zoom (Phase 5).

import { useState, useEffect, useRef } from "react";
import type { World } from "../sim/ecs/world.ts";
import type { GameBus } from "../app/game-bus.ts";
import { useGameTick } from "./hooks/useGameTick.ts";

interface MinimapProps {
  world: World;
  bus: GameBus;
}

const SIZE = 180;         // px, square canvas
const PAD  = 12;          // inner margin so edge blips aren't clipped
const R    = SIZE / 2 - PAD; // radar disc radius in px

// Zoom levels: scene units that map to the radar radius R.
const ZOOM_RADII = [20, 80, 300, 800] as const;
type ZoomIdx = 0 | 1 | 2 | 3;
const ZOOM_LABELS = ["20u", "80u", "300u", "800u"];

const CX = SIZE / 2;
const CY = SIZE / 2;

function colorForBody(color: number): string {
  return "#" + color.toString(16).padStart(6, "0");
}

export default function Minimap({ world, bus }: MinimapProps) {
  useGameTick(bus, 8);
  const [zoomIdx, setZoomIdx] = useState<ZoomIdx>(3); // default: full system
  const svgRef = useRef<SVGSVGElement>(null);

  // Scroll wheel zooms in/out.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoomIdx(z => {
        const next = e.deltaY < 0 ? z - 1 : z + 1;
        return Math.max(0, Math.min(3, next)) as ZoomIdx;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const shipPos  = world.components.transform.get(world.shipId)?.position ?? { x: 0, y: 0, z: 0 };
  const shipCtrl = world.components.shipControl.get(world.shipId);
  const heading  = shipCtrl?.heading ?? 0;

  const sceneRadius = ZOOM_RADII[zoomIdx];

  // Project a world (x, z) position relative to the ship into radar px,
  // rotating by -heading so the ship nose always points up.
  function project(wx: number, wz: number): { x: number; y: number; clipped: boolean } {
    const dx = wx - shipPos.x;
    const dz = wz - shipPos.z;
    // Rotate so heading direction → +z → up on screen.
    const h = heading;
    const rx =  dx * Math.cos(h) - dz * Math.sin(h);
    const rz =  dx * Math.sin(h) + dz * Math.cos(h);
    // Scale to px; rz positive = forward = up → negate for screen y.
    const px = (rx / sceneRadius) * R;
    const py = -(rz / sceneRadius) * R;
    const mag = Math.hypot(px, py);
    if (mag > R) {
      return { x: CX + (px / mag) * R, y: CY + (py / mag) * R, clipped: true };
    }
    return { x: CX + px, y: CY + py, clipped: false };
  }

  function setCourse(entityId: number) {
    const ctrl = world.components.shipControl.get(world.shipId);
    if (ctrl) {
      ctrl.autopilotTargetId = entityId;
      ctrl.autopilotActive = true;
    }
  }

  const bodies = [...world.components.celestialBody.entries()];

  // Nose triangle points — equilateral pointing up from centre.
  const noseH = 7, noseW = 4;
  const noseTri = `${CX},${CY - noseH} ${CX - noseW},${CY + 3} ${CX + noseW},${CY + 3}`;

  return (
    <div
      className="interactive"
      style={{
        position: "absolute",
        top: 48,
        left: 10,
        width: SIZE,
        background: "rgba(5,6,10,0.82)",
        border: "1px solid #1e2030",
        borderRadius: 6,
        userSelect: "none",
      }}
    >
      {/* Header row */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "3px 8px",
        borderBottom: "1px solid #1e2030",
      }}>
        <span style={{ font: "10px/1 ui-monospace, monospace", color: "#585b70", letterSpacing: 1 }}>
          ◎ RADAR
        </span>
        <div style={{ display: "flex", gap: 3 }}>
          <ZoomBtn label="−" onClick={() => setZoomIdx(z => Math.min(3, z + 1) as ZoomIdx)} />
          <span style={{ font: "10px/1 ui-monospace, monospace", color: "#45475a", minWidth: 28, textAlign: "center" }}>
            {ZOOM_LABELS[zoomIdx]}
          </span>
          <ZoomBtn label="+" onClick={() => setZoomIdx(z => Math.max(0, z - 1) as ZoomIdx)} />
        </div>
      </div>

      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        style={{ display: "block" }}
      >
        {/* Radar rings */}
        <circle cx={CX} cy={CY} r={R}       fill="none" stroke="#1e2030" />
        <circle cx={CX} cy={CY} r={R * 0.5} fill="none" stroke="#161824" />

        {/* Bodies */}
        {bodies.map(([id, body]) => {
          const bp = world.components.transform.get(id)?.position ?? { x: 0, y: 0, z: 0 };
          const p = project(bp.x, bp.z);
          const isStar = body.kind === "star";
          const r = isStar ? 4 : (p.clipped ? 2 : 3);
          const fill = colorForBody(body.color);
          return (
            <g key={id}>
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
                fill={fill}
                stroke={p.clipped ? fill : (isStar ? "#000" : "none")}
                strokeWidth={p.clipped ? 1 : 0}
                strokeDasharray={p.clipped ? "2,2" : undefined}
                style={{ cursor: isStar ? "default" : "pointer" }}
                onClick={isStar ? undefined : () => setCourse(id)}
              >
                <title>{body.name}{isStar ? "" : " — set course"}</title>
              </circle>
              {/* Name label (only when not clipped and not the star) */}
              {!p.clipped && !isStar && (
                <text
                  x={p.x + 5}
                  y={p.y + 3}
                  fontSize={8}
                  fill="#45475a"
                  style={{ pointerEvents: "none" }}
                >
                  {body.name}
                </text>
              )}
            </g>
          );
        })}

        {/* Ship — nose triangle pointing up (the forward direction) */}
        <polygon points={noseTri} fill="#89b4fa" />
        <circle cx={CX} cy={CY} r={4} fill="none" stroke="#89b4fa" strokeOpacity={0.4} />
      </svg>
    </div>
  );
}

function ZoomBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 18,
        height: 16,
        padding: 0,
        fontSize: 12,
        lineHeight: 1,
        fontFamily: "inherit",
        cursor: "pointer",
        background: "transparent",
        color: "#585b70",
        border: "1px solid #1e2030",
        borderRadius: 2,
      }}
    >
      {label}
    </button>
  );
}
