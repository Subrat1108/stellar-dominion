// Three.js render layer — Phase 1 system view.
//
// Hard boundary (docs/03): renderer READS sim state, never mutates it.
// The sim never imports anything from here.
//
// Light for the MacBook Air: low-poly spheres, one point light, instanced
// star-field points, no post-processing, pixel-ratio capped at 2.

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { World } from "../sim/ecs/world.ts";
import type { CelestialBody } from "../sim/ecs/components.ts";
import { positionAt } from "../sim/math/kepler.ts";

export interface Renderer {
  sync(world: World): void;
  render(): void;
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
  camera.position.set(0, 24, 38);

  const webgl = new THREE.WebGLRenderer({ antialias: true });
  webgl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  webgl.setSize(window.innerWidth, window.innerHeight);
  canvasParent.appendChild(webgl.domElement);

  const controls = new OrbitControls(camera, webgl.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxDistance = 300;

  // The star's point light + faint ambient fill.
  scene.add(new THREE.AmbientLight(0x223044, 0.7));
  scene.add(new THREE.PointLight(0xfff2d8, 2.4, 0, 0.0));

  scene.add(makeStarfield(world));

  // Build one mesh per celestial body.
  const meshes = new Map<number, THREE.Mesh>();

  for (const [entity, body] of world.components.celestialBody) {
    const mesh = buildBodyMesh(body);
    scene.add(mesh);
    meshes.set(entity, mesh);
  }

  // Static orbit guide-lines.
  for (const [, orb] of world.components.orbit) {
    scene.add(makeOrbitLine(orb.elements));
  }

  return {
    sync(w: World) {
      for (const [entity, mesh] of meshes) {
        const t = w.components.transform.get(entity);
        if (t) {
          mesh.position.set(t.position.x, t.position.y, t.position.z);
        }
        // No Transform = stationary at origin (the star).
      }
    },
    render() {
      controls.update();
      webgl.render(scene, camera);
    },
    resize(width: number, height: number) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      webgl.setSize(width, height);
    },
  };
}

function buildBodyMesh(body: CelestialBody): THREE.Mesh {
  const geo = new THREE.SphereGeometry(body.renderRadius, 24, 16);

  if (body.kind === "star") {
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: body.color }),
    );
    mesh.name = body.name;
    // Soft halo so the star reads as a light source.
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(body.renderRadius * 1.45, 24, 16),
      new THREE.MeshBasicMaterial({ color: body.color, transparent: true, opacity: 0.10 }),
    );
    mesh.add(halo);
    return mesh;
  }

  // Gas giants get a slight emissive tint; planets are purely lit.
  const mat =
    body.kind === "gas-giant"
      ? new THREE.MeshStandardMaterial({
          color: body.color,
          roughness: 0.7,
          metalness: 0.0,
          emissive: new THREE.Color(body.color).multiplyScalar(0.05),
        })
      : new THREE.MeshStandardMaterial({ color: body.color, roughness: 0.9, metalness: 0.0 });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = body.name;
  return mesh;
}

function makeStarfield(world: World): THREE.Points {
  const count = 1400;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 450 + world.rng.range(0, 400);
    const theta = world.rng.range(0, Math.PI * 2);
    const phi = Math.acos(world.rng.range(-1, 1));
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: 0x8893b0, size: 1.2, sizeAttenuation: false }),
  );
}

function makeOrbitLine(elements: Parameters<typeof positionAt>[0]): THREE.LineLoop {
  const segments = 128;
  const period = (Math.PI * 2) / elements.meanMotion;
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < segments; i++) {
    const p = positionAt(elements, (i / segments) * period);
    points.push(new THREE.Vector3(p.x, p.y, p.z));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: 0x2a3550 }));
}
