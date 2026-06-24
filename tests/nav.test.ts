// Exploration-polish A — pure flight-HUD navigation helpers (the target marker).

import { describe, it, expect } from "vitest";
import { nearestBodyId, markerScreenPosition } from "../src/app/nav.ts";

describe("nearestBodyId", () => {
  it("returns the closest body to the ship", () => {
    const bodies: [number, { x: number; y: number; z: number }][] = [
      [1, { x: 100, y: 0, z: 0 }],
      [2, { x: 10, y: 0, z: 0 }],
      [3, { x: 50, y: 0, z: 0 }],
    ];
    const r = nearestBodyId(bodies, { x: 0, y: 0, z: 0 });
    expect(r?.id).toBe(2);
    expect(r?.dist).toBeCloseTo(10, 6);
  });

  it("returns null when there are no bodies", () => {
    expect(nearestBodyId([], { x: 0, y: 0, z: 0 })).toBeNull();
  });
});

describe("markerScreenPosition", () => {
  const W = 800;
  const H = 600;

  it("places a centred, in-front target as an on-screen reticle", () => {
    const p = markerScreenPosition(0, 0, false, W, H, 28);
    expect(p.offscreen).toBe(false);
    expect(p.x).toBeCloseTo(W / 2, 6);
    expect(p.y).toBeCloseTo(H / 2, 6);
  });

  it("maps NDC corners to the correct screen corners (y flipped)", () => {
    const p = markerScreenPosition(1, 1, false, W, H, 28); // top-right in NDC
    expect(p.offscreen).toBe(false);
    expect(p.x).toBeCloseTo(W, 6);
    expect(p.y).toBeCloseTo(0, 6); // NDC +y is up → screen y=0
  });

  it("clamps an off-screen target to the viewport edge with a margin", () => {
    const p = markerScreenPosition(3, 0, false, W, H, 28); // far to the right
    expect(p.offscreen).toBe(true);
    expect(p.x).toBeCloseTo(W - 28, 6); // right edge inset by the margin
    expect(p.y).toBeCloseTo(H / 2, 6);
    expect(p.angle).toBeCloseTo(0, 6); // chevron points +x (right)
  });

  it("flips direction when the target is behind the camera", () => {
    // Behind + to the NDC-left → real direction is to the right after flipping.
    const p = markerScreenPosition(-3, 0, true, W, H, 28);
    expect(p.offscreen).toBe(true);
    expect(p.x).toBeGreaterThan(W / 2);
  });

  it("points up for a degenerate centred-but-behind target", () => {
    const p = markerScreenPosition(0, 0, true, W, H, 28);
    expect(p.offscreen).toBe(true);
    expect(p.y).toBeLessThan(H / 2); // clamped toward the top edge
  });
});
