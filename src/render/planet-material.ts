// Procedural planet surfaces — Three.js ShaderMaterial (docs/09, docs/13).
//
// A body's appearance is a PURE FUNCTION of its physical properties + seed,
// computed per-fragment on the GPU with FBM/Simplex noise — no stored textures.
// Surface colour comes from composition/temperature, oceans from the hydrosphere,
// ice caps from temperature, vegetation from habitability, atmospheric haze from
// pressure. Because the uniforms are derived from live body state, the globe
// visibly transforms as terraforming changes that state.
//
// The property→uniform mapping (bodyToVisualParams) is deliberately separated
// from Three.js so it can be unit-tested as a pure, deterministic function.
// Kept cheap for a MacBook Air: 4-octave FBM, single sphere, no LOD.

import * as THREE from "three";
import type { CelestialBody } from "../sim/ecs/components.ts";
import { xxHashString } from "../sim/gen/hash.ts";

const ONE_ATM_PA = 101_325;

/** Pure, serialisable description of how a body should look. No Three.js here. */
export interface PlanetVisualParams {
  /** Deterministic 0–1 seed (from bodyKey/name) — fixes the noise pattern. */
  seed: number;
  isGasGiant: boolean;
  baseColor: [number, number, number];
  oceanColor: [number, number, number];
  iceColor: [number, number, number];
  vegColor: [number, number, number];
  atmosphereColor: [number, number, number];
  /** 0–1 fraction of surface below sea level (ocean coverage). */
  oceanLevel: number;
  /** 0–1 polar ice-cap extent. */
  iceLevel: number;
  /** 0–1 vegetation density. */
  vegetation: number;
  /** 0–1 atmospheric haze density. */
  atmosphereDensity: number;
}

function hexToRgb(hex: number): [number, number, number] {
  return [((hex >> 16) & 0xff) / 255, ((hex >> 8) & 0xff) / 255, (hex & 0xff) / 255];
}

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/**
 * Map a body's physical state to visual parameters. PURE + DETERMINISTIC:
 * identical body state always yields identical params (unit-tested), and it
 * reflects live state so terraforming changes the look.
 */
export function bodyToVisualParams(body: CelestialBody): PlanetVisualParams {
  const seed = (xxHashString(body.bodyKey ?? body.name) % 100000) / 100000;
  const isGasGiant = body.kind === "gas-giant";

  const baseColor = hexToRgb(body.color);
  const temp = body.surfaceTempK ?? 255;
  const pressurePa = body.atmosphere?.pressurePa ?? 0;
  const pressureAtm = pressurePa / ONE_ATM_PA;

  // Ocean coverage: prefer the terraforming hydrosphere gauge; fall back to the
  // boolean liquid-water flag. Gas giants have no surface ocean.
  const hydro = body.hydrosphere;
  const oceanLevel = isGasGiant
    ? 0
    : hydro !== undefined
      ? clamp01(hydro)
      : body.atmosphere?.hasLiquidWater
        ? 0.55
        : 0;

  // Ice caps grow as the surface cools (freezing ≈ 273 K; none above ~330 K).
  const iceLevel = isGasGiant ? 0 : clamp01((310 - temp) / 110);

  // Vegetation tracks habitability but needs liquid water to take hold.
  const vegetation =
    isGasGiant || oceanLevel <= 0 ? 0 : clamp01((body.habitability ?? 0) * 1.2);

  // Atmospheric haze: log-scaled pressure (Earth ~0.5, Venus ~1, Mars ~0.05).
  const atmosphereDensity = clamp01(0.5 + 0.5 * Math.log10(pressureAtm + 1e-3) / 2);

  // Toxic/thick atmospheres skew ochre; clean ones skew pale blue.
  const toxicity = body.atmosphere?.toxicity ?? 0;
  const atmosphereColor: [number, number, number] = [
    0.55 + 0.35 * toxicity,
    0.6 + 0.1 * toxicity,
    0.85 - 0.4 * toxicity,
  ];

  return {
    seed,
    isGasGiant,
    baseColor,
    oceanColor: [0.05, 0.2, 0.45],
    iceColor: [0.9, 0.95, 1.0],
    vegColor: [0.18, 0.42, 0.18],
    atmosphereColor,
    oceanLevel,
    iceLevel,
    vegetation,
    atmosphereDensity,
  };
}

// --- GLSL ---------------------------------------------------------------------

