// "While you were away" toast — shows the offline-progression summary
// (sim/save/offline.ts) after a boot-load or a backgrounded-tab resume that
// credited real time. Dismissible; reads the shared offlineSummaryState ref
// (set by main.ts) the same way SteerHint/HazardBanner read plain refs — a
// periodic poll via useGameTick, no dedicated event channel needed.
//
// Headlines terraforming/water alongside population + habitability: water is
// the game's signature transformation payoff (docs/15 §2 Legacy), so it's the
// line a returning player most wants to see, not just population.

import type { CSSProperties } from "react";
import type { GameBus } from "../app/game-bus.ts";
import { useGameTick } from "./hooks/useGameTick.ts";
import { offlineSummaryState } from "../app/offline-summary-state.ts";

function fmtDuration(ms: number): string {
  const totalMin = Math.max(1, Math.round(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtSigned(n: number, digits = 0): string {
  const r = n.toFixed(digits);
  return n > 0 ? `+${r}` : r;
}

export default function OfflineSummary({ bus }: { bus: GameBus }) {
  useGameTick(bus, 10);
  const progress = offlineSummaryState.current;
  if (!progress || progress.econTicksRun <= 0) return null;

  const totalPopDelta = progress.colonies.reduce(
    (sum, c) => sum + (c.populationAfter - c.populationBefore),
    0,
  );

  const habDeltas = progress.colonies
    .filter((c) => c.habitabilityBefore !== undefined && c.habitabilityAfter !== undefined)
    .map((c) => (c.habitabilityAfter! - c.habitabilityBefore!) * 100);
  const maxHabDelta = habDeltas.length ? Math.max(...habDeltas) : 0;

  // The terraforming/water payoff line — the headline this game is built around.
  const waterDeltas = progress.colonies
    .filter((c) => c.hydrosphereBefore !== undefined && c.hydrosphereAfter !== undefined)
    .map((c) => (c.hydrosphereAfter! - c.hydrosphereBefore!) * 100);
  const maxWaterDelta = waterDeltas.length ? Math.max(...waterDeltas) : 0;

  const nothingToShow = totalPopDelta === 0 && maxHabDelta === 0 && maxWaterDelta === 0;

  return (
    <div className="interactive" style={toastStyle}>
      <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#89b4fa", marginBottom: 4 }}>
        WHILE YOU WERE AWAY — {fmtDuration(progress.elapsedMs)}
        {progress.clamped && <span style={{ color: "#7a6a4a" }}> (capped at 12h)</span>}
      </div>
      <div style={{ fontSize: 12, color: "#cdd6f4", display: "flex", gap: 14, flexWrap: "wrap" }}>
        {nothingToShow ? (
          <span style={{ color: "#585b70" }}>No change worth reporting.</span>
        ) : (
          <>
            {totalPopDelta !== 0 && <span>{fmtSigned(totalPopDelta)} population</span>}
            {maxWaterDelta !== 0 && <span>water {fmtSigned(maxWaterDelta, 1)}%</span>}
            {maxHabDelta !== 0 && <span>habitability {fmtSigned(maxHabDelta, 1)}%</span>}
          </>
        )}
      </div>
      <button
        onClick={() => { offlineSummaryState.current = null; }}
        style={dismissBtn}
      >
        DISMISS
      </button>
    </div>
  );
}

const toastStyle: CSSProperties = {
  position: "absolute",
  bottom: 16,
  left: "50%",
  transform: "translateX(-50%)",
  maxWidth: 480,
  padding: "10px 16px",
  background: "rgba(5,6,10,0.92)",
  border: "1px solid #2a2c3f",
  borderRadius: 6,
  boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
  zIndex: 95,
  font: "12px/1.5 ui-monospace, monospace",
};

const dismissBtn: CSSProperties = {
  marginTop: 8,
  padding: "4px 10px",
  fontSize: 10,
  fontFamily: "inherit",
  cursor: "pointer",
  background: "#1e2030",
  color: "#a6adc8",
  border: "1px solid #313244",
  borderRadius: 4,
  letterSpacing: 0.5,
};
