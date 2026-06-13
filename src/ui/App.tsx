// Root React component. Wires the world ref and game bus to the two UI pieces.
// The Three.js canvas is a sibling in the DOM (outside this tree),
// so this component only manages the overlay panels.

import type { World } from "../sim/ecs/world.ts";
import type { GameBus } from "../app/game-bus.ts";
import type { SpeedMultiplier } from "../app/speed-state.ts";
import HUD from "./HUD.tsx";
import SystemPanel from "./SystemPanel.tsx";
import DebugPanel from "./DebugPanel.tsx";

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
      <DebugPanel world={world} bus={bus} speedState={speedState} />
    </>
  );
}