const VERT = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;     // OBJECT space (bodies are unrotated, so == world space)
  varying vec3 vViewNormal; // VIEW space — only for the camera-facing limb glow
  void main() {
    vPos = position;
    vNormal = normal;
    vViewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// 3D simplex noise (Ashima / Stefan Gustavson, webgl-noise) + FBM. Standard,
// branch-free, cheap enough for per-fragment use on integrated GPUs.
const FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vViewNormal;

  uniform float uSeed;
  uniform float uTime;
  uniform int   uIsGasGiant;
  uniform vec3  uBaseColor;
  uniform vec3  uOceanColor;
  uniform vec3  uIceColor;
  uniform vec3  uVegColor;
  uniform vec3  uAtmColor;
  uniform float uOceanLevel;
  uniform float uIceLevel;
  uniform float uVegetation;
  uniform float uAtmDensity;
  uniform vec3  uLightDir;   // world-space direction from the body TOWARD the star
  uniform float uAmbient;    // starlight floor so the night side isn't pure black

  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);
    const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.0-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
      +i.y+vec4(0.0,i1.y,i2.y,1.0))
      +i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;
    vec4 s1=floor(b1)*2.0+1.0;
    vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
  float fbm(vec3 p){
    float f=0.0, amp=0.5;
    for(int i=0;i<4;i++){ f+=amp*snoise(p); p*=2.0; amp*=0.5; }
    return f;
  }

  void main(){
    vec3 n=normalize(vNormal);
    float ndl=dot(n,normalize(uLightDir)); // <0 = night-facing
    vec3 sp=normalize(vPos)*2.0+vec3(uSeed*100.0);

    // --- Surface albedo (unlit) ---
    vec3 color;
    if(uIsGasGiant==1){
      // Latitudinal bands warped by noise — slow drift over time.
      float band=sin(vPos.y*0.6+fbm(sp*1.5+vec3(uTime*0.02,0.0,0.0))*1.5);
      color=mix(uBaseColor*0.8,uBaseColor*1.15,smoothstep(-0.3,0.3,band));
    } else {
      float elev=fbm(sp);
      float sea=uOceanLevel*1.6-0.8;            // map 0..1 coverage to threshold
      float land=smoothstep(sea-0.02,sea+0.02,elev);
      vec3 ground=mix(uBaseColor*0.7,uBaseColor*1.1,clamp(elev*0.5+0.5,0.0,1.0));
      // Vegetation in temperate low-lying land.
      ground=mix(ground,uVegColor,uVegetation*smoothstep(sea,sea+0.4,elev)*(1.0-smoothstep(0.5,0.8,elev)));
      vec3 surface=mix(uOceanColor,ground,land);
      // Polar ice caps by latitude + scattered frost.
      float lat=abs(normalize(vPos).y);
      float ice=smoothstep(1.0-uIceLevel,1.0-uIceLevel+0.12,lat);
      surface=mix(surface,uIceColor,ice);
      color=surface;
    }

    // --- Star lighting: Lambert day side + ambient floor + real terminator ---
    // The cosine falloff (max(ndl,0)) gives a physically real day/night line;
    // uAmbient keeps the night side legible without washing it out.
    float lambert=max(ndl,0.0);
    color*=uAmbient+(1.0-uAmbient)*lambert;

    // Atmospheric limb glow (Fresnel) — reads on the LIT limb, fades to night.
    // dayness softens across the terminator so the glow doesn't pop at the line.
    float dayness=smoothstep(-0.1,0.2,ndl);
    float rim=pow(1.0-max(normalize(vViewNormal).z,0.0),3.0);
    color+=uAtmColor*rim*uAtmDensity*0.6*dayness;

    gl_FragColor=vec4(color,1.0);
  }
`;

function uniformsFor(p: PlanetVisualParams) {
  return {
    uSeed: { value: p.seed },
    uTime: { value: 0 },
    uIsGasGiant: { value: p.isGasGiant ? 1 : 0 },
    uBaseColor: { value: new THREE.Vector3(...p.baseColor) },
    uOceanColor: { value: new THREE.Vector3(...p.oceanColor) },
    uIceColor: { value: new THREE.Vector3(...p.iceColor) },
    uVegColor: { value: new THREE.Vector3(...p.vegColor) },
    uAtmColor: { value: new THREE.Vector3(...p.atmosphereColor) },
    uOceanLevel: { value: p.oceanLevel },
    uIceLevel: { value: p.iceLevel },
    uVegetation: { value: p.vegetation },
    uAtmDensity: { value: p.atmosphereDensity },
    uLightDir: { value: new THREE.Vector3(0, 0, 1) },
    uAmbient: { value: AMBIENT_STARLIGHT },
  };
}

// Night-side floor: small enough that the terminator reads clearly, large enough
// that the dark hemisphere stays legible (not a pure-black silhouette). Tunable.
const AMBIENT_STARLIGHT = 0.05;

/** Build a procedural ShaderMaterial for a planet or gas giant. */
export function makePlanetMaterial(body: CelestialBody): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: uniformsFor(bodyToVisualParams(body)),
  });
}

/**
 * Refresh a planet material from live body state (so terraforming transforms the
 * globe) plus time and the body→star light direction. Cheap: writes uniforms.
 */
export function updatePlanetMaterial(
  material: THREE.ShaderMaterial,
  body: CelestialBody,
  timeSeconds: number,
  lightDir: THREE.Vector3,
): void {
  const p = bodyToVisualParams(body);
  const u = material.uniforms;
  u.uTime!.value = timeSeconds;
  (u.uBaseColor!.value as THREE.Vector3).set(...p.baseColor);
  (u.uAtmColor!.value as THREE.Vector3).set(...p.atmosphereColor);
  u.uOceanLevel!.value = p.oceanLevel;
  u.uIceLevel!.value = p.iceLevel;
  u.uVegetation!.value = p.vegetation;
  u.uAtmDensity!.value = p.atmosphereDensity;
  (u.uLightDir!.value as THREE.Vector3).copy(lightDir);
}
