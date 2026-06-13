// Three.js render layer — Phase 1B: cockpit / chase / map cameras.
//
// Hard boundary (docs/03): renderer READS sim state, never mutates it.
// The sim never imports anything from here.
//
// Three camera views (docs/08):
//   'cockpit' — first-person from the ship's nose, looking down the heading.
//   'chase'   — third-person behind & above the ship (racing-style).
//   'map'     — OrbitControls free-look of the whole system, ship as a marker.
// 'C' cycles cockpit → chase → map; 'M' toggles map.
//
// Floating origin (docs/08): in flight views EVERYTHING in the system lives in
// one `worldRoot` group that is offset by -shipPos each frame, so the ship stays
// at render (0,0,0) and star + planets + orbit rings + starfield all move
// together and stay coherent. In map view the offset is zero (true coordinates)
// and the ship is drawn at its real position as a marker.

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { World } from "../sim/ecs/world.ts";
import type { CelestialBody } from "../sim/ecs/components.ts";
import { positionAt } from "../sim/math/kepler.ts";
import { noseVector } from "../sim/systems/ship-movement.ts";
import { SHIP_RADIUS, SHIP_LENGTH } from "../sim/presentation.ts";
import { viewState, type CameraView } from "../app/view-state.ts";

export interface Renderer {
  sync(world: World): void;
  render(): void;
  resize(width: number, height: number): void;
  cycleView(): void;
  toggleMap(): void;
  getView(): CameraView;
}

// Chase camera constants — tuned to the ship length (presentation.ts).
const CHASE_DIST   = 1.7;  // scene units behind ship (≈ 5 ship-lengths)
const CHASE_HEIGHT = 0.7;  // scene units above ship
const COCKPIT_FWD  = 0.22; // camera sits just ahead of the cone tip
const MAP_MARKER_SCALE = 40; // enlarge the ship in map view so it reads as a marker
const FORWARD_AXIS = new THREE.Vector3(0, 0, 1); // cone points +Z

