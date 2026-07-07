// Tests for the Step 1B sector neighbourhood (docs/12): the curated star table,
// catalog-honest inter-star distances, and the pure sector-map geometry + the
// hysteretic system↔sector zoom-tier logic. Headless — no renderer/DOM.

import { describe, it, expect } from "vitest";
import {
  SECTOR_STARS,
  sectorNodes,
  homeNode,
  systemIdFor,
  hygIdFromSystemId,
  distanceLyById,
  reachableSectorNodes,
  isWarpReachable,
  WARP_RANGE_LY,
  MAX_MAP_NODES,
  TAU_CETI_HYG_ID,
  YZ_CETI_HYG_ID,
  LUYTEN_726_8_HYG_ID,
  EPSILON_ERIDANI_HYG_ID,
} from "../src/sim/data/sector.ts";
import { transitTicksForLy, TRANSIT_TICKS, TRANSIT_TICKS_MAX } from "../src/sim/systems/warp.ts";
import {
  sectorScenePosition,
  sceneDistanceToLy,
  nextMapTier,
  tierDefaultCamDist,
  TIER_ORDER,
  SYSTEM_TO_SECTOR_DIST,
  SECTOR_TO_SYSTEM_DIST,
} from "../src/render/sector-layout.ts";
import { GALACTIC_NODES, INTERGALACTIC_NODES, galaxyNodeById } from "../src/sim/data/galaxies.ts";

describe("sector neighbourhood table", () => {
  it("has Tau Ceti (home), YZ Ceti + Luyten 726-8 (reachable), Epsilon Eridani (locked)", () => {
    const byId = new Map(SECTOR_STARS.map((s) => [s.hygId, s]));
    expect(byId.get(TAU_CETI_HYG_ID)!.role).toBe("home");
    expect(byId.get(YZ_CETI_HYG_ID)!.role).toBe("reachable");
    expect(byId.get(LUYTEN_726_8_HYG_ID)!.role).toBe("reachable");
    expect(byId.get(EPSILON_ERIDANI_HYG_ID)!.role).toBe("locked");
  });

  it("resolves every curated star against the bundled catalog", () => {
    expect(sectorNodes().length).toBe(SECTOR_STARS.length);
    expect(homeNode().def.hygId).toBe(TAU_CETI_HYG_ID);
  });

  it("round-trips systemId ↔ hygId", () => {
    expect(systemIdFor(YZ_CETI_HYG_ID)).toBe("hyg:5632");
    expect(hygIdFromSystemId("hyg:5632")).toBe(YZ_CETI_HYG_ID);
    expect(hygIdFromSystemId("nonsense")).toBeUndefined();
  });
});

describe("catalog-honest distances (verified against HYG)", () => {
  it("Tau Ceti → YZ Ceti ≈ 1.60 ly", () => {
    expect(distanceLyById(TAU_CETI_HYG_ID, YZ_CETI_HYG_ID)).toBeCloseTo(1.60, 1);
  });

  it("Tau Ceti → Luyten 726-8 ≈ 3.36 ly (supersedes docs/12's ~3.1)", () => {
    expect(distanceLyById(TAU_CETI_HYG_ID, LUYTEN_726_8_HYG_ID)).toBeCloseTo(3.36, 1);
  });

  it("distance is symmetric and zero to self", () => {
    expect(distanceLyById(TAU_CETI_HYG_ID, YZ_CETI_HYG_ID)).toBeCloseTo(
      distanceLyById(YZ_CETI_HYG_ID, TAU_CETI_HYG_ID),
      6,
    );
    expect(distanceLyById(TAU_CETI_HYG_ID, TAU_CETI_HYG_ID)).toBe(0);
  });
});

describe("sector scene geometry", () => {
  const nodes = sectorNodes();
  const home = homeNode();
  const yz = nodes.find((n) => n.def.hygId === YZ_CETI_HYG_ID)!;

  it("places the home star at the scene origin", () => {
    const p = sectorScenePosition(home, home);
    expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(0, 6);
  });

  it("preserves real geometry: scene separation maps back to the catalog ly", () => {
    const p = sectorScenePosition(yz, home);
    const sceneDist = Math.hypot(p.x, p.y, p.z);
    expect(sceneDistanceToLy(sceneDist)).toBeCloseTo(
      distanceLyById(TAU_CETI_HYG_ID, YZ_CETI_HYG_ID),
      4,
    );
  });
});

describe("zoom-tier hysteresis", () => {
  it("stays in-system until zoomed past the enter threshold", () => {
    expect(nextMapTier("system", SYSTEM_TO_SECTOR_DIST - 1)).toBe("system");
    expect(nextMapTier("system", SYSTEM_TO_SECTOR_DIST + 1)).toBe("sector");
  });

  it("stays in sector until zoomed back in past the exit threshold", () => {
    expect(nextMapTier("sector", SECTOR_TO_SYSTEM_DIST + 1)).toBe("sector");
    expect(nextMapTier("sector", SECTOR_TO_SYSTEM_DIST - 1)).toBe("system");
  });

  it("the enter/exit thresholds leave a gap (no flapping at the boundary)", () => {
    expect(SYSTEM_TO_SECTOR_DIST).toBeGreaterThan(SECTOR_TO_SYSTEM_DIST);
  });
});

