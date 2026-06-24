// Pure navigation helpers for the flight HUD target marker (exploration-polish A).
//
// No Three.js / DOM here — these are deterministic functions so they can be
// unit-tested. The renderer does the 3D projection (camera matrices) and feeds
// the resulting NDC coords into markerScreenPosition; nearestBodyId picks the
// scanner/marker target. At honest scale bodies are tiny dots, so the marker is
// what makes free-flight navigable: an on-screen reticle when the target is in
// view, or an edge chevron pointing toward it when it's off-screen / behind.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Nearest body to the ship by Euclidean distance, or null if there are none. */
export function nearestBodyId(
  bodies: Iterable<readonly [number, Vec3]>,
  ship: Vec3,
): { id: number; dist: number } | null {
  let best: { id: number; dist: number } | null = null;
  for (const [id, p] of bodies) {
    const d = Math.hypot(ship.x - p.x, ship.y - p.y, ship.z - p.z);
    if (best === null || d < best.dist) best = { id, dist: d };
  }
  return best;
}

export interface MarkerPlacement {
  /** Pixel position (top-left origin) for the marker centre. */
  x: number;
  y: number;
  /** True when the target is off-screen/behind → render an edge chevron. */
  offscreen: boolean;
  /** Chevron rotation (radians, screen space, 0 = pointing +x). 0 when on-screen. */
  angle: number;
}

/**
 * Place the marker from a target's normalised device coords. When the target is
 * in front and within the [-1,1] NDC box it sits on the body; otherwise it is
 * clamped to the viewport edge (inset by `marginPx`) and angled toward the body.
 * `behind` (target behind the camera) flips the direction so the chevron still
 * points the correct way.
 */
export function markerScreenPosition(
  ndcX: number,
  ndcY: number,
  behind: boolean,
  width: number,
  height: number,
  marginPx: number,
): MarkerPlacement {
  const onScreen = !behind && Math.abs(ndcX) <= 1 && Math.abs(ndcY) <= 1;
  if (onScreen) {
    return {
      x: (ndcX * 0.5 + 0.5) * width,
      y: (1 - (ndcY * 0.5 + 0.5)) * height,
      offscreen: false,
      angle: 0,
    };
  }

  // Off-screen: take the direction from screen centre, flipping if behind.
  let nx = ndcX;
  let ny = ndcY;
  if (behind) {
    nx = -nx;
    ny = -ny;
  }
  let dx = nx;
  let dy = -ny; // NDC y is up; pixel y is down
  if (dx === 0 && dy === 0) dy = -1; // degenerate → point up
  const len = Math.hypot(dx, dy);
  dx /= len;
  dy /= len;

  const cx = width / 2;
  const cy = height / 2;
  const maxX = cx - marginPx;
  const maxY = cy - marginPx;
  // Scale the unit direction out to whichever rect edge it hits first.
  const sx = dx !== 0 ? maxX / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? maxY / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);

  return {
    x: cx + dx * s,
    y: cy + dy * s,
    offscreen: true,
    angle: Math.atan2(dy, dx),
  };
}
