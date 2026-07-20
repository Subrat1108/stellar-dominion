// Root React component. Wires the world ref and game bus to the UI pieces.
// The Three.js canvas is a sibling in the DOM (outside this tree),
// so this component only manages the overlay panels.

import type { World } from "../sim/ecs/world.ts";
import type { GameBus } from "../app/game-bus.ts";
import { viewState } from "../app/view-state.ts";
import { steerState } from "../app/steer-state.ts";
import { useGameTick } from "./hooks/useGameTick.ts";
import { useLandingState } from "./hooks/useLandingState.ts";
import HUD from "./HUD.tsx";
import SystemPanel from "./SystemPanel.tsx";
import MapView from "./MapView.tsx";
import DebugPanel from "./DebugPanel.tsx";
import Minimap from "./Minimap.tsx";
import Scanner from "./Scanner.tsx";
import Cockpit from "./Cockpit.tsx";
import SurfaceMode from "./SurfaceMode.tsx";
import SettingsMenu from "./SettingsMenu.tsx";
import OfflineSummary from "./OfflineSummary.tsx";

interface AppProps {
  world: World;
  bus: GameBus;
  /** Set when boot couldn't load an existing save and started fresh instead. */
  loadNotice?: string | null;
}

export default function App({ world, bus, loadNotice = null }: AppProps) {
  // A dedicated full-screen SURFACE MODE while landed: the flight overlays are
  // not rendered (so the flight HUD never overlays the surface map, Slice 1).
  // TAKE OFF clears the landed state → the flight overlays return.
  const landed = useLandingState(bus) !== null;
  return (
    <>
      {landed ? (
        <SurfaceMode world={world} bus={bus} />
      ) : (
        <>
          <HUD world={world} bus={bus} />
          <SystemPanel world={world} bus={bus} />
          <MapView world={world} bus={bus} />
          <Minimap world={world} bus={bus} />
          <Scanner world={world} bus={bus} />
          <Cockpit world={world} bus={bus} />
          <DebugPanel world={world} bus={bus} />
          <SteerHint bus={bus} />
          <TransitionFade bus={bus} />
          <HazardBanner world={world} bus={bus} />
        </>
      )}
      {/* Always-on chrome (both modes). */}
      <SettingsMenu loadNotice={loadNotice} />
      <OfflineSummary bus={bus} />
    </>
  );
}

/** Discoverability prompt for pointer-lock steering (Polish B). Shows in flight
 *  until the pointer is captured, then a compact "release" hint while steering. */
function SteerHint({ bus }: { bus: GameBus }) {
  useGameTick(bus, 6);
  if (viewState.view === "map") return null;
  const locked = steerState.pointerLocked;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 84, // sits just above the center-bottom Scanner readout
        left: "50%",
        transform: "translateX(-50%)",
        padding: "3px 12px",
        background: "rgba(5,6,10,0.7)",
        border: "1px solid #1e2030",
        borderRadius: 3,
        font: "10px/1.4 ui-monospace, monospace",
        color: locked ? "#585b70" : "#89dceb",
        pointerEvents: "none",
        whiteSpace: "nowrap",
        zIndex: 6,
      }}
    >
      {locked
        ? "STEERING · move to aim · W/S/A/D to fly · hold Space to look · release to stop"
        : "W/S accelerate · A/D strafe · hold left-button / trackpad double-tap-hold to steer · two-finger scroll to zoom"}
    </div>
  );
}

/** Surfaces the active system's environmental hazard (e.g. YZ Ceti's SPI). */
function HazardBanner({ world, bus }: { world: World; bus: GameBus }) {
  useGameTick(bus, 4);
  const hazard = world.activeHazard;
  // Shown in flight only (the sector/map views have their own UI).
  if (!hazard || viewState.view === "map") return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        left: "50%",
        transform: "translateX(-50%)",
        maxWidth: 520,
        padding: "6px 14px",
        background: "rgba(40,28,8,0.9)",
        border: "1px solid #5c4a1e",
        borderRadius: 4,
        font: "11px/1.4 ui-monospace, monospace",
        color: "#f9e2af",
        textAlign: "center",
        pointerEvents: "none",
        zIndex: 60,
      }}
    >
      ⚠ SYSTEM HAZARD — {hazard.label}
      <div style={{ color: "#cbb88f", fontSize: 10, marginTop: 2 }}>{hazard.description}</div>
    </div>
  );
}

/** Black cross-fade overlay driven by the renderer's map-tier transition. */
function TransitionFade({ bus }: { bus: GameBus }) {
  useGameTick(bus, 30);
  const t = viewState.transitionT;
  if (t <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#03040a",
        opacity: t,
        pointerEvents: "none",
        zIndex: 80,
      }}
    />
  );
}
