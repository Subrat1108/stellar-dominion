// Root React component. Wires the world ref and game bus to the two UI pieces.
// The Three.js canvas is a sibling in the DOM (outside this tree),
// so this component only manages the overlay panels.

import type { World } from "../sim/ecs/world.ts";
import type { GameBus } from "../app/game-bus.ts";
import HUD from "./HUD.tsx";
import SystemPanel from "./SystemPanel.tsx";

interface AppProps {
  world: World;
  bus: GameBus;
}

export default function App({ world, bus }: AppProps) {
  return (
    <>
      <HUD world={world} bus={bus} />
      <SystemPanel world={world} bus={bus} />
    </>
  );
}
