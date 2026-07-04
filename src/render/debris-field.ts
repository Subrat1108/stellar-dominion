// Instanced debris fields — Saturn-style planetary rings + a Kuiper belt.
//
// Render-only decoration (no sim entities, no collision): dense fields of small
// icy/rocky chunks you can fly THROUGH, sized far larger than the ship avatar
// (~0.000015 u) but far smaller than a planet — this is what sells the sense of
// scale (Polish B feedback). One InstancedMesh per field → one draw call, cheap
// on integrated GPUs. Placement is DETERMINISTIC from a seeded PRNG (a local
// mulberry32, NEVER the sim RNG — the renderer must not perturb sim determinism).

import * as THREE from "three";
import type { CelestialBody } from "../sim/ecs/components.ts";
import { xxHashString } from "../sim/gen/hash.ts";

/** Small, fast, seedable PRNG (mulberry32). Render-only. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Chunk sizes (scene units): bigger than the ship (0.000015 u) so you fly AMONG
// them, far smaller than a planet. Ring ice is smaller; belt bodies run larger
// (small asteroids / dwarf bodies), so the ship is "smaller than a small asteroid".
const RING_CHUNK_MIN = 0.00004;
const RING_CHUNK_MAX = 0.00018;
const BELT_CHUNK_MIN = 0.00012;
const BELT_CHUNK_MAX = 0.0009;

function iceMaterial(): THREE.MeshStandardMaterial {
  // Fresh per field so disposeMesh() can dispose it safely on a system rebuild.
  return new THREE.MeshStandardMaterial({
    color: 0xbcd4e6,
    roughness: 0.85,
    metalness: 0.04,
    flatShading: true,
    emissive: new THREE.Color(0x0a1420), // faint, so distant chunks aren't pure black
  });
}

function rockMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x8a7f6c,
    roughness: 0.96,
    metalness: 0.02,
    flatShading: true,
    emissive: new THREE.Color(0x0c0a08),
  });
}

/** Scatter `count` chunks into an InstancedMesh via a per-instance callback that
 *  fills a position (area-uniform annulus is up to the caller). */
function scatter(
  count: number,
  material: THREE.Material,
  rng: () => number,
  place: (rng: () => number, pos: THREE.Vector3) => number, // returns chunk size
): THREE.InstancedMesh {
  const geo = new THREE.IcosahedronGeometry(1, 0); // unit; scaled per instance
  const mesh = new THREE.InstancedMesh(geo, material, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const s = place(rng, pos);
    // Irregular lumps: independent per-axis scale.
    scl.set(s * (0.5 + rng()), s * (0.5 + rng()), s * (0.5 + rng()));
    e.set(rng() * 6.283, rng() * 6.283, rng() * 6.283);
    q.setFromEuler(e);
    m.compose(pos, q, scl);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false; // the field spans the body; per-instance cull is moot
  return mesh;
}

/**
 * Icy ring disc for a gas giant, in the body's LOCAL space — add it as a CHILD of
 * the body mesh so it follows the planet as it orbits. Chunks fill a thin annulus
 * at 1.5–2.6 R in the equatorial (XZ) plane.
 */
export function buildGasGiantRing(body: CelestialBody): THREE.InstancedMesh {
  const rng = mulberry32(xxHashString((body.bodyKey ?? body.name) + ":ring"));
  const R = body.renderRadius;
  const inner = R * 1.5;
  const outer = R * 2.6;
  const thickness = R * 0.03; // thin disc
  return scatter(2600, iceMaterial(), rng, (r, pos) => {
    const rad = Math.sqrt(inner * inner + r() * (outer * outer - inner * inner)); // area-uniform
    const ang = r() * Math.PI * 2;
    pos.set(Math.cos(ang) * rad, (r() - 0.5) * thickness, Math.sin(ang) * rad);
    return RING_CHUNK_MIN + (RING_CHUNK_MAX - RING_CHUNK_MIN) * r();
  });
}

/**
 * Kuiper belt: a scattered torus of icy/rocky bodies at the system's outer edge,
 * in WORLD (heliocentric) space — add it to worldRoot. `maxOrbitRadius` is the
 * outermost planet's scene-unit orbit; the belt sits just beyond it.
 */
export function buildKuiperBelt(maxOrbitRadius: number, systemSeed: string): THREE.Group {
  const group = new THREE.Group();
  const rng = mulberry32(xxHashString(systemSeed + ":kuiper"));
  const inner = maxOrbitRadius * 1.2;
  const outer = maxOrbitRadius * 1.7;
  const thickness = maxOrbitRadius * 0.06;
  const ice = scatter(4200, iceMaterial(), rng, (r, pos) => {
    const rad = Math.sqrt(inner * inner + r() * (outer * outer - inner * inner));
    const ang = r() * Math.PI * 2;
    pos.set(Math.cos(ang) * rad, (r() - 0.5) * thickness, Math.sin(ang) * rad);
    return BELT_CHUNK_MIN + (BELT_CHUNK_MAX - BELT_CHUNK_MIN) * r();
  });
  const rock = scatter(1400, rockMaterial(), rng, (r, pos) => {
    const rad = Math.sqrt(inner * inner + r() * (outer * outer - inner * inner));
    const ang = r() * Math.PI * 2;
    pos.set(Math.cos(ang) * rad, (r() - 0.5) * thickness, Math.sin(ang) * rad);
    return BELT_CHUNK_MIN + (BELT_CHUNK_MAX - BELT_CHUNK_MIN) * r();
  });
  group.add(ice, rock);
  return group;
}
