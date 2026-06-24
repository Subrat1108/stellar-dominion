// Root React component. Wires the world ref and game bus to the UI pieces.
// The Three.js canvas is a sibling in the DOM (outside this tree),
// so this component only manages the overlay panels.

import type { World } from "../sim/ecs/world.ts";
import type { GameBus } from "../app/game-bus.ts";
import type { SpeedMultiplier } from "../app/speed-state.ts";
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
  speedState: { value: SpeedMultiplier };
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
    </>
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
