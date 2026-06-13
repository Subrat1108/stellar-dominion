// Three.js render layer — Phase 1B: chase camera + system map view.
//
// Hard boundary (docs/03): renderer READS sim state, never mutates it.
// The sim never imports anything from here.
//
// Two camera modes (docs/08):
//   'flight' — chase camera behind/above ship; WASD steers ship via sim input.
//   'map'    — OrbitControls free-look of the whole system.
// Press M to toggle. Both share one scene; only the active camera/controls differ.

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { World } from "../sim/ecs/world.ts";
import type { CelestialBody } from "../sim/ecs/components.ts";
import { positionAt } from "../sim/math/kepler.ts";

export type CameraMode = "flight" | "map";

export interface Renderer {
  sync(world: World): void;
  render(): void;
  resize(width: number, height: number): void;
  toggleCameraMode(): void;
  getCameraMode(): CameraMode;
}

// Chase camera constants.
const CHASE_DIST   = 5;    // scene units behind ship
const CHASE_HEIGHT = 2;    // scene units above ship
const LOOK_AHEAD   = 1.5;  // scene units ahead of ship that camera aims at

export function createRenderer(world: World, canvasParent: HTMLElement): Renderer {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a);

  // --- Cameras ---
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

  // --- Map-mode controls (OrbitControls, disabled in flight mode) ---
  const controls = new OrbitControls(camera, webgl.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxDistance = 300;

  let cameraMode: CameraMode = "flight";
  controls.enabled = cameraMode === "map";

  // --- Mouse-look state for flight mode (right-click drag) ---
  const mouseLook = { yaw: 0, pitch: 0 };
  let mouseDown = false;

  webgl.domElement.addEventListener("mousedown", (e) => {
    if (e.button === 2) { mouseDown = true; e.preventDefault(); }
  });
  webgl.domElement.addEventListener("mouseup",   () => { mouseDown = false; });
  webgl.domElement.addEventListener("mouseleave",() => { mouseDown = false; });
  webgl.domElement.addEventListener("mousemove", (e) => {
    if (!mouseDown || cameraMode !== "flight") return;
    mouseLook.yaw   -= e.movementX * 0.003;
    mouseLook.pitch -= e.movementY * 0.003;
    mouseLook.pitch  = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, mouseLook.pitch));
  });
  webgl.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

  // --- Lighting ---
  scene.add(new THREE.AmbientLight(0x223044, 0.7));
  scene.add(new THREE.PointLight(0xfff2d8, 2.4, 0, 0.0));

  scene.add(makeStarfield(world));

  // --- Celestial body meshes ---
  const bodyMeshes = new Map<number, THREE.Mesh>();
  for (const [entity, body] of world.components.celestialBody) {
    const mesh = buildBodyMesh(body);
    scene.add(mesh);
    bodyMeshes.set(entity, mesh);
  }

  // --- Static orbit guide-lines ---
  for (const [, orb] of world.components.orbit) {
    scene.add(makeOrbitLine(orb.elements));
  }

  // --- Ship mesh (low-poly cone pointing toward +Z) ---
  const shipMesh = buildShipMesh();
  scene.add(shipMesh);

  // Helper vectors (reused each frame to avoid allocations).
  const _shipPos  = new THREE.Vector3();
  const _forward  = new THREE.Vector3();
  const _backward = new THREE.Vector3();
  const _camPos   = new THREE.Vector3();
  const _lookAt   = new THREE.Vector3();
  const _up       = new THREE.Vector3(0, 1, 0);
  const _qLook    = new THREE.Quaternion();

  return {
    sync(w: World) {
      // Floating origin: keep ship near world (0,0,0) each frame.
      // All mesh positions are expressed relative to the ship's sim position.
      // The sim retains absolute coordinates; this is renderer-only (docs/08).
      const shipT    = w.components.transform.get(w.shipId);
      const shipCtrl = w.components.shipControl.get(w.shipId);
      const originX  = shipT?.position.x ?? 0;
      const originZ  = shipT?.position.z ?? 0;

      // Update planet/star mesh positions relative to ship origin.
      for (const [entity, mesh] of bodyMeshes) {
        const t = w.components.transform.get(entity);
        if (t) mesh.position.set(t.position.x - originX, t.position.y, t.position.z - originZ);
      }

      // Ship mesh always at render origin; only its rotation changes.
      shipMesh.position.set(0, 0, 0);
      if (shipCtrl) {
        shipMesh.rotation.y = -shipCtrl.heading;
      }

      // Floating origin: _shipPos is (0,0,0) in render space.
      _shipPos.set(0, 0, 0);

      // Position camera in flight mode.
      if (cameraMode === "flight" && shipCtrl) {
        const h = shipCtrl.heading;
        _forward.set(Math.sin(h), 0, Math.cos(h));
        _backward.set(-Math.sin(h), 0, -Math.cos(h));

        // Rotate the chase offset by the mouse-look yaw/pitch.
        _qLook.setFromEuler(
          new THREE.Euler(mouseLook.pitch, mouseLook.yaw, 0, "YXZ"),
        );
        _camPos
          .copy(_backward)
          .multiplyScalar(CHASE_DIST)
          .setY(CHASE_HEIGHT)
          .applyQuaternion(_qLook)
          .add(_shipPos);

        _lookAt.copy(_shipPos).addScaledVector(_forward, LOOK_AHEAD).setY(0.3);

        camera.position.copy(_camPos);
        camera.up.copy(_up);
        camera.lookAt(_lookAt);
      }
    },

    render() {
      if (cameraMode === "map") controls.update();
      webgl.render(scene, camera);
    },

    resize(width: number, height: number) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      webgl.setSize(width, height);
    },

    toggleCameraMode() {
      cameraMode = cameraMode === "flight" ? "map" : "flight";
      controls.enabled = cameraMode === "map";
      if (cameraMode === "map") {
        // Restore a sensible map-view position the first time.
        camera.position.set(0, 24, 38);
        controls.update();
      }
      // Reset mouse-look offset when switching.
      mouseLook.yaw   = 0;
      mouseLook.pitch = 0;
    },

    getCameraMode() { return cameraMode; },
  };
}

// ---------------------------------------------------------------------------
// Mesh builders
// ---------------------------------------------------------------------------

function buildShipMesh(): THREE.Mesh {
  // Cone pointing toward +Z; low-poly so it reads as a small arrow-like ship.
  const geo = new THREE.ConeGeometry(0.25, 0.8, 6);
  // Rotate geometry so the tip points in +Z (cone tip is at +Y by default).
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xcdd6f4,
    roughness: 0.5,
    metalness: 0.3,
    emissive: new THREE.Color(0x89b4fa).multiplyScalar(0.15),
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "ISS Prometheus";
  return mesh;
}

function buildBodyMesh(body: CelestialBody): THREE.Mesh {
  const geo = new THREE.SphereGeometry(body.renderRadius, 24, 16);

  if (body.kind === "star") {
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: body.color }),
    );
    mesh.name = body.name;
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(body.renderRadius * 1.45, 24, 16),
      new THREE.MeshBasicMaterial({ color: body.color, transparent: true, opacity: 0.10 }),
    );
    mesh.add(halo);
    return mesh;
  }

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
