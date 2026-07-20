// Surface-map viewport math (Slice 1, docs/17) — PURE pan/zoom transforms for the
// full-screen canvas surface map. No DOM/canvas here: the SurfaceMap component
// owns the canvas + interaction; this owns the screen↔tile arithmetic so it is
// unit-tested (the transforms are where the subtle bugs hide — zoom-to-cursor,
// pan clamping, pixel→tile under zoom).
//
// Coordinate model:
//   world units: tile (x,y) occupies the world rect [x·TILE_PX, y·TILE_PX] of
//                size TILE_PX (before zoom).
//   screen px:   screen = world · zoom + pan.
//   so world  = (screen − pan) / zoom, and tile = floor(world / TILE_PX).

import type { TileCoord } from "../../sim/gen/surface.ts";

/** Base world-pixels per tile, before zoom. Zoom scales this. */
export const TILE_PX = 24;

export interface Viewport {
  /** Screen-px per world-px (whole-map fit ≈ minZoom; larger = zoomed in). */
  zoom: number;
  /** Screen-px offset of world origin (the top-left corner of tile 0,0). */
  panX: number;
  panY: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface ZoomBounds {
  min: number;
  max: number;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Scaled screen size of the whole world at a given zoom. */
export function worldScreenSize(gridW: number, gridH: number, zoom: number): Size {
  return { w: gridW * TILE_PX * zoom, h: gridH * TILE_PX * zoom };
}

/** Zoom that exactly fits the whole grid inside the container (whole-map view). */
export function fitZoom(container: Size, gridW: number, gridH: number): number {
  if (container.w <= 0 || container.h <= 0) return 1;
  return Math.min(container.w / (gridW * TILE_PX), container.h / (gridH * TILE_PX));
}

/** Zoom range: can't zoom out past whole-map fit; can zoom in a few× for detail. */
export function zoomBounds(container: Size, gridW: number, gridH: number): ZoomBounds {
  const min = fitZoom(container, gridW, gridH);
  return { min, max: Math.max(min * 4, 2.5) };
}

/** Pan that centres the world in the container at the current zoom. */
export function centeredPan(container: Size, gridW: number, gridH: number, zoom: number): { panX: number; panY: number } {
  const ws = worldScreenSize(gridW, gridH, zoom);
  return { panX: (container.w - ws.w) / 2, panY: (container.h - ws.h) / 2 };
}

/**
 * Clamp pan so the map can't be dragged off-screen: if the world (at this zoom)
 * is smaller than the container it is centred; otherwise its edges are pinned to
 * the container edges (no empty gap past an edge).
 */
export function clampPan(vp: Viewport, container: Size, gridW: number, gridH: number): Viewport {
  const ws = worldScreenSize(gridW, gridH, vp.zoom);
  const axis = (pan: number, world: number, view: number): number =>
    world <= view ? (view - world) / 2 : clamp(pan, view - world, 0);
  return { zoom: vp.zoom, panX: axis(vp.panX, ws.w, container.w), panY: axis(vp.panY, ws.h, container.h) };
}

/** The initial viewport: whole map fit + centred. */
export function initialViewport(container: Size, gridW: number, gridH: number): Viewport {
  const zoom = fitZoom(container, gridW, gridH);
  const { panX, panY } = centeredPan(container, gridW, gridH, zoom);
  return { zoom, panX, panY };
}

/** Screen rect of a tile (top-left + edge size), for drawing/highlighting. */
export function tileScreenRect(vp: Viewport, x: number, y: number): { sx: number; sy: number; size: number } {
  const size = TILE_PX * vp.zoom;
  return { sx: x * TILE_PX * vp.zoom + vp.panX, sy: y * TILE_PX * vp.zoom + vp.panY, size };
}

/** The tile under a screen point, or null if the point is outside the grid. */
export function tileFromScreen(vp: Viewport, sx: number, sy: number, gridW: number, gridH: number): TileCoord | null {
  const x = Math.floor((sx - vp.panX) / vp.zoom / TILE_PX);
  const y = Math.floor((sy - vp.panY) / vp.zoom / TILE_PX);
  if (x < 0 || x >= gridW || y < 0 || y >= gridH) return null;
  return { x, y };
}

/**
 * Zoom to `newZoom` while keeping the world point under (focalSx, focalSy) fixed
 * on screen (zoom toward the cursor). Pure — no clamping; the caller re-clamps
 * pan + bounds. If oldZoom is degenerate, returns the viewport at newZoom.
 */
export function zoomAt(vp: Viewport, focalSx: number, focalSy: number, newZoom: number): Viewport {
  if (vp.zoom <= 0) return { zoom: newZoom, panX: vp.panX, panY: vp.panY };
  const k = newZoom / vp.zoom;
  return {
    zoom: newZoom,
    panX: focalSx - (focalSx - vp.panX) * k,
    panY: focalSy - (focalSy - vp.panY) * k,
  };
}

/**
 * Inclusive tile range visible in the container — for culling (draw only these,
 * not all 4608). Clamped to the grid.
 */
export function visibleTileRange(
  vp: Viewport,
  container: Size,
  gridW: number,
  gridH: number,
): { x0: number; y0: number; x1: number; y1: number } {
  const tx = (sx: number) => Math.floor((sx - vp.panX) / vp.zoom / TILE_PX);
  const ty = (sy: number) => Math.floor((sy - vp.panY) / vp.zoom / TILE_PX);
  return {
    x0: clamp(tx(0), 0, gridW - 1),
    y0: clamp(ty(0), 0, gridH - 1),
    x1: clamp(tx(container.w), 0, gridW - 1),
    y1: clamp(ty(container.h), 0, gridH - 1),
  };
}
