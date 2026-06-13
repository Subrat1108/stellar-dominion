// Three.js render layer for the Phase 0 static system view.
//
// Hard boundary (docs/03): the renderer READS sim state; it never mutates it and
// the sim never imports anything from here. We build one mesh per body from the
// World's Body components, then each frame copy Transform positions into meshes.
//
// Kept deliberately light for a MacBook Air integrated GPU: low-poly spheres,
// a single point light, instanced star-field points, no post-processing.

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { World } from "../sim/ecs/world.ts";
import { positionAt } from "../sim/math/kepler.ts";

export interface Renderer {
  /** Sync mesh positions from the world's current Transform state. */
  sync(world: World): void;
  /** Draw one frame. */
  render(): void;
  /** Handle a container resize. */
  resize(width: number, height: number): void;
}

export function createRenderer(world: World, canvasParent: HTMLElement): Renderer {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a);

  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    2000,
  );
  camera.position.set(0, 22, 34);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // cap for the Air
  renderer.setSize(window.innerWidth, window.innerHeight);
  canvasParent.appendChild(renderer.domElement);

  // Free-look camera: orbit/zoom/pan. This is the Phase 0 control scheme
  // (docs/08 "static 3D system scene; free-look camera"). Piloting comes later.
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxDistance = 200;

  // Lighting: the star is the light source, plus a faint ambient fill so the
  // night sides of planets aren't pure black.
  scene.add(new THREE.AmbientLight(0x223044, 0.6));
  const starLight = new THREE.PointLight(0xfff2d8, 2.2, 0, 0.0);
  scene.add(starLight); // sits at origin where the star is

  // Cheap star-field backdrop (instanced points, no textures).
  scene.add(makeStarfield(world));

  // One mesh per body, built from Body components.
  const meshes = new Map<number, THREE.Mesh>();
  const { body, orbit } = world.components;

  for (const [entity, b] of body) {
    const geo = new THREE.SphereGeometry(b.radius, 24, 16);
    const material =
      b.kind === "star"
        ? new THREE.MeshBasicMaterial({ color: b.color }) // self-lit
        : new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.9, metalness: 0.0 });
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = b.name;
    scene.add(mesh);
    meshes.set(entity, mesh);

    if (b.kind === "star") {
      // A soft halo around the star so it reads as a light source.
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(b.radius * 1.4, 24, 16),
        new THREE.MeshBasicMaterial({ color: b.color, transparent: true, opacity: 0.12 }),
      );
      mesh.add(halo);
    }
  }

  // Static orbit guide-lines so the geometry is legible even when paused.
  for (const [, orb] of orbit) {
    scene.add(makeOrbitLine(orb.elements));
  }

  return {
    sync(w: World) {
      for (const [entity, mesh] of meshes) {
        const t = w.components.transform.get(entity);
        if (t) {
          mesh.position.set(t.position.x, t.position.y, t.position.z);
        }
      }
    },
    render() {
      controls.update();
      renderer.render(scene, camera);
    },
    resize(width: number, height: number) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    },
  };
}

/** Build a faint instanced star-field. Deterministic look via the world RNG. */
function makeStarfield(world: World): THREE.Points {
  const count = 1200;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Scatter on a large sphere shell around the system.
    const r = 400 + world.rng.range(0, 400);
    const theta = world.rng.range(0, Math.PI * 2);
    const phi = Math.acos(world.rng.range(-1, 1));
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0x8893b0, size: 1.2, sizeAttenuation: false });
  return new THREE.Points(geo, mat);
}

/** A closed line tracing one orbit, sampled analytically from its elements. */
function makeOrbitLine(elements: Parameters<typeof positionAt>[0]): THREE.LineLoop {
  const segments = 128;
  const period = (Math.PI * 2) / elements.meanMotion; // one full revolution
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * period;
    const p = positionAt(elements, t);
    points.push(new THREE.Vector3(p.x, p.y, p.z));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color: 0x2a3550 });
  return new THREE.LineLoop(geo, mat);
}
