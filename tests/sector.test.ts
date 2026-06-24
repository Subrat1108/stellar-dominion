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
  TAU_CETI_HYG_ID,
  YZ_CETI_HYG_ID,
  LUYTEN_726_8_HYG_ID,
  EPSILON_ERIDANI_HYG_ID,
} from "../src/sim/data/sector.ts";
import {
  sectorScenePosition,
  sceneDistanceToLy,
  nextMapTier,
  SYSTEM_TO_SECTOR_DIST,
  SECTOR_TO_SYSTEM_DIST,
} from "../src/render/sector-layout.ts";

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
