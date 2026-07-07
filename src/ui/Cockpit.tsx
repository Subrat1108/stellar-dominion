// Cockpit canopy overlay (Exploration Polish B).
//
// Immersive first-person "Direction 1" cockpit built CHEAP: a static CSS
// foreground overlay (canopy frame + A-pillar struts + vignette + boresight),
// NOT modeled 3D interior geometry — so it costs the MacBook-Air GPU nothing
// per frame beyond compositing. Shown only in the cockpit camera view; the
// center is left clear so a body visibly grows as you approach it.
//
// Reads viewState (plain mutable ref) + the world ref directly, since the
// renderer that drives them runs outside React. The moving target/direction
// pipper is drawn by the renderer (scene.ts); this component owns the static
// frame + the integrated text HUD (mode + speed).

import type { World } from "../sim/ecs/world.ts";
import type { GameBus } from "../app/game-bus.ts";
import { viewState } from "../app/view-state.ts";
import { useGameTick } from "./hooks/useGameTick.ts";

interface CockpitProps {
  world: World;
  bus: GameBus;
}

/** Current flight mode label + colour, derived from the ship-control flags. */
function flightMode(world: World): { label: string; color: string } {
  const ctrl = world.components.shipControl.get(world.shipId);
  if (!ctrl) return { label: "—", color: "#585b70" };
  if (ctrl.landedBodyId !== undefined) return { label: "LANDED", color: "#a6e3a1" };
  if (ctrl.autopilotActive) return { label: "AUTOPILOT", color: "#f9e2af" };
  if (ctrl.orbitingBodyId !== undefined) return { label: "ORBIT", color: "#89dceb" };
  return { label: "MANUAL", color: "#89b4fa" };
}

export default function Cockpit({ world, bus }: CockpitProps) {
  useGameTick(bus, 8);
  if (viewState.view !== "cockpit") return null;

  const mode = flightMode(world);
  const vel = world.components.shipVelocity.get(world.shipId);
  const speedU = vel ? Math.hypot(vel.vx, vel.vy, vel.vz) : 0;

  const strutBase = {
    position: "absolute" as const,
    width: 220,
    height: 90,
    background: "linear-gradient(180deg, rgba(10,12,20,0.92), rgba(10,12,20,0))",
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 4, // below the interactive panels (HUD/SystemPanel), above the canvas
        overflow: "hidden",
        // Inner shadow → the canopy frame reads as WRAPPED AROUND the pilot
        // (a sense of nearness), while the center stays clear for the forward view.
        boxShadow: "inset 0 0 140px 24px rgba(2,3,8,0.78)",
      }}
    >
      {/* Vignette — subtly darkens the canopy edges, framing the forward view. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(120% 90% at 50% 40%, rgba(0,0,0,0) 54%, rgba(3,4,10,0.78) 100%)",
        }}
      />

      {/* Canopy edge bars (top thin; sides slightly wider for a wrapped feel). */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 44,
        background: "linear-gradient(180deg, rgba(10,12,20,0.95), rgba(10,12,20,0))" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 52,
        background: "linear-gradient(90deg, rgba(9,11,18,0.94), rgba(10,12,20,0))" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 52,
        background: "linear-gradient(270deg, rgba(9,11,18,0.94), rgba(10,12,20,0))" }} />

      {/* A-pillar struts — angled dark wedges reading as a cockpit canopy frame. */}
      <div style={{ ...strutBase, top: -18, left: -70, transform: "rotate(38deg)" }} />
      <div style={{ ...strutBase, top: -18, right: -70, transform: "rotate(-38deg)" }} />

      {/* Boresight — fixed forward crosshair (the moving target pipper is the
          renderer's marker; this is the ship's nose direction). */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%,-50%)",
          color: "rgba(137,220,235,0.55)",
          font: "18px/1 ui-monospace, monospace",
          textShadow: "0 0 4px #000",
        }}
      >
        +
      </div>

      {/* Dashboard / coaming — a shaped console silhouette across the bottom third.
          Tall shoulders at the sides dipping in the centre so the forward view
          stays clear; the HUD readouts sit ON it (below) rather than floating. */}
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: "38%" }}
      >
        <defs>
          <linearGradient id="coaming" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0b0e17" stopOpacity="0.65" />
            <stop offset="0.35" stopColor="#0a0c15" stopOpacity="0.96" />
            <stop offset="1" stopColor="#070911" stopOpacity="1" />
          </linearGradient>
        </defs>
        {/* Filled console body with a curved top edge (the coaming). */}
        <path
          d="M0,40 L0,13 C12,13 18,15 26,24 C34,32 42,33 50,33 C58,33 66,32 74,24 C82,15 88,13 100,13 L100,40 Z"
          fill="url(#coaming)"
        />
        {/* Lit top edge — a faint instrument-glow rim along the coaming. */}
        <path
          d="M0,13 C12,13 18,15 26,24 C34,32 42,33 50,33 C58,33 66,32 74,24 C82,15 88,13 100,13"
          fill="none" stroke="#89dceb" strokeOpacity="0.22" strokeWidth="0.5"
        />
        {/* A secondary panel seam for depth. */}
        <path
          d="M0,20 C14,20 20,22 28,29 C36,35 44,36 50,36 C56,36 64,35 72,29 C80,22 86,20 100,20"
          fill="none" stroke="#1b2030" strokeOpacity="0.8" strokeWidth="0.4"
        />
      </svg>

      {/* MODE readout — sitting on the LEFT console shoulder. */}
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          left: "9%",
          font: "11px/1.2 ui-monospace, monospace",
          textShadow: "0 0 4px #000",
        }}
      >
        <div style={{ color: "#585b70", letterSpacing: 1, fontSize: 9 }}>MODE</div>
        <div style={{ color: mode.color, fontWeight: "bold", letterSpacing: 1, fontSize: 13 }}>{mode.label}</div>
      </div>

      {/* SPD readout — sitting on the RIGHT console shoulder. */}
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          right: "9%",
          textAlign: "right",
          font: "11px/1.2 ui-monospace, monospace",
          textShadow: "0 0 4px #000",
        }}
      >
        <div style={{ color: "#585b70", letterSpacing: 1, fontSize: 9 }}>SPD</div>
        <div style={{ color: "#cdd6f4", fontWeight: "bold", letterSpacing: 1, fontSize: 13 }}>{speedU.toFixed(1)}</div>
      </div>
    </div>
  );
}
