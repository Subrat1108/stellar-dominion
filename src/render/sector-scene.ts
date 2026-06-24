// Sector-map scene (docs/12 Tier 1) — a dedicated Three.js scene, separate from
// the in-system view, showing the local stellar neighbourhood.
//
// Real catalog stars are plotted (parsec coordinates → sector scene units,
// centred on the home star). The curated nodes (sector.ts) are drawn as
// colour-coded spheres sized by role; every other catalog star is a faint,
// non-interactive background point. Node labels + actions live in the React
// SectorPanel (cheap; no 3D text). Entered/left by an eased zoom cross-fade
// driven in scene.ts; this module just builds the static graph.

import * as THREE from "three";
import { sectorNodes, homeNode, backgroundStars } from "../sim/data/sector.ts";
import { spectralClass, stellarTempK } from "../sim/gen/occurrence.ts";
import { starColor } from "../sim/gen/archetype.ts";
import { SECTOR_SCALE_PER_PC, sectorScenePosition } from "./sector-layout.ts";

const ROLE_RADIUS = { home: 26, reachable: 20, locked: 14 } as const;

/** Colour for a catalog star from its spectral class. */
function colorForSpect(spect: string | null): number {
  return starColor(stellarTempK(spectralClass(spect)));
}

export interface SectorScene {
  scene: THREE.Scene;
  /** Highlight ring tracking the active (current) system; updated by scene.ts. */
  setActiveSystem(systemId: string): void;
}

export function buildSectorScene(activeSystemId: string): SectorScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03040a);
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));

  const origin = homeNode();

  // Faint background field: every catalog star, positioned relative to home.
  const bg = backgroundStars();
  const positions = new Float32Array(bg.length * 3);
  for (let i = 0; i < bg.length; i++) {
    positions[i * 3] = (bg[i]!.x - origin.star.x) * SECTOR_SCALE_PER_PC;
    positions[i * 3 + 1] = (bg[i]!.y - origin.star.y) * SECTOR_SCALE_PER_PC;
    positions[i * 3 + 2] = (bg[i]!.z - origin.star.z) * SECTOR_SCALE_PER_PC;
  }
  const bgGeo = new THREE.BufferGeometry();
  bgGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  scene.add(
    new THREE.Points(
      bgGeo,
      new THREE.PointsMaterial({ color: 0x4a4f6a, size: 3, sizeAttenuation: false }),
    ),
  );

  // Curated nodes (interactive set + locked Epsilon Eridani).
  const nodePositions = new Map<string, THREE.Vector3>();
  for (const node of sectorNodes()) {
    const p = sectorScenePosition(node, origin);
    const pos = new THREE.Vector3(p.x, p.y, p.z);
    nodePositions.set(node.systemId, pos);

    const color = colorForSpect(node.star.spect);
    const radius = ROLE_RADIUS[node.def.role];
    const dim = node.def.role === "locked";
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 20, 14),
      new THREE.MeshBasicMaterial({ color, transparent: dim, opacity: dim ? 0.4 : 1 }),
    );
    mesh.position.copy(pos);
    mesh.name = node.def.name;
    scene.add(mesh);

    // Soft halo for reachable/home nodes so they read as live destinations.
    if (!dim) {
      scene.add(
        new THREE.Mesh(
          new THREE.SphereGeometry(radius * 1.6, 20, 14),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12 }),
        ).translateX(pos.x).translateY(pos.y).translateZ(pos.z),
      );
    }
  }

  // "You are here" ring around the active node (billboarded each frame elsewhere).
  const activeRing = new THREE.Mesh(
    new THREE.RingGeometry(34, 38, 32),
    new THREE.MeshBasicMaterial({ color: 0x89b4fa, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
  );
  scene.add(activeRing);

  function setActiveSystem(systemId: string): void {
    const pos = nodePositions.get(systemId) ?? nodePositions.get(homeNode().systemId)!;
    activeRing.position.copy(pos);
    activeRing.visible = !!pos;
  }
  setActiveSystem(activeSystemId);

  return { scene, setActiveSystem };
}
