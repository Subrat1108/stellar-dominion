// Terraforming panel (Phase 3A) — lives inside the colony view when landed.
//
// Per the Legibility pillar (docs/01 §6) every lever shows: its current parameter
// vs the target, an allocation control (0–100% share of colony output), its live
// resource burn, and — when locked — the specific unmet prerequisite. A header
// shows the resulting habitability % and terraforming stage so the payoff of a
// running program is visible at a glance.

import type { World } from "../sim/ecs/world.ts";
import type { CelestialBody } from "../sim/ecs/components.ts";
import { dispatch } from "../app/command-bus.ts";
import {
  TERRAFORM_LEVERS,
  TERRAFORM_LEVER_DEFS,
  RESOURCE_LABEL,
  ONE_ATM_PA,
  FREEZING_K,
  type TerraformLever,
  type ResourceId,
} from "../sim/data/colony.ts";
import { hydrosphereGate, terraformStage } from "../sim/math/terraforming.ts";
import { habitabilityColor } from "../sim/math/habitability.ts";

interface TerraformingPanelProps {
  world: World;
  bodyId: number;
}

/** Format a lever's raw parameter value for display in human units. */
function formatValue(lever: TerraformLever, body: CelestialBody): string {
  switch (lever) {
    case "temperature":
      return `${((body.surfaceTempK ?? 0) - FREEZING_K).toFixed(0)} °C`;
    case "pressure":
      return `${((body.atmosphere?.pressurePa ?? 0) / ONE_ATM_PA).toFixed(3)} atm`;
    case "hydrosphere":
      return `${Math.round((body.hydrosphere ?? (body.atmosphere?.hasLiquidWater ? 1 : 0)) * 100)}%`;
  }
}

function formatTarget(lever: TerraformLever): string {
  const t = TERRAFORM_LEVER_DEFS[lever].target;
  switch (lever) {
    case "temperature": return `${(t - FREEZING_K).toFixed(0)} °C`;
    case "pressure": return `${(t / ONE_ATM_PA).toFixed(2)} atm`;
    case "hydrosphere": return `${Math.round(t * 100)}%`;
  }
}

export default function TerraformingPanel({ world, bodyId }: TerraformingPanelProps) {
  const body = world.components.celestialBody.get(bodyId);
  if (!body) return null;

  const tf = world.components.terraforming.get(bodyId);
  const hab = body.habitability ?? 0;
  const stage = terraformStage(
    body.atmosphere?.pressurePa ?? 0,
    body.surfaceTempK ?? 0,
    body.atmosphere?.hasLiquidWater ?? false,
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 10, letterSpacing: 1.5, color: "#585b70" }}>TERRAFORMING</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: habitabilityColor(hab) }}>
          {stage} · {Math.round(hab * 100)}%
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {TERRAFORM_LEVERS.map((lever) => (
          <LeverRow key={lever} world={world} bodyId={bodyId} body={body} lever={lever}
            alloc={tf?.allocations[lever] ?? 0} />
        ))}
      </div>
    </div>
  );
}

function LeverRow({
  world, bodyId, body, lever, alloc,
}: {
  world: World; bodyId: number; body: CelestialBody; lever: TerraformLever; alloc: number;
}) {
  const def = TERRAFORM_LEVER_DEFS[lever];
  const gate = lever === "hydrosphere"
    ? hydrosphereGate(body.atmosphere?.pressurePa ?? 0, body.surfaceTempK ?? 0)
    : { locked: false, reason: "" };

  // Live burn at the current allocation, for the resources this lever consumes.
  const burn = (Object.keys(def.maxBurn) as ResourceId[])
    .map((res) => `${(def.maxBurn[res]! * alloc).toFixed(1)} ${RESOURCE_LABEL[res]}`)
    .join(" · ");

  function setAlloc(fraction: number) {
    dispatch(world, { kind: "SetTerraformAllocation", bodyId, lever, fraction });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <span style={{ flex: 1, color: "#cdd6f4" }}>{def.name}</span>
        <span style={{ color: "#a6adc8" }}>{formatValue(lever, body)}</span>
        <span style={{ color: "#585b70", fontSize: 10 }}>→ {formatTarget(lever)}</span>
      </div>

      {gate.locked ? (
        <div style={{ fontSize: 10, color: "#f9e2af", paddingLeft: 2 }}>
          locked: {gate.reason}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(alloc * 100)}
              onChange={(e) => setAlloc(Number(e.target.value) / 100)}
              style={{ flex: 1, accentColor: "#89b4fa" }}
            />
            <span style={{ minWidth: 34, textAlign: "right", fontSize: 11, color: "#cdd6f4" }}>
              {Math.round(alloc * 100)}%
            </span>
          </div>
          <div style={{ fontSize: 10, color: alloc > 0 ? "#89b4fa" : "#45475a", paddingLeft: 2 }}>
            {alloc > 0 ? `burns ${burn}/s` : def.mechanism}
          </div>
        </>
      )}
    </div>
  );
}
