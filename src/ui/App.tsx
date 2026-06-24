// Root React component. Wires the world ref and game bus to the UI pieces.
// The Three.js canvas is a sibling in the DOM (outside this tree),
// so this component only manages the overlay panels.

import type { World } from "../sim/ecs/world.ts";
import type { GameBus } from "../app/game-bus.ts";
import type { SpeedGear } from "../app/speed-state.ts";
import { viewState } from "../app/view-state.ts";
import { useGameTick } from "./hooks/useGameTick.ts";
import HUD from "./HUD.tsx";
import SystemPanel from "./SystemPanel.tsx";
import SectorPanel from "./SectorPanel.tsx";
import DebugPanel from "./DebugPanel.tsx";
import Minimap from "./Minimap.tsx";
import Scanner from "./Scanner.tsx";
import SurfaceView from "./SurfaceView.tsx";

interface AppProps {
  world: World;
  bus: GameBus;
  speedState: { value: SpeedGear };
}

export default function App({ world, bus, speedState }: AppProps) {
  return (
    <>
      <HUD world={world} bus={bus} speedState={speedState} />
      <SystemPanel world={world} bus={bus} />
      <SectorPanel world={world} bus={bus} />
      <Minimap world={world} bus={bus} />
      <Scanner world={world} bus={bus} />
      <SurfaceView world={world} bus={bus} />
      <DebugPanel world={world} bus={bus} speedState={speedState} />
      <TransitionFade bus={bus} />
      <HazardBanner world={world} bus={bus} />
    </>
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
