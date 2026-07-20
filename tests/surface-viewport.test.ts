// Tests for the surface-map viewport math (ui/surface/viewport.ts, Slice 1).
// Pure pan/zoom transforms — the screen↔tile round-trips under zoom+pan are the
// bug-prone part, so they're covered directly. No DOM.

import { describe, it, expect } from "vitest";
import {
  TILE_PX,
  fitZoom,
  zoomBounds,
  centeredPan,
  clampPan,
  initialViewport,
  tileScreenRect,
  tileFromScreen,
  zoomAt,
  visibleTileRange,
  worldScreenSize,
  type Viewport,
} from "../src/ui/surface/viewport.ts";

const GW = 96, GH = 48;
const container = { w: 1200, h: 700 };

describe("viewport — fit + bounds + centering", () => {
  it("fitZoom fits the whole grid inside the container (limiting axis)", () => {
    const z = fitZoom(container, GW, GH);
    const ws = worldScreenSize(GW, GH, z);
    // At fit, the world fits within the container and touches the limiting edge.
    expect(ws.w).toBeLessThanOrEqual(container.w + 1e-6);
    expect(ws.h).toBeLessThanOrEqual(container.h + 1e-6);
    expect(Math.max(ws.w / container.w, ws.h / container.h)).toBeCloseTo(1, 6);
  });

  it("zoomBounds.min is the fit zoom (can't zoom out past whole-map) and max > min", () => {
    const b = zoomBounds(container, GW, GH);
    expect(b.min).toBeCloseTo(fitZoom(container, GW, GH), 9);
    expect(b.max).toBeGreaterThan(b.min);
  });

  it("centeredPan centres the world in the container", () => {
    const z = fitZoom(container, GW, GH);
    const { panX, panY } = centeredPan(container, GW, GH, z);
    const ws = worldScreenSize(GW, GH, z);
    expect(panX).toBeCloseTo((container.w - ws.w) / 2, 6);
    expect(panY).toBeCloseTo((container.h - ws.h) / 2, 6);
  });

  it("initialViewport is fit + centred", () => {
    const vp = initialViewport(container, GW, GH);
    expect(vp.zoom).toBeCloseTo(fitZoom(container, GW, GH), 9);
    const c = centeredPan(container, GW, GH, vp.zoom);
    expect(vp.panX).toBeCloseTo(c.panX, 6);
  });
});

describe("viewport — screen↔tile round-trips under zoom+pan", () => {
  const vps: Viewport[] = [
    initialViewport(container, GW, GH),
    { zoom: 1.0, panX: -300, panY: -120 },
    { zoom: 2.3, panX: -1500, panY: -800 },
  ];

  it("tileScreenRect → tileFromScreen recovers the tile (centre of each tile round-trips)", () => {
    for (const vp of vps) {
      for (const [tx, ty] of [[0, 0], [10, 5], [95, 47], [48, 24]] as const) {
        const r = tileScreenRect(vp, tx, ty);
        const got = tileFromScreen(vp, r.sx + r.size / 2, r.sy + r.size / 2, GW, GH);
        expect(got).toEqual({ x: tx, y: ty });
      }
    }
  });

  it("tileFromScreen returns null outside the grid", () => {
    const vp = initialViewport(container, GW, GH);
    const r = tileScreenRect(vp, 0, 0);
    // Just left of tile 0's left edge → outside.
    expect(tileFromScreen(vp, r.sx - r.size, r.sy + r.size / 2, GW, GH)).toBeNull();
    // Past the far corner.
    const far = tileScreenRect(vp, GW - 1, GH - 1);
    expect(tileFromScreen(vp, far.sx + far.size * 2, far.sy + far.size / 2, GW, GH)).toBeNull();
  });
});

describe("viewport — zoomAt keeps the focal world-point fixed", () => {
  it("the tile under the cursor stays under the cursor after zooming in", () => {
    const vp: Viewport = { zoom: 1, panX: -200, panY: -100 };
    const focalX = 640, focalY = 360;
    const before = tileFromScreen(vp, focalX, focalY, GW, GH);
    const zoomed = zoomAt(vp, focalX, focalY, 2.0);
    const after = tileFromScreen(zoomed, focalX, focalY, GW, GH);
    expect(after).toEqual(before);
    expect(zoomed.zoom).toBe(2.0);
  });

  it("the exact world point under the focal is invariant", () => {
    const vp: Viewport = { zoom: 0.8, panX: 50, panY: 30 };
    const fx = 500, fy = 300;
    const worldBefore = { x: (fx - vp.panX) / vp.zoom, y: (fy - vp.panY) / vp.zoom };
    const z = zoomAt(vp, fx, fy, 1.9);
    const worldAfter = { x: (fx - z.panX) / z.zoom, y: (fy - z.panY) / z.zoom };
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 6);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 6);
  });
});

describe("viewport — clampPan", () => {
  it("centres when the world is smaller than the container (fit zoom)", () => {
    const vp = { ...initialViewport(container, GW, GH), panX: 9999, panY: -9999 };
    const c = clampPan(vp, container, GW, GH);
    const centred = centeredPan(container, GW, GH, vp.zoom);
    expect(c.panX).toBeCloseTo(centred.panX, 6);
    expect(c.panY).toBeCloseTo(centred.panY, 6);
  });

  it("pins edges (no gap past an edge) when zoomed in beyond the container", () => {
    const zoom = 2.5; // world larger than the container
    const ws = worldScreenSize(GW, GH, zoom);
    expect(ws.w).toBeGreaterThan(container.w);
    // Try to over-pan right (panX too positive) → clamps to 0 (left edge pinned).
    expect(clampPan({ zoom, panX: 500, panY: 0 }, container, GW, GH).panX).toBe(0);
    // Over-pan left → clamps so the right edge stays at the container's right.
    expect(clampPan({ zoom, panX: -99999, panY: 0 }, container, GW, GH).panX).toBe(container.w - ws.w);
  });
});

describe("viewport — visibleTileRange (culling)", () => {
  it("covers the whole grid at fit zoom", () => {
    const vp = initialViewport(container, GW, GH);
    const r = visibleTileRange(vp, container, GW, GH);
    expect(r.x0).toBe(0);
    expect(r.y0).toBe(0);
    expect(r.x1).toBe(GW - 1);
    expect(r.y1).toBe(GH - 1);
  });

  it("narrows to a sub-range when zoomed in", () => {
    const vp: Viewport = { zoom: 2.5, panX: -1000, panY: -600 };
    const r = visibleTileRange(vp, container, GW, GH);
    expect(r.x1 - r.x0).toBeLessThan(GW - 1);
    expect(r.y1 - r.y0).toBeLessThan(GH - 1);
    expect(r.x0).toBeGreaterThanOrEqual(0);
    expect(r.x1).toBeLessThanOrEqual(GW - 1);
  });

  it("TILE_PX is a positive base size", () => {
    expect(TILE_PX).toBeGreaterThan(0);
  });
});
