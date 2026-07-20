// Placeholder surface panels (Slice 1) — the TECH and CIVIC top-bar toggles show
// these stubs only. The real trees are later layers (the progression/tech tree
// that retires god-mode warp; civic/governance) — buttons + stubs now, not the
// trees (docs/05).

import type { CSSProperties } from "react";

export function TechPanel() {
  return (
    <Stub
      title="TECH"
      lines={[
        "Tech tree — coming with the progression layer.",
        "Colony output will unlock reach (and eventually retire god-mode warp): docs/15 §5.",
      ]}
    />
  );
}

export function CivicPanel() {
  return (
    <Stub
      title="CIVIC"
      lines={[
        "Civic — coming later.",
        "Governance, policy, and factions arrive with the trade/diplomacy layer.",
      ]}
    />
  );
}

function Stub({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: 2, color: "#585b70", marginBottom: 12 }}>{title}</div>
      <div style={placeholder}>
        {lines.map((l, i) => (
          <p key={i} style={{ margin: i === 0 ? 0 : "8px 0 0", color: i === 0 ? "#a6adc8" : "#585b70" }}>{l}</p>
        ))}
      </div>
    </div>
  );
}

const placeholder: CSSProperties = {
  padding: "14px 16px",
  background: "#0e1018",
  border: "1px dashed #2a2c3f",
  borderRadius: 6,
  font: "12px/1.5 ui-monospace, monospace",
};
