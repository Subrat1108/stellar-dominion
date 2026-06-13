// React hook: subscribes to sim tick events and triggers a re-render.
//
// The sim runs at 60 ticks/sec; re-rendering React every tick would be wasteful
// for a HUD. `throttle` controls how many ticks to skip before re-rendering
// (default 6 → ~10 Hz, plenty for life-support readouts and crew panels).
//
// The hook returns the current tick count so components can derive any
// sim-time display they need. The world ref is passed separately and read
// directly — it's the same mutated object each tick, so reads are always fresh
// when they happen inside the React render triggered by this hook.

import { useState, useEffect } from "react";
import type { GameBus } from "../../app/game-bus.ts";

export function useGameTick(bus: GameBus, throttle = 6): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let skipped = 0;
    function onTick(e: Event): void {
      skipped++;
      if (skipped >= throttle) {
        skipped = 0;
        setTick((e as CustomEvent<number>).detail);
      }
    }
    bus.addEventListener("tick", onTick);
    return () => bus.removeEventListener("tick", onTick);
  }, [bus, throttle]);

  return tick;
}