describe("full zoom continuum (intra → intergalactic)", () => {
  it("has all five tiers, inner → outer", () => {
    expect(TIER_ORDER).toEqual(["intra", "system", "sector", "galactic", "intergalactic"]);
  });

  it("flips one step at each boundary, with hysteresis", () => {
    // intra ↔ system
    expect(nextMapTier("intra", 100)).toBe("intra");
    expect(nextMapTier("intra", 200)).toBe("system");
    expect(nextMapTier("system", 100)).toBe("intra");
    // sector ↔ galactic
    expect(nextMapTier("sector", 5000)).toBe("galactic");
    expect(nextMapTier("galactic", 300)).toBe("sector");
    // galactic ↔ intergalactic
    expect(nextMapTier("galactic", 15000)).toBe("intergalactic");
    expect(nextMapTier("intergalactic", 1000)).toBe("galactic");
  });

  it("only ever moves ONE tier per call, even far past a threshold", () => {
    expect(nextMapTier("intra", 999999)).toBe("system"); // not straight to sector
    expect(nextMapTier("intergalactic", 0)).toBe("galactic"); // not straight to sector
  });

  it("each tier has a positive default framing distance", () => {
    // Not monotonic across tiers — each tier frames its own content scale (the
    // sector nodes are tighter than the system span, so its default is smaller).
    for (const tier of TIER_ORDER) expect(tierDefaultCamDist(tier)).toBeGreaterThan(0);
  });
});

describe("LOCKED galaxy scaffold", () => {
  it("galactic tier has the Milky Way (home) + named galaxies", () => {
    const ids = GALACTIC_NODES.map((n) => n.id);
    expect(ids).toContain("gx:milkyway");
    expect(GALACTIC_NODES.length).toBeGreaterThanOrEqual(3);
    expect(GALACTIC_NODES.every((n) => n.tier === "galactic")).toBe(true);
  });

  it("intergalactic tier has the Local Group + clusters", () => {
    const ids = INTERGALACTIC_NODES.map((n) => n.id);
    expect(ids).toContain("ig:localgroup");
    expect(INTERGALACTIC_NODES.every((n) => n.tier === "intergalactic")).toBe(true);
  });

  it("looks up any scaffold node by id", () => {
    expect(galaxyNodeById("gx:andromeda")?.name).toBe("Andromeda (M31)");
    expect(galaxyNodeById("nope")).toBeUndefined();
  });
});

describe("distance-based reachability (Polish C, ungated)", () => {
  const TAU = systemIdFor(TAU_CETI_HYG_ID);
  const YZ = systemIdFor(YZ_CETI_HYG_ID);

  it("nearby stars are reachable; a star is never reachable from itself", () => {
    expect(isWarpReachable(TAU, YZ)).toBe(true); // 1.60 ly ≤ WARP_RANGE_LY
    expect(isWarpReachable(TAU, TAU)).toBe(false);
  });

  it("reachability is exactly the WARP_RANGE_LY distance test", () => {
    for (const node of reachableSectorNodes(TAU)) {
      if (node.systemId === TAU) continue;
      expect(node.distanceLy).toBeLessThanOrEqual(WARP_RANGE_LY);
      expect(isWarpReachable(TAU, node.systemId)).toBe(true);
    }
  });

  it("return-home is reachable from a neighbour (the bug was a UI gate)", () => {
    expect(isWarpReachable(YZ, TAU)).toBe(true);
  });
});

describe("ego-centric sector node placement", () => {
  const TAU = systemIdFor(TAU_CETI_HYG_ID);

  it("centres on the active system (distance 0, listed first) and caps the count", () => {
    const nodes = reachableSectorNodes(TAU);
    expect(nodes.length).toBeGreaterThan(1);
    expect(nodes.length).toBeLessThanOrEqual(MAX_MAP_NODES);
    expect(nodes[0]!.systemId).toBe(TAU);
    expect(nodes[0]!.distanceLy).toBe(0);
  });

  it("is sorted nearest-first and deterministic", () => {
    const nodes = reachableSectorNodes(TAU);
    for (let i = 1; i < nodes.length; i++) {
      expect(nodes[i]!.distanceLy).toBeGreaterThanOrEqual(nodes[i - 1]!.distanceLy);
    }
    // Same input → identical ordering (catalog is fixed-order; ties break on id).
    expect(reachableSectorNodes(TAU).map((n) => n.systemId)).toEqual(nodes.map((n) => n.systemId));
  });

  it("re-centres when the active system changes (ego-centric)", () => {
    const yz = systemIdFor(YZ_CETI_HYG_ID);
    expect(reachableSectorNodes(yz)[0]!.systemId).toBe(yz);
  });

  it("includes YZ Ceti among Tau Ceti's reachable neighbours", () => {
    const ids = reachableSectorNodes(TAU).map((n) => n.systemId);
    expect(ids).toContain(systemIdFor(YZ_CETI_HYG_ID));
  });
});

describe("distance-proportional transit duration", () => {
  it("is monotonic in distance and never below the base", () => {
    expect(transitTicksForLy(0)).toBe(TRANSIT_TICKS);
    expect(transitTicksForLy(2)).toBeGreaterThan(transitTicksForLy(1));
    expect(transitTicksForLy(-5)).toBe(TRANSIT_TICKS); // clamped
  });

  it("clamps very long hops to the maximum", () => {
    expect(transitTicksForLy(10_000)).toBe(TRANSIT_TICKS_MAX);
  });

  it("a farther system takes longer than a nearer one", () => {
    const near = distanceLyById(TAU_CETI_HYG_ID, YZ_CETI_HYG_ID);
    const far = distanceLyById(TAU_CETI_HYG_ID, LUYTEN_726_8_HYG_ID);
    expect(far).toBeGreaterThan(near);
    expect(transitTicksForLy(far)).toBeGreaterThan(transitTicksForLy(near));
  });
});