export function createRenderer(world: World, canvasParent: HTMLElement): Renderer {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.05,
    12000, // far plane clears the ~700 u system + the distant starfield
  );

  const webgl = new THREE.WebGLRenderer({ antialias: true });
  webgl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  webgl.setSize(window.innerWidth, window.innerHeight);
  canvasParent.appendChild(webgl.domElement);

  const controls = new OrbitControls(camera, webgl.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxDistance = 6000;
  controls.enabled = false; // only in map view

  // --- Mouse-look for chase view (right-click drag) ---
  const mouseLook = { yaw: 0, pitch: 0 };
  let mouseDown = false;
  webgl.domElement.addEventListener("mousedown", (e) => {
    if (e.button === 2) { mouseDown = true; e.preventDefault(); }
  });
  webgl.domElement.addEventListener("mouseup",    () => { mouseDown = false; });
  webgl.domElement.addEventListener("mouseleave", () => { mouseDown = false; });
  webgl.domElement.addEventListener("mousemove", (e) => {
    if (!mouseDown || viewState.view === "map") return;
    mouseLook.yaw   -= e.movementX * 0.003;
    mouseLook.pitch -= e.movementY * 0.003;
    mouseLook.pitch  = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, mouseLook.pitch));
  });
  webgl.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

  // --- Lighting (added to the scene, not the moving world group) ---
  scene.add(new THREE.AmbientLight(0x223044, 0.7));

  // --- worldRoot: everything that should move under the floating origin ---
  const worldRoot = new THREE.Group();
  scene.add(worldRoot);

  // Star's point light lives inside worldRoot so it tracks the star's offset.
  const starLight = new THREE.PointLight(0xfff2d8, 2.4, 0, 0.0);
  worldRoot.add(starLight);

  worldRoot.add(makeStarfield(world));

  const bodyMeshes = new Map<number, THREE.Mesh>();
  for (const [entity, body] of world.components.celestialBody) {
    const mesh = buildBodyMesh(body);
    worldRoot.add(mesh);
    bodyMeshes.set(entity, mesh);
  }

  for (const [, orb] of world.components.orbit) {
    worldRoot.add(makeOrbitLine(orb.elements));
  }

  // --- Ship mesh lives in the scene (NOT worldRoot) so it stays near origin ---
  const shipMesh = buildShipMesh();
  scene.add(shipMesh);

  // Reused scratch vectors.
  const _nose   = new THREE.Vector3();
  const _camPos = new THREE.Vector3();
  const _lookAt = new THREE.Vector3();
  const _offset = new THREE.Vector3();
  const _up     = new THREE.Vector3(0, 1, 0);
  const _qLook  = new THREE.Quaternion();
  const _qShip  = new THREE.Quaternion();

  function setView(v: CameraView): void {
    viewState.view = v;
    controls.enabled = v === "map";
    mouseLook.yaw = 0;
    mouseLook.pitch = 0;
    if (v === "map") {
      camera.position.set(0, 600, 900); // pulled back to frame the whole system
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }

  return {
    sync(w: World) {
      const shipT    = w.components.transform.get(w.shipId);
      const shipCtrl = w.components.shipControl.get(w.shipId);
      const sx = shipT?.position.x ?? 0;
      const sy = shipT?.position.y ?? 0;
      const sz = shipT?.position.z ?? 0;

      // Update every body mesh to its TRUE position (inside worldRoot).
      // The star has no transform → it stays at the group's local origin (0,0,0),
      // which is correct: the group offset handles its placement.
      for (const [entity, mesh] of bodyMeshes) {
        const t = w.components.transform.get(entity);
        if (t) mesh.position.set(t.position.x, t.position.y, t.position.z);
      }

      // Orient the ship from its heading + pitch (shared nose math with the sim).
      if (shipCtrl) {
        const n = noseVector(shipCtrl.heading, shipCtrl.pitch);
        _nose.set(n.x, n.y, n.z).normalize();
        _qShip.setFromUnitVectors(FORWARD_AXIS, _nose);
        shipMesh.quaternion.copy(_qShip);
      }

      const view = viewState.view;

      if (view === "map") {
        // True coordinates; ship drawn at real position as a marker.
        worldRoot.position.set(0, 0, 0);
        shipMesh.position.set(sx, sy, sz);
        shipMesh.scale.setScalar(MAP_MARKER_SCALE); // reads at system scale
        shipMesh.visible = true;
        return; // camera driven by OrbitControls
      }

      // Flight views: floating origin keeps the ship at render (0,0,0).
      worldRoot.position.set(-sx, -sy, -sz);
      shipMesh.position.set(0, 0, 0);
      shipMesh.scale.setScalar(1);
      shipMesh.visible = view !== "cockpit"; // hide own hull in first-person

      if (!shipCtrl) return;

      // Mouse-look offset rotates the camera around the ship.
      _qLook.setFromEuler(new THREE.Euler(mouseLook.pitch, mouseLook.yaw, 0, "YXZ"));

      if (view === "cockpit") {
        _camPos.copy(_nose).multiplyScalar(COCKPIT_FWD);
        _lookAt.copy(_camPos).add(_nose);
        _offset.copy(_lookAt).sub(_camPos).applyQuaternion(_qLook).add(_camPos);
        camera.position.copy(_camPos);
        camera.up.copy(_up);
        camera.lookAt(_offset);
      } else {
        // chase: behind along -nose, raised, with mouse-look swing.
        _offset.copy(_nose).multiplyScalar(-CHASE_DIST).setY(CHASE_HEIGHT);
        _offset.applyQuaternion(_qLook);
        _camPos.set(0, 0, 0).add(_offset);
        _lookAt.copy(_nose).multiplyScalar(2).setY(0.3);
        camera.position.copy(_camPos);
        camera.up.copy(_up);
        camera.lookAt(_lookAt);
      }
    },

    render() {
      if (viewState.view === "map") controls.update();
      webgl.render(scene, camera);
    },

    resize(width: number, height: number) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      webgl.setSize(width, height);
    },

    cycleView() {
      const order: CameraView[] = ["cockpit", "chase", "map"];
      const next = order[(order.indexOf(viewState.view) + 1) % order.length]!;
      setView(next);
    },

    toggleMap() {
      setView(viewState.view === "map" ? "chase" : "map");
    },

    getView() { return viewState.view; },
  };
}

// ---------------------------------------------------------------------------
// Mesh builders
// ---------------------------------------------------------------------------

function buildShipMesh(): THREE.Mesh {
  const geo = new THREE.ConeGeometry(SHIP_RADIUS, SHIP_LENGTH, 6);
  geo.rotateX(Math.PI / 2); // point the tip toward +Z
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
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: body.color }));
    mesh.name = body.name;
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(body.renderRadius * 1.45, 24, 16),
      new THREE.MeshBasicMaterial({ color: body.color, transparent: true, opacity: 0.1 }),
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
    // Far enough out that the ship never reaches the starfield shell while
    // crossing the ~700 u system (it lives in worldRoot, at fixed world coords).
    const r = 4000 + world.rng.range(0, 2000);
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
