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
import { steerState } from "../app/steer-state.ts";
import { nearestBodyId, markerScreenPosition } from "../app/nav.ts";
import { makePlanetMaterial, updatePlanetMaterial } from "./planet-material.ts";
import { buildGasGiantRing, buildKuiperBelt } from "./debris-field.ts";
import { buildSectorScene } from "./sector-scene.ts";
import {
  nextMapTier,
  SECTOR_DEFAULT_CAM_DIST,
  SYSTEM_DEFAULT_CAM_DIST,
} from "./sector-layout.ts";

export interface Renderer {
  sync(world: World): void;
  render(): void;
  resize(width: number, height: number): void;
  cycleView(): void;
  toggleMap(): void;
  getView(): CameraView;
  /** Rebuild the in-system scene graph after a warp arrival (system swapped). */
  rebuildSystem(world: World): void;
}

// Chase/cockpit camera constants (scene units). The camera sits ~20 ship-lengths
// back (CHASE_DIST : SHIP_LENGTH ≈ 0.001 : 0.00005) so the ship reads as a tiny
// speck, while CHASE_DIST stays ≪ a body radius so the body fills the view as a
// wall on arrival, and ≥ 5× the near plane (0.0002) so the ship doesn't clip
// (Session 20 fix). The look-at offsets keep the same framing angle.
const CHASE_DIST   = 0.001;    // scene units behind ship
const CHASE_HEIGHT = 0.0004;   // scene units above ship
const COCKPIT_FWD  = 0.000125; // camera sits just ahead of the cone tip
const CHASE_LOOK_AHEAD = 0.00118; // chase look-at point ahead of the ship
const CHASE_LOOK_UP    = 0.000175; // chase look-at point raised slightly
const MAP_MARKER_SCALE = 150000; // enlarge the tiny ship in map view (~7.5 u marker)
const MARKER_EDGE_MARGIN = 28; // px inset for the off-screen target chevron
const TRANSITION_SECS = 0.45; // eased cross-fade duration on a map-tier flip
const FORWARD_AXIS = new THREE.Vector3(0, 0, 1); // cone points +Z

