// Galaxy scaffold scene (Exploration Polish C) — the two outermost, LOCKED map
// tiers rendered as one static Three.js scene. Cheap: a handful of billboard-ish
// spheres + halos; labels/interaction are the DOM overlay (MapView), which reads
// the node screen positions the renderer projects from getNodes(tier).
//
// Non-explorable scaffold only (docs/09 2026-07-07): clicking a node opens a
// LOCKED card, never an action. Both tiers live in one scene; the active tier
// only changes which node set is projected + the camera framing distance.

import * as THREE from "three";
import { GALACTIC_NODES, INTERGALACTIC_NODES, type GalaxyNode } from "../sim/data/galaxies.ts";

export interface GalaxyNodeHandle {
  id: string;
  node: GalaxyNode;
  position: THREE.Vector3;
  colorHex: string;
}

export interface GalaxyScene {
  scene: THREE.Scene;
  /** Node handles for the given tier, for label projection. */
  getNodes(tier: "galactic" | "intergalactic"): GalaxyNodeHandle[];
  dispose(): void;
}

function buildTierGroup(
  nodes: readonly GalaxyNode[],
  radius: number,
  track: <T extends THREE.BufferGeometry | THREE.Material>(x: T) => T,
): { group: THREE.Group; handles: GalaxyNodeHandle[] } {
  const group = new THREE.Group();
  const handles: GalaxyNodeHandle[] = [];
  for (const node of nodes) {
    const pos = new THREE.Vector3(node.x, node.y, node.z);
    const color = new THREE.Color(node.color);
    const mesh = new THREE.Mesh(
      track(new THREE.SphereGeometry(radius, 20, 14)),
      track(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })),
    );
    mesh.position.copy(pos);
    mesh.name = node.name;
    group.add(mesh);
    group.add(
      new THREE.Mesh(
        track(new THREE.SphereGeometry(radius * 1.7, 20, 14)),
        track(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1 })),
      ).translateX(pos.x).translateY(pos.y).translateZ(pos.z),
    );
    handles.push({ id: node.id, node, position: pos, colorHex: node.color });
  }
  return { group, handles };
}

export function buildGalaxyScene(): GalaxyScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020308);
  scene.add(new THREE.AmbientLight(0xffffff, 1.0));

  const disposables: { dispose(): void }[] = [];
  const track = <T extends THREE.BufferGeometry | THREE.Material>(x: T): T => { disposables.push(x); return x; };

  const galactic = buildTierGroup(GALACTIC_NODES, 120, track);
  const intergalactic = buildTierGroup(INTERGALACTIC_NODES, 380, track);
  intergalactic.group.visible = false;
  scene.add(galactic.group, intergalactic.group);

  return {
    scene,
    getNodes(tier) {
      // Show only the active tier's group so the two scales don't overlap.
      galactic.group.visible = tier === "galactic";
      intergalactic.group.visible = tier === "intergalactic";
      return tier === "galactic" ? galactic.handles : intergalactic.handles;
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
