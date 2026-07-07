// Sector-map scene (docs/12 Tier 1) — a dedicated Three.js scene, separate from
// the in-system view, showing the local stellar neighbourhood.
//
// Polish C: the scene is EGO-CENTRIC — centred on the ACTIVE system (not always
// home) and populated with the full reachable catalog set within range
// (reachableSectorNodes). Real catalog stars are plotted (parsec coordinates →
// sector scene units, relative to the active star). Node labels + actions live in
// the React MapView overlay, which reads the node screen positions the renderer
// projects from getNodes(). On warp the renderer disposes + rebuilds this around
// the new active star (re-centring), so it stays a snapshot of "here + reachable".

import * as THREE from "three";
import {
  reachableSectorNodes,
  hygIdFromSystemId,
  backgroundStars,
  type MapStarNode,
} from "../sim/data/sector.ts";
import { starById } from "../sim/gen/catalog.ts";
import { spectralClass, stellarTempK } from "../sim/gen/occurrence.ts";
import { starColor } from "../sim/gen/archetype.ts";
import { SECTOR_SCALE_PER_PC } from "./sector-layout.ts";

const ACTIVE_RADIUS = 26;
const CURATED_RADIUS = 20;
const PLAIN_RADIUS = 15;

/** Colour for a catalog star from its spectral class. */
function colorForSpect(spect: string | null): number {
  return starColor(stellarTempK(spectralClass(spect)));
}

export interface SectorNodeHandle {
  systemId: string;
  node: MapStarNode;
  position: THREE.Vector3;
  /** CSS hex of the star's spectral colour (for the DOM label dot). */
  colorHex: string;
}

export interface SectorScene {
  scene: THREE.Scene;
  activeSystemId: string;
  /** Node handles (systemId + metadata + world position) for label projection. */
  getNodes(): SectorNodeHandle[];
  dispose(): void;
}

export function buildSectorScene(activeSystemId: string): SectorScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03040a);
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));

  const activeHyg = hygIdFromSystemId(activeSystemId);
  const originStar = (activeHyg !== undefined ? starById(activeHyg) : undefined);
  const ox = originStar?.x ?? 0, oy = originStar?.y ?? 0, oz = originStar?.z ?? 0;

  const disposables: { dispose(): void }[] = [];
  const track = <T extends THREE.BufferGeometry | THREE.Material>(x: T): T => { disposables.push(x); return x; };

  // Faint background field: every catalog star, positioned relative to the active
  // star, so the neighbourhood reads as a real place even beyond warp range.
  const bg = backgroundStars();
  const positions = new Float32Array(bg.length * 3);
  for (let i = 0; i < bg.length; i++) {
    positions[i * 3]     = (bg[i]!.x - ox) * SECTOR_SCALE_PER_PC;
    positions[i * 3 + 1] = (bg[i]!.y - oy) * SECTOR_SCALE_PER_PC;
    positions[i * 3 + 2] = (bg[i]!.z - oz) * SECTOR_SCALE_PER_PC;
  }
  const bgGeo = track(new THREE.BufferGeometry());
  bgGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  scene.add(new THREE.Points(bgGeo, track(new THREE.PointsMaterial({ color: 0x4a4f6a, size: 3, sizeAttenuation: false }))));

  // Reachable nodes (active system + neighbours in range), plotted ego-centrically.
  const handles: SectorNodeHandle[] = [];
  for (const node of reachableSectorNodes(activeSystemId)) {
    const pos = new THREE.Vector3(
      (node.star.x - ox) * SECTOR_SCALE_PER_PC,
      (node.star.y - oy) * SECTOR_SCALE_PER_PC,
      (node.star.z - oz) * SECTOR_SCALE_PER_PC,
    );
    const isActive = node.systemId === activeSystemId;
    const color = colorForSpect(node.star.spect);
    handles.push({
      systemId: node.systemId, node, position: pos,
      colorHex: "#" + color.toString(16).padStart(6, "0"),
    });

    const radius = isActive ? ACTIVE_RADIUS : node.curated ? CURATED_RADIUS : PLAIN_RADIUS;
    const mesh = new THREE.Mesh(
      track(new THREE.SphereGeometry(radius, 20, 14)),
      track(new THREE.MeshBasicMaterial({ color })),
    );
    mesh.position.copy(pos);
    mesh.name = node.name;
    scene.add(mesh);

    // Soft halo so nodes read as live destinations.
    scene.add(
      new THREE.Mesh(
        track(new THREE.SphereGeometry(radius * 1.6, 20, 14)),
        track(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12 })),
      ).translateX(pos.x).translateY(pos.y).translateZ(pos.z),
    );
  }

  // "You are here" ring at the origin (the active system).
  const activeRing = new THREE.Mesh(
    track(new THREE.RingGeometry(34, 38, 32)),
    track(new THREE.MeshBasicMaterial({ color: 0x89b4fa, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })),
  );
  scene.add(activeRing);

  return {
    scene,
    activeSystemId,
    getNodes: () => handles,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
