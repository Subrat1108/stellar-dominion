// Cockpit canopy overlay (Exploration Polish B).
//
// Immersive first-person "Direction 1" cockpit built CHEAP: a static CSS
// foreground overlay (canopy frame + A-pillar struts + vignette + boresight),
// NOT modeled 3D interior geometry — so it costs the MacBook-Air GPU nothing
// per frame beyond compositing. Shown only in the cockpit camera view; the
// center is left clear so a body visibly grows as you approach it.
//
// Reads viewState (plain mutable ref) + the world ref + the shared speedState
// singleton directly, since the renderer that drives them runs outside React.
// The moving target/direction pipper is drawn by the renderer (scene.ts); this
// component owns the static frame + the integrated text HUD (mode + throttle).

import type { World } from "../sim/ecs/world.ts";
import type { GameBus } from "../app/game-bus.ts";
import { viewState } from "../app/view-state.ts";
import { speedState } from "../app/speed-state.ts";
import { SPEED_GEAR_LABELS } from "../sim/presentation.ts";
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
  const throttle = SPEED_GEAR_LABELS[speedState.value];

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
      }}
    >
      {/* Vignette — subtly darkens the canopy edges, framing the forward view. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(120% 90% at 50% 42%, rgba(0,0,0,0) 58%, rgba(3,4,10,0.72) 100%)",
        }}
      />

      {/* Canopy edge bars (top thin, bottom thicker console lip). */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 44,
        background: "linear-gradient(180deg, rgba(10,12,20,0.95), rgba(10,12,20,0))" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 96,
        background: "linear-gradient(0deg, rgba(8,10,18,0.96), rgba(8,10,18,0))" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 40,
        background: "linear-gradient(90deg, rgba(10,12,20,0.9), rgba(10,12,20,0))" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 40,
        background: "linear-gradient(270deg, rgba(10,12,20,0.9), rgba(10,12,20,0))" }} />

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

      {/* MODE readout — top center, integrated into the canopy header. */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          font: "11px/1.2 ui-monospace, monospace",
          textAlign: "center",
          textShadow: "0 0 4px #000",
        }}
      >
        <span style={{ color: "#585b70", letterSpacing: 1 }}>MODE </span>
        <span style={{ color: mode.color, fontWeight: "bold", letterSpacing: 1 }}>{mode.label}</span>
      </div>

      {/* THROTTLE gear — bottom-right of the console lip. */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          right: 24,
          font: "11px/1.2 ui-monospace, monospace",
          textAlign: "right",
          textShadow: "0 0 4px #000",
        }}
      >
        <span style={{ color: "#585b70", letterSpacing: 1 }}>THR </span>
        <span style={{ color: "#cdd6f4", fontWeight: "bold", letterSpacing: 1 }}>{throttle}</span>
      </div>
    </div>
  );
}
