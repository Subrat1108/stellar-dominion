// Subscribe to the sim's Landed / TookOff events and expose the current landed
// body id to React. The canonical value lives in landingState (a plain ref kept
// in sync by main.ts); this hook just mirrors it into React state so components
// re-render exactly when it changes — no per-tick polling.

import { useEffect, useState } from "react";
import type { GameBus } from "../../app/game-bus.ts";
import { landingState } from "../../app/landing-state.ts";

export function useLandingState(bus: GameBus): number | null {
  const [landedBodyId, setLandedBodyId] = useState<number | null>(landingState.landedBodyId);

  useEffect(() => {
    return bus.onEvent((event) => {
      if (event.kind === "Landed") setLandedBodyId(event.bodyId);
      else if (event.kind === "TookOff") setLandedBodyId(null);
    });
  }, [bus]);

  return landedBodyId;
}
