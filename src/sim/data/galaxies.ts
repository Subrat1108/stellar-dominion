// LOCKED galaxy scaffold (Exploration Polish C) — the two outermost map tiers.
//
// Pure data only: the galactic + intergalactic tiers of the unified map are a
// non-explorable SCAFFOLD (decision docs/09 2026-07-07). They exist so the zoom
// continuum reaches all the way out and the ambition reads on-screen, but they
// carry NO gameplay — clicking a node shows a LOCKED card, never an action. Real
// galaxy/universe CONTENT is explicitly out of scope for this slice.
//
// Positions are authored directly in each tier's scene units (the galaxy scene
// frames the galactic set at ~2500 u and the intergalactic set at ~9000 u); the
// directions are roughly plausible, the distances are the real headline figures
// shown as flavour. Nothing here is physically simulated.

export interface GalaxyNode {
  id: string;
  name: string;
  /** Short type line under the name (e.g. "Barred spiral · home"). */
  typeLabel: string;
  tier: "galactic" | "intergalactic";
  /** Longer flavour shown in the LOCKED popup. */
  description: string;
  /** CSS hex for the node dot. */
  color: string;
  /** Position in the galaxy scene (that tier's units). */
  x: number;
  y: number;
  z: number;
}

// Galactic tier — the Milky Way (home) + a few Local-Group galaxies.
export const GALACTIC_NODES: readonly GalaxyNode[] = [
  { id: "gx:milkyway", name: "Milky Way", typeLabel: "Barred spiral · you are here", tier: "galactic",
    description: "The home galaxy. Everything reachable this era — Tau Ceti and its neighbours — lies within a tiny bubble around one of its outer spiral arms.",
    color: "#cdd6f4", x: 0, y: 0, z: 0 },
  { id: "gx:andromeda", name: "Andromeda (M31)", typeLabel: "Spiral · 2.5 Mly", tier: "galactic",
    description: "The nearest large spiral galaxy, on a slow collision course with the Milky Way. Locked — intergalactic travel is far beyond this era.",
    color: "#89b4fa", x: 1800, y: 220, z: -700 },
  { id: "gx:triangulum", name: "Triangulum (M33)", typeLabel: "Spiral · 2.7 Mly", tier: "galactic",
    description: "The third-largest Local Group galaxy. A locked scaffold node — no destinations here yet.",
    color: "#94e2d5", x: -1550, y: -320, z: 850 },
  { id: "gx:lmc", name: "Large Magellanic Cloud", typeLabel: "Dwarf · 0.16 Mly", tier: "galactic",
    description: "A satellite dwarf galaxy of the Milky Way, a naked-eye smudge from the southern sky. Locked.",
    color: "#f9e2af", x: 650, y: -900, z: 420 },
  { id: "gx:smc", name: "Small Magellanic Cloud", typeLabel: "Dwarf · 0.20 Mly", tier: "galactic",
    description: "The smaller Magellanic satellite. Locked scaffold.",
    color: "#fab387", x: 980, y: -720, z: 720 },
];

// Intergalactic tier — the Local Group + a couple of clusters / superclusters.
export const INTERGALACTIC_NODES: readonly GalaxyNode[] = [
  { id: "ig:localgroup", name: "Local Group", typeLabel: "Galaxy group · you are here", tier: "intergalactic",
    description: "The ~80-galaxy group the Milky Way belongs to, ~10 Mly across. The outer edge of the scaffold — nothing beyond is explorable.",
    color: "#cdd6f4", x: 0, y: 0, z: 0 },
  { id: "ig:virgo", name: "Virgo Cluster", typeLabel: "Galaxy cluster · ~54 Mly", tier: "intergalactic",
    description: "The heart of the Local Supercluster, ~1300 galaxies. Locked.",
    color: "#89b4fa", x: 5200, y: 900, z: -3100 },
  { id: "ig:fornax", name: "Fornax Cluster", typeLabel: "Galaxy cluster · ~62 Mly", tier: "intergalactic",
    description: "A rich southern galaxy cluster. Locked scaffold node.",
    color: "#94e2d5", x: -4600, y: -1200, z: 2600 },
  { id: "ig:laniakea", name: "Laniakea", typeLabel: "Supercluster · ~500 Mly", tier: "intergalactic",
    description: "The supercluster the Local Group drifts within, its galaxies streaming toward the Great Attractor. The furthest the map can conceive of — purely a horizon.",
    color: "#cba6f7", x: 2800, y: 6800, z: 4200 },
];

/** All scaffold nodes (both tiers), for popup lookup by id. */
export const ALL_GALAXY_NODES: readonly GalaxyNode[] = [...GALACTIC_NODES, ...INTERGALACTIC_NODES];

export function galaxyNodeById(id: string): GalaxyNode | undefined {
  return ALL_GALAXY_NODES.find((n) => n.id === id);
}