export function createRenderer(world: World, canvasParent: HTMLElement): Renderer {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    // Honest scale spans ~0.001 u (ship) → 12000 u (starfield): a tiny near plane
    // plus a logarithmic depth buffer (below) keeps that huge range from z-fighting.
    0.0002,
    12000, // far plane clears the ~700 u system + the distant starfield
  );

  const webgl = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  webgl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  webgl.setSize(window.innerWidth, window.innerHeight);
  canvasParent.appendChild(webgl.domElement);

  // Flight-HUD target marker (exploration-polish A): at honest scale bodies are
  // tiny dots, so a directional marker — a reticle when the target is on-screen,
  // an edge chevron when it's off-screen/behind — makes free-flight navigable.
  // Driven by the renderer each frame (smooth, decoupled from React).
  const targetMarker = document.createElement("div");
  targetMarker.style.cssText =
    "position:absolute;left:0;top:0;pointer-events:none;color:#89dceb;" +
    "font:16px/1 ui-monospace,monospace;text-shadow:0 0 3px #000,0 0 6px #000;" +
    "z-index:5;display:none;will-change:left,top,transform;";
  if (getComputedStyle(canvasParent).position === "static") {
    canvasParent.style.position = "relative";
  }
  canvasParent.appendChild(targetMarker);

  const controls = new OrbitControls(camera, webgl.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxDistance = 6000;
  controls.enabled = false; // only in map view

  // --- Mouse / touchpad flight control (Polish B) ---
  // In a flight view, CLICK the canvas to capture the pointer (pointer lock);
  // trackpad/mouse motion then STEERS the ship (deltas → steerState, consumed by
  // the frame loop as yaw/pitch Input). Hold the free-look modifier (Space, set
  // in app/input.ts → steerState.freeLook) to swing the CAMERA instead without
  // changing heading. Esc releases the lock. Clicks on HUD controls never reach
  // this listener (the #ui overlay is pointer-events:none except .interactive),
  // so buttons don't trigger capture. Right-drag also free-looks when unlocked.
  const mouseLook = { yaw: 0, pitch: 0 };
  const canvas = webgl.domElement;
  let rightDown = false;

  canvas.addEventListener("click", () => {
    if (viewState.view === "map") return;                 // map uses OrbitControls
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
  });
  document.addEventListener("pointerlockchange", () => {
    steerState.pointerLocked = document.pointerLockElement === canvas;
  });

  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 2) { rightDown = true; e.preventDefault(); }
  });
  canvas.addEventListener("mouseup",    () => { rightDown = false; });
  canvas.addEventListener("mouseleave", () => { rightDown = false; });
  canvas.addEventListener("mousemove", (e) => {
    if (viewState.view === "map") return;
    const locked = document.pointerLockElement === canvas;
    if (locked && !steerState.freeLook) {
      // Steer the ship: accumulate the pointer delta for the frame loop.
      steerState.dx += e.movementX;
      steerState.dy += e.movementY;
      return;
    }
    // Free-look (held modifier while locked, or right-drag while unlocked):
    // swing the camera around the ship without changing heading.
    if ((locked && steerState.freeLook) || rightDown) {
      mouseLook.yaw   -= e.movementX * 0.003;
      mouseLook.pitch -= e.movementY * 0.003;
      mouseLook.pitch  = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, mouseLook.pitch));
    }
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  // --- Lighting (added to the scene, not the moving world group) ---
  scene.add(new THREE.AmbientLight(0x223044, 0.7));

  // --- worldRoot: everything that should move under the floating origin ---
  const worldRoot = new THREE.Group();
  scene.add(worldRoot);

  // Star's point light lives inside worldRoot so it tracks the star's offset.
  const starLight = new THREE.PointLight(0xfff2d8, 2.4, 0, 0.0);
  worldRoot.add(starLight);

  worldRoot.add(makeStarfield(world));

  // Procedural-surface materials (planets + gas giants), updated each frame from
  // live body state so the globe transforms as terraforming runs. These are
  // rebuilt on a warp arrival (the active system's bodies are swapped out).
  const bodyMeshes = new Map<number, THREE.Mesh>();
  const planetMaterials = new Map<number, THREE.ShaderMaterial>();
  const orbitLines: THREE.LineLoop[] = [];
  let kuiperBelt: THREE.Group | null = null; // instanced Kuiper belt (worldRoot)
  let starEntity = -1;

  function disposeMesh(mesh: THREE.Object3D): void {
    mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
  }

  // (Re)build the in-system scene graph (bodies + orbit rings) from the world.
  function buildSystemGraph(w: World): void {
    for (const mesh of bodyMeshes.values()) { worldRoot.remove(mesh); disposeMesh(mesh); }
    bodyMeshes.clear();
    planetMaterials.clear();
    for (const line of orbitLines) { worldRoot.remove(line); line.geometry.dispose(); }
    orbitLines.length = 0;

    // The star entity — orbit rings are drawn only for star-orbiting bodies
    // (a moon's ring would otherwise be drawn around the origin).
    starEntity = -1;
    for (const [entity, body] of w.components.celestialBody) {
      if (body.kind === "star") { starEntity = entity; break; }
    }
    for (const [entity, body] of w.components.celestialBody) {
      const mesh = buildBodyMesh(body);
      worldRoot.add(mesh);
      bodyMeshes.set(entity, mesh);
      if (body.kind === "planet" || body.kind === "gas-giant") {
        planetMaterials.set(entity, mesh.material as THREE.ShaderMaterial);
      }
      // Gas giants get a flyable icy ring, parented to the body mesh so it tracks
      // the planet as it orbits (disposed with the mesh on a rebuild).
      if (body.kind === "gas-giant") mesh.add(buildGasGiantRing(body));
    }

    // Orbit rings for star-orbiters + the system's outer-edge Kuiper belt.
    let maxOrbit = 0;
    for (const [, orb] of w.components.orbit) {
      if (orb.parent !== starEntity) continue;
      maxOrbit = Math.max(maxOrbit, orb.elements.semiMajorAxis);
      const line = makeOrbitLine(orb.elements);
      worldRoot.add(line);
      orbitLines.push(line);
    }
    if (kuiperBelt) { worldRoot.remove(kuiperBelt); disposeMesh(kuiperBelt); kuiperBelt = null; }
    if (maxOrbit > 0) {
      kuiperBelt = buildKuiperBelt(maxOrbit, w.activeSystemId ?? "system");
      worldRoot.add(kuiperBelt);
    }
  }
  buildSystemGraph(world);

  // --- Ship mesh lives in the scene (NOT worldRoot) so it stays near origin ---
  const shipMesh = buildShipMesh();
  scene.add(shipMesh);

  // --- Sector map (Tier 1): a separate scene of the stellar neighbourhood,
  // shown when the map view is zoomed all the way out (docs/12). The same
  // perspective camera + OrbitControls drive both tiers; a tier flip reframes
  // the camera and kicks an eased fade (viewState.transitionT) for the overlay.
  const sectorView = buildSectorScene(world.activeSystemId);
  let lastSyncMs = performance.now();

  // Reused scratch vectors.
  const _nose   = new THREE.Vector3();
  const _camPos = new THREE.Vector3();
  const _lookAt = new THREE.Vector3();
  const _offset = new THREE.Vector3();
  const _lightDir = new THREE.Vector3();
  const _targetWorld = new THREE.Vector3();
  const _targetCam   = new THREE.Vector3();
  const _up     = new THREE.Vector3(0, 1, 0);
  const _qLook  = new THREE.Quaternion();
  const _qShip  = new THREE.Quaternion();

  function setView(v: CameraView): void {
    viewState.view = v;
    controls.enabled = v === "map";
    mouseLook.yaw = 0;
    mouseLook.pitch = 0;
    // The map uses OrbitControls (normal mouse), so drop any flight pointer lock.
    if (v === "map" && document.pointerLockElement === canvas) document.exitPointerLock();
    if (v === "map") {
      // Always (re)enter the map at the in-system tier.
      viewState.mapTier = "system";
      camera.position.set(0, 600, 900); // pulled back to frame the whole system
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }

  // Reframe the camera when the map crosses between system and sector tiers,
  // and kick the eased cross-fade overlay.
  function applyTierFlip(tier: "system" | "sector"): void {
    viewState.mapTier = tier;
    viewState.transitionT = 1;
    controls.target.set(0, 0, 0);
    const dist = tier === "sector" ? SECTOR_DEFAULT_CAM_DIST : SYSTEM_DEFAULT_CAM_DIST;
    camera.position.set(0, dist * 0.55, dist * 0.83).setLength(dist);
    controls.update();
  }

  return {
    sync(w: World) {
      // Hidden by default; the flight path below re-shows it when a target exists.
      targetMarker.style.display = "none";

      // Decay the map-tier cross-fade overlay (eased; viewState.transitionT).
      const nowMs = performance.now();
      const dt = (nowMs - lastSyncMs) / 1000;
      lastSyncMs = nowMs;
      if (viewState.transitionT > 0) {
        viewState.transitionT = Math.max(0, viewState.transitionT - dt / TRANSITION_SECS);
      }

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

      // Refresh procedural surfaces from live state. Light comes from the star at
      // the worldRoot origin, so in each (unrotated) body's local frame the light
      // direction is simply toward the origin: normalize(-bodyPos).
      for (const [entity, material] of planetMaterials) {
        const body = w.components.celestialBody.get(entity);
        const t = w.components.transform.get(entity);
        if (!body || !t) continue;
        _lightDir.set(-t.position.x, -t.position.y, -t.position.z).normalize();
        updatePlanetMaterial(material, body, w.time, _lightDir);
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
        // Tier detection from camera distance (hysteretic); a flip reframes the
        // camera and kicks the cross-fade. Zoom out → sector; zoom in → system.
        const camDist = camera.position.distanceTo(controls.target);
        const tier = nextMapTier(viewState.mapTier, camDist);
        if (tier !== viewState.mapTier) applyTierFlip(tier);

        if (viewState.mapTier === "sector") {
          // The sector scene is static geometry; just track the active node.
          sectorView.setActiveSystem(w.activeSystemId);
          shipMesh.visible = false;
          return; // camera driven by OrbitControls; sectorView.scene rendered
        }

        // System tier: true coordinates; ship drawn at real position as a marker.
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

      // When steering (locked, not free-looking) let the swung camera ease back
      // to straight-ahead so the view follows the nose after a look-around.
      if (steerState.pointerLocked && !steerState.freeLook) {
        mouseLook.yaw *= 0.85;
        mouseLook.pitch *= 0.85;
      }

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
        _lookAt.copy(_nose).multiplyScalar(CHASE_LOOK_AHEAD).setY(CHASE_LOOK_UP);
        camera.position.copy(_camPos);
        camera.up.copy(_up);
        camera.lookAt(_lookAt);
      }

      // --- Target marker ---------------------------------------------------
      // A SET COURSE target (autopilotTargetId) is the primary "direction
      // indicator": drawn in the course colour with a distinct on-screen pipper,
      // and an edge chevron when off-screen/behind so you can always turn toward
      // it. With no course set it falls back to a dim nearest-body hint.
      const courseId = shipCtrl.autopilotTargetId;
      const isCourse = courseId !== undefined && bodyMeshes.has(courseId);
      let targetId = isCourse ? courseId : undefined;
      if (targetId === undefined) {
        const positions: [number, { x: number; y: number; z: number }][] = [];
        for (const [id] of bodyMeshes) {
          const t = w.components.transform.get(id);
          positions.push([id, t ? t.position : { x: 0, y: 0, z: 0 }]);
        }
        targetId = nearestBodyId(positions, { x: sx, y: sy, z: sz })?.id;
      }
      const targetMesh = targetId !== undefined ? bodyMeshes.get(targetId) : undefined;
      if (targetMesh) {
        camera.updateMatrixWorld();
        targetMesh.getWorldPosition(_targetWorld);
        _targetCam.copy(_targetWorld).applyMatrix4(camera.matrixWorldInverse);
        const behind = _targetCam.z >= 0; // camera looks down -z
        _targetWorld.project(camera);     // mutate into NDC
        const el = webgl.domElement;
        const place = markerScreenPosition(
          _targetWorld.x, _targetWorld.y, behind,
          el.clientWidth, el.clientHeight, MARKER_EDGE_MARGIN,
        );
        targetMarker.style.display = "block";
        targetMarker.style.left = `${place.x}px`;
        targetMarker.style.top = `${place.y}px`;
        // Course marker reads amber + brighter; a bare proximity hint is dim cyan.
        targetMarker.style.color = isCourse ? "#f9e2af" : "#89dceb";
        targetMarker.style.opacity = isCourse ? "1" : "0.6";
        if (place.offscreen) {
          targetMarker.textContent = "➤";
          targetMarker.style.transform = `translate(-50%,-50%) rotate(${place.angle}rad)`;
        } else {
          targetMarker.textContent = isCourse ? "◎" : "⊕";
          targetMarker.style.transform = "translate(-50%,-50%)";
        }
      }
    },

    render() {
      if (viewState.view === "map") controls.update();
      const useSector = viewState.view === "map" && viewState.mapTier === "sector";
      webgl.render(useSector ? sectorView.scene : scene, camera);
    },

    resize(width: number, height: number) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      webgl.setSize(width, height);
    },

    cycleView() {
      // Two flight cameras only (Polish B): C toggles cockpit ↔ chase. The map is
      // no longer in the camera cycle — it's reached with M and becomes the real
      // clickable multi-scale map in Polish C. From map, C returns to cockpit.
      const next: CameraView = viewState.view === "cockpit" ? "chase" : "cockpit";
      setView(next);
    },

    toggleMap() {
      setView(viewState.view === "map" ? "chase" : "map");
    },

    getView() { return viewState.view; },

    rebuildSystem(w: World) {
      buildSystemGraph(w);
      sectorView.setActiveSystem(w.activeSystemId);
    },
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

  // Planets + gas giants get the procedural ShaderMaterial (FBM/Simplex on the
  // GPU); its appearance is a pure function of the body's properties + seed and
  // transforms live as terraforming changes the body's state (docs/13).
  const mesh = new THREE.Mesh(geo, makePlanetMaterial(body));
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
