/**
 * SkillMatrix3D.jsx — "THE SENTINEL" (section 04). Rebuilt from the ground up.
 *
 * WHY THE REBUILD
 *   The previous build lit the skull with a ~700-line hand-rolled faux-PBR
 *   shader that ignored every real scene light and had been re-tuned blind a
 *   dozen times without ever reading as metal. It sat on a static CSS gradient
 *   (the "frozen" backdrop), used AdaptiveDpr's `pixelated` mode (blocky frames
 *   whenever the GPU dipped) and baked ambient occlusion on the main thread
 *   mid-scroll.
 *
 * WHAT THIS IS INSTEAD
 *   - Real PBR: MeshPhysicalMaterial (gunmetal + clearcoat) under a procedural
 *     studio environment (drei Lightformers). Metal reads as metal on any GPU.
 *   - A LIVE stage: a drifting ember nebula backdrop, a perspective grid floor
 *     sliding toward the camera, a pooled floor glow and a rising ember field.
 *   - Boot: the Sentinel materialises bottom-to-top behind a gilded scan-line
 *     using a real clipping plane (no shader tricks), then the eyes ignite and
 *     `sentinel:online` fires on window (the HUD in main.js listens).
 *   - Interaction kept: weighted cursor look-at, heartbeat eyes that accelerate
 *     as you close in, orbiting skill words that decode inside the scanner,
 *     twin eye-lasers on click (a word = locked shot; empty stage = free shot
 *     that sweeps while the pointer is held).
 *
 * Mounted as a React island by skillMatrix3DIsland.jsx; the frameloop freezes
 * while #matrix is off-screen, so every per-frame dt is clamped on resume.
 */
import { useRef, useMemo, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Html, Environment, Lightformer } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { easing } from 'maath';
import * as THREE from 'three';
import gsap from 'gsap';
import { skillMatrix } from '../../data.js';

const SKULL_URL = '/models/skull.glb';
/* eye-socket anchors, measured from skull.glb in normalised stage space */
const EYE_L = [-0.389, -0.372, 1.02];
const EYE_R = [0.389, -0.372, 1.02];
/* the island freezes the frameloop off-screen; the first dt after resume can
   be seconds long, so every integrator below clamps to this */
const MAX_DT = 1 / 20;

const CRIMSON = new THREE.Color('#e63950');
const OXBLOOD = new THREE.Color('#8f0f22');
const GOLD = new THREE.Color('#d8ba7c');
const EYE_CORE = new THREE.Color('#ff8a4a');
const EYE_HALO = new THREE.Color('#b8101e');

const NODES = skillMatrix.flatMap((g) =>
  g.nodes.map((n) => ({ ...n, group: g.group, groupColor: g.color })),
);

/* ============================== textures ================================ */
function radialTexture(size, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const h = size / 2;
  const grad = g.createRadialGradient(h, h, 0, h, h, h);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
/* structured eye: searing pinpoint, hot falloff, a defined iris rim */
const makeEyeTexture = () => radialTexture(256, [
  [0.000, 'rgba(255,224,196,1)'], [0.025, 'rgba(255,178,130,0.98)'],
  [0.070, 'rgba(202,20,26,0.88)'], [0.145, 'rgba(132,3,14,0.58)'],
  [0.230, 'rgba(72,0,8,0.24)'], [0.285, 'rgba(176,8,20,0.34)'],
  [0.360, 'rgba(86,0,10,0.12)'], [0.540, 'rgba(48,0,6,0.025)'],
  [1.000, 'rgba(36,0,4,0)'],
]);
/* edgeless burst for muzzle flash + impact */
const makeBurstTexture = () => radialTexture(256, [
  [0.000, 'rgba(255,255,255,1)'], [0.030, 'rgba(255,240,224,0.92)'],
  [0.080, 'rgba(255,138,74,0.50)'], [0.170, 'rgba(255,34,26,0.22)'],
  [0.330, 'rgba(206,8,14,0.085)'], [0.560, 'rgba(146,2,8,0.028)'],
  [0.780, 'rgba(105,0,6,0.007)'], [1.000, 'rgba(86,0,5,0)'],
]);
/* plain soft disc — floor glow + scan line */
const makeSoftTexture = () => radialTexture(128, [
  [0.0, 'rgba(255,255,255,0.95)'], [0.25, 'rgba(255,255,255,0.40)'],
  [0.6, 'rgba(255,255,255,0.07)'], [1.0, 'rgba(255,255,255,0)'],
]);

/* ============================ eye rhythm ================================ */
function heartbeat(t, threat = 0) {
  const period = 1.15 - threat * 0.66;
  const x = (t % period) / period;
  const b1 = Math.exp(-Math.pow((x - 0.06) * 9.0, 2.0));
  const b2 = Math.exp(-Math.pow((x - 0.30) * 12.0, 2.0)) * 0.55;
  return 0.30 + threat * 0.42 + b1 + b2;
}
function flicker(t) {
  const n = Math.sin(t * 47.0) * Math.sin(t * 113.0 + 1.3);
  return n > 0.93 ? 0.32 : 0.9 + 0.1 * Math.sin(t * 30.0);
}

/* ============================ shared stores =============================
   Plain mutable objects, written and read inside useFrame — zero React state
   churn per frame. */
function makeMouse() {
  return {
    ndc: new THREE.Vector2(0, 0),
    smoothNdc: new THREE.Vector2(0, 0),
    px: new THREE.Vector2(0, 0),
    threat: 0,
    lastMove: 0,
  };
}
function makeBeams() {
  return {
    eyeL: new THREE.Vector3(), eyeR: new THREE.Vector3(),
    target: new THREE.Vector3(), targetObj: null,
    firing: false, mode: 'lock', sustain: false,
    t: 0, charge: 0, strike: 0, recoil: 0,
    hoverCount: 0, reduced: false,
  };
}
function makeBoot() {
  return { k: 0, scan: -2.1, rotY: -0.55, eyes: 0, done: false };
}

const BEAM_MODE = {
  lock: { charge: 0.16, travel: 0.10, hold: 0.50, radius: 0.140, glow: 1.85, light: 30, recoil: 1.25, flare: 0.62 },
  free: { charge: 0.05, travel: 0.06, hold: 0.16, radius: 0.090, glow: 1.78, light: 16, recoil: 0.6, flare: 0.42 },
};
const BEAM_DECAY = 0.26;
const BEAM_UP = new THREE.Vector3(0, 1, 0);

/* ============================ pointer rig ===============================
   Damps the pointer, derives threat (cursor closing on the face), auto-roams
   when idle so the stage never dies on touch devices, and gives the camera a
   whisper of parallax so the whole stage has depth under the hand. */
function PointerRig({ mouse }) {
  const { size, camera } = useThree();
  const t = useRef(0);
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, MAX_DT);
    t.current += dt;
    const p = state.pointer;
    if (Math.abs(p.x - mouse.ndc.x) > 0.0008 || Math.abs(p.y - mouse.ndc.y) > 0.0008) {
      mouse.lastMove = t.current;
    }
    let nx = p.x, ny = p.y;
    if (t.current - mouse.lastMove > 2.5) {
      nx = Math.sin(t.current * 0.45) * 0.7;
      ny = Math.cos(t.current * 0.33) * 0.55;
    }
    mouse.ndc.set(nx, ny);
    easing.damp2(mouse.smoothNdc, mouse.ndc, 0.16, dt);
    mouse.px.set(
      (mouse.smoothNdc.x * 0.5 + 0.5) * size.width,
      (mouse.smoothNdc.y * 0.5 + 0.5) * size.height,
    );
    const closeness = 1 - Math.min(mouse.smoothNdc.length() / 0.85, 1);
    mouse.threat = THREE.MathUtils.damp(mouse.threat, closeness, 3.2, dt);

    easing.damp3(camera.position,
      [mouse.smoothNdc.x * 0.42, 0.1 + mouse.smoothNdc.y * 0.26, 10.5], 0.6, dt);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/* ============================ backdrop ==================================
   Ember nebula on a plane behind everything. Two fbm layers drift slowly,
   a warm pool follows the cursor, a crimson core breathes behind the skull. */
const BACKDROP_VERT = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const BACKDROP_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime, uThreat, uBoot, uAspect;
  uniform vec2 uMouse;
  varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p){
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return v;
  }
  void main(){
    vec2 c = vUv - 0.5; c.x *= uAspect;
    float t = uTime * 0.035;
    float n1 = fbm(vUv * vec2(3.0 * uAspect, 3.0) + vec2(t, -t * 0.6));
    float n2 = fbm(vUv * vec2(5.5 * uAspect, 5.5) - vec2(t * 0.5, t * 0.3) + n1 * 0.9);
    float neb = smoothstep(0.30, 0.90, n1 * 0.6 + n2 * 0.55);
    vec3 col = vec3(0.014, 0.012, 0.017);
    col += vec3(0.28, 0.03, 0.06) * neb * 0.50;
    col += vec3(0.80, 0.30, 0.10) * pow(neb, 3.0) * 0.30;
    col += vec3(0.85, 0.72, 0.45) * pow(n2, 5.0) * 0.14;
    float r = length(c);
    float breath = 0.85 + 0.15 * sin(uTime * 0.9);
    col += vec3(0.40, 0.05, 0.09) * exp(-r * r * 3.0) * (0.55 + uThreat * 0.45) * breath;
    vec2 m = uMouse * vec2(uAspect, 1.0) * 0.5;
    float dm = length(c - m);
    col += vec3(0.55, 0.36, 0.16) * exp(-dm * dm * 7.0) * 0.14;
    float dust = pow(noise(vUv * vec2(220.0 * uAspect, 220.0)), 26.0);
    col += vec3(0.9, 0.85, 0.75) * dust * 0.5;
    col *= 1.0 - smoothstep(0.30, 0.92, r) * 0.88;
    col *= uBoot;
    gl_FragColor = vec4(col, 1.0);
  }
`;
function Backdrop({ mouse, boot }) {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uThreat: { value: 0 }, uBoot: { value: 0 },
    uAspect: { value: 1.7 }, uMouse: { value: new THREE.Vector2() },
  }), []);
  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uThreat.value = mouse.threat;
    uniforms.uBoot.value = boot.k;
    uniforms.uMouse.value.copy(mouse.smoothNdc);
  });
  return (
    <mesh position={[0, 0, -7]} frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[34, 20]} />
      <shaderMaterial uniforms={uniforms} vertexShader={BACKDROP_VERT}
        fragmentShader={BACKDROP_FRAG} depthWrite={false} />
    </mesh>
  );
}

/* ============================ grid floor ================================
   Perspective grid sliding toward the camera; lines fade with distance and
   stay calm directly under the skull. Screen-space derivative line width so
   it is exactly one pixel wide at any distance — no moiré. */
const GRID_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main(){
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const GRID_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime, uBoot, uThreat;
  varying vec3 vWorld;
  void main(){
    vec2 g = vWorld.xz * 0.8;
    g.y += uTime * 0.22;
    vec2 f = abs(fract(g - 0.5) - 0.5) / fwidth(g);
    float line = 1.0 - min(min(f.x, f.y), 1.0);
    float d = length(vWorld.xz);
    float fade = exp(-d * 0.15) * smoothstep(0.4, 2.6, d);
    vec3 col = mix(vec3(0.85, 0.72, 0.45), vec3(0.90, 0.22, 0.31), smoothstep(1.0, 7.0, d));
    float a = line * fade * (0.30 + uThreat * 0.18) * uBoot;
    gl_FragColor = vec4(col * a, a);
  }
`;
function GridFloor({ mouse, boot }) {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uBoot: { value: 0 }, uThreat: { value: 0 },
  }), []);
  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uBoot.value = boot.k;
    uniforms.uThreat.value = mouse.threat;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.1, -4]} frustumCulled={false} renderOrder={-5}>
      <planeGeometry args={[40, 34]} />
      <shaderMaterial uniforms={uniforms} vertexShader={GRID_VERT} fragmentShader={GRID_FRAG}
        transparent depthWrite={false} blending={THREE.AdditiveBlending}
        extensions={{ derivatives: true }} />
    </mesh>
  );
}

/* pooled crimson light under the Sentinel — sells the floor as a floor */
function FloorGlow({ boot, tex }) {
  const ref = useRef();
  useFrame((state) => {
    if (!ref.current) return;
    const b = 0.9 + 0.1 * Math.sin(state.clock.elapsedTime * 0.9);
    ref.current.material.opacity = 0.42 * boot.k * b;
  });
  return (
    <sprite ref={ref} position={[0, -1.95, 0]} scale={[6, 1.8, 1]} renderOrder={-4}>
      <spriteMaterial map={tex} color={OXBLOOD} transparent opacity={0} depthWrite={false}
        blending={THREE.AdditiveBlending} toneMapped={false} />
    </sprite>
  );
}

/* ============================ the skull =================================*/
function Skull({ mouse, beams, boot, booted, softTex }) {
  const { scene } = useGLTF(SKULL_URL);
  const group = useRef();
  const scanRef = useRef();
  const eyeRefs = useRef([{}, {}]);
  const innerLight = useRef();
  const hellLight = useRef();
  const eyeTex = useMemo(makeEyeTexture, []);

  const { object, material, clipPlane, crack } = useMemo(() => {
    const root = scene.clone(true);
    // world-space clip: everything ABOVE constant is cut away during boot
    const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), -2.1);

    /* mesh-local bounds — the fissure field is normalised to the model so the
       crack density is identical no matter how the GLB was exported */
    const gbox = new THREE.Box3();
    root.traverse((o) => {
      if (o.isMesh) {
        o.geometry.computeBoundingBox();
        gbox.union(o.geometry.boundingBox);
      }
    });
    const gsize = new THREE.Vector3();
    const gcenter = new THREE.Vector3();
    gbox.getSize(gsize);
    gbox.getCenter(gcenter);
    const crack = {
      uTime: { value: 0 },
      uThreat: { value: 0 },
      uHeat: { value: 0 },          // boot.eyes — the fissures only burn once the core is lit
      uCenter: { value: gcenter },
      uInvScale: { value: 3.0 / Math.max(gsize.x, gsize.y, gsize.z, 1e-6) },
    };

    /* BLACKENED BONE, NOT CHROME. Dark, rough, barely any clearcoat; the
       environment only kisses the high points. The menace comes from what is
       injected below: a network of fissures with red light burning behind
       them, corrosion that kills the finish in patches, and a crimson emissive
       floor that breathes with the heartbeat. */
    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#17161c'),
      metalness: 0.72,
      roughness: 0.58,
      clearcoat: 0.18,
      clearcoatRoughness: 0.55,
      envMapIntensity: 0.85,
      emissive: new THREE.Color('#2a040a'),
      emissiveIntensity: 0.5,
      clippingPlanes: [clipPlane],
    });
    /* Fissures are injected into three's own physical shader rather than
       written as a standalone material: the real lighting, env reflections,
       clearcoat and tone-mapping all stay intact, and we only add an emissive
       term + a roughness/albedo modulation on top. */
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, crack);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>',
          '#include <common>\nvarying vec3 vFissure;\nuniform vec3 uCenter;\nuniform float uInvScale;')
        .replace('#include <begin_vertex>',
          '#include <begin_vertex>\nvFissure = (position - uCenter) * uInvScale * 3.0;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', /* glsl */ `#include <common>
          varying vec3 vFissure;
          uniform float uTime, uThreat, uHeat;
          float fhash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
          float fnoise(vec3 p){
            vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(fhash(i), fhash(i + vec3(1,0,0)), f.x), mix(fhash(i + vec3(0,1,0)), fhash(i + vec3(1,1,0)), f.x), f.y),
                       mix(mix(fhash(i + vec3(0,0,1)), fhash(i + vec3(1,0,1)), f.x), mix(fhash(i + vec3(0,1,1)), fhash(i + vec3(1,1,1)), f.x), f.y), f.z);
          }`)
        // corrosion: the finish is dead in patches, so nothing reads as showroom
        .replace('#include <roughnessmap_fragment>', /* glsl */ `#include <roughnessmap_fragment>
          float corr = fnoise(vFissure * 9.0) * 0.6 + fnoise(vFissure * 23.0) * 0.4;
          roughnessFactor = clamp(roughnessFactor + corr * 0.38, 0.0, 1.0);`)
        // fissures: iso-contour of a 3D noise field, one pixel wide at any
        // distance (screen-space derivative), with a soft halo of red light
        // bleeding out of every crack and a white-hot filament in the deepest
        .replace('#include <emissivemap_fragment>', /* glsl */ `#include <emissivemap_fragment>
          float dmg = fnoise(vFissure * 3.0) * 0.62 + fnoise(vFissure * 7.0) * 0.38;
          float dw = clamp(fwidth(dmg), 0.0025, 0.018);
          float sdist = abs(dmg - 0.5) / dw;
          float crackBand = 1.0 - smoothstep(0.0, 2.2, sdist);
          float crack = crackBand * crackBand;
          float bleedBand = 1.0 - smoothstep(0.0, 9.0, sdist);
          float bleed = bleedBand * bleedBand * 0.25;
          float breath = 0.55 + 0.45 * sin(uTime * 1.25 + dmg * 18.0);
          float heat = (0.45 + uThreat * 0.85) * (0.5 + 0.5 * breath) * uHeat;
          diffuseColor.rgb *= 1.0 - crack * 0.7 - corr * 0.25;
          totalEmissiveRadiance += vec3(0.55, 0.03, 0.05) * bleed * heat * 1.5;
          totalEmissiveRadiance += vec3(1.00, 0.10, 0.08) * crack * (0.6 + heat * 1.8);
          totalEmissiveRadiance += vec3(1.90, 0.62, 0.18) * pow(crack, 3.0) * heat * 1.4;`);
    };

    root.traverse((o) => {
      if (o.isMesh) {
        if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
        o.material = material;
        o.frustumCulled = false;
      }
    });
    // centre + normalise so any skull.glb fits the stage (3 units tall)
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const scl = 3.0 / Math.max(size.x, size.y, size.z);
    root.position.sub(center.multiplyScalar(scl));
    root.scale.setScalar(scl);
    return { object: root, material, clipPlane, crack };
  }, [scene]);

  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => eyeTex.dispose(), [eyeTex]);

  /* BOOT — backdrop fades up, the scan-line climbs and the metal materialises
     behind it, the head swings to face you, then the eyes ignite. */
  useEffect(() => {
    if (!booted) return undefined;
    const online = () => {
      boot.done = true;
      window.dispatchEvent(new CustomEvent('sentinel:online'));
    };
    if (beams.reduced) {
      boot.k = 1; boot.scan = 2.2; boot.rotY = 0; boot.eyes = 1;
      online();
      return undefined;
    }
    const tl = gsap.timeline({ onComplete: online });
    tl.to(boot, { k: 1, duration: 1.4, ease: 'power2.out' }, 0)
      .to(boot, { scan: 2.2, duration: 2.0, ease: 'power2.inOut' }, 0.2)
      .to(boot, { rotY: 0, duration: 2.4, ease: 'expo.out' }, 0.2)
      .to(boot, { eyes: 1, duration: 0.5, ease: 'power3.in' }, 1.85);
    return () => tl.kill();
  }, [booted, beams, boot]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, MAX_DT);
    const t = state.clock.elapsedTime;
    const threat = mouse.threat;

    // clipping + scan-line (a constant far above the model = no clipping,
    // without touching the plane count and forcing a shader recompile)
    clipPlane.constant = boot.done ? 100 : boot.scan;
    if (scanRef.current) {
      const live = !boot.done && boot.scan > -2.0 && boot.scan < 2.1;
      scanRef.current.visible = live;
      if (live) scanRef.current.position.y = boot.scan;
    }

    if (group.current) {
      const g = group.current;
      g.position.y = Math.sin(t * 0.8) * 0.07;
      const targetRY = mouse.smoothNdc.x * 0.5 + boot.rotY;
      const targetRX = -mouse.smoothNdc.y * 0.32;
      easing.dampE(g.rotation, [targetRX, targetRY, 0], 0.35, dt);
      const lean = 1 + threat * 0.055;
      easing.damp3(g.scale, [lean, lean, lean], 0.4, dt);
      easing.damp(g.position, 'z', beams.recoil * 0.3, 0.12, dt);
    }

    const charge = beams.charge;
    const intensity = (heartbeat(t, threat) * flicker(t) * (1 + threat * 0.8)
                    + charge * charge * 6.0) * boot.eyes;
    for (let ei = 0; ei < 2; ei++) {
      const e = eyeRefs.current[ei];
      const base = ei === 0 ? EYE_L : EYE_R;
      if (e.root) {
        e.root.position.set(
          base[0] + mouse.smoothNdc.x * 0.018,
          base[1] + mouse.smoothNdc.y * 0.012,
          base[2],
        );
        e.root.getWorldPosition(ei === 0 ? beams.eyeL : beams.eyeR);
      }
      if (e.core) {
        e.core.visible = boot.eyes > 0.01;
        e.core.material.color.copy(EYE_CORE).multiplyScalar(1.6 + intensity * 2.6);
        e.core.scale.setScalar(0.5 + Math.min(intensity, 3.2) * 0.075 + charge * 0.2);
      }
      if (e.aura) {
        e.aura.material.opacity = (0.16 + Math.min(intensity, 3.6) * 0.15) * boot.eyes;
        const sx = 0.54 + Math.min(intensity, 3.6) * 0.07 + threat * 0.055;
        const sy = 0.255 + Math.min(intensity, 3.6) * 0.033 + threat * 0.025;
        e.aura.scale.set(sx, sy, 1);
      }
      if (e.light) e.light.intensity = intensity * 2.4;
    }
    if (innerLight.current) {
      innerLight.current.intensity = (2.5 + heartbeat(t, threat) * (4 + threat * 4)) * boot.eyes;
    }
    material.emissiveIntensity = 0.3 + heartbeat(t, threat) * 0.22 * boot.eyes;
    // fissures breathe with the same heart
    crack.uTime.value = t;
    crack.uThreat.value = threat;
    crack.uHeat.value = boot.eyes;
    // HELLFIRE from below — light a face from underneath and it stops being a
    // face. Beats with the heart, flares as you close in.
    if (hellLight.current) {
      hellLight.current.intensity = (26 + heartbeat(t, threat) * 24 * (1 + threat)) * boot.eyes;
    }
  });

  return (
    <>
      <group ref={group}>
        <primitive object={object} />
        {/* crown blades — share the bone material so they fissure and burn with it */}
        {[-1, 1].map((side) => (
          <group key={`crown-${side}`} scale={[side, 1, 1]}>
            <mesh position={[0.73, 0.86, -0.02]} rotation={[-0.16, 0.05, -0.58]} material={material}>
              <coneGeometry args={[0.16, 1.12, 5]} />
            </mesh>
            <mesh position={[0.91, 0.23, 0.02]} rotation={[0.02, 0.08, -0.93]} material={material}>
              <coneGeometry args={[0.10, 0.74, 4]} />
            </mesh>
            <mesh position={[0.48, -0.76, 0.24]} rotation={[0.25, 0.1, -2.25]} material={material}>
              <coneGeometry args={[0.07, 0.48, 4]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 1.12, -0.08]} rotation={[0, 0, Math.PI]} material={material}>
          <coneGeometry args={[0.11, 0.72, 5]} />
        </mesh>
        <pointLight ref={innerLight} position={[0, 0.05, -0.15]} color={OXBLOOD}
          intensity={0} distance={5} decay={2} />
        {[EYE_L, EYE_R].map((p, i) => (
          <group key={i} position={p} ref={(m) => { if (m) eyeRefs.current[i].root = m; }}>
            <sprite ref={(m) => { if (m) eyeRefs.current[i].aura = m; }}
              scale={[0.85, 0.85, 1]} renderOrder={30}>
              <spriteMaterial map={eyeTex} color="#ffffff" transparent opacity={0}
                depthTest={false} depthWrite={false}
                blending={THREE.AdditiveBlending} toneMapped={false} />
            </sprite>
            <mesh ref={(m) => { if (m) eyeRefs.current[i].core = m; }} renderOrder={32} visible={false}>
              <sphereGeometry args={[0.052, 18, 18]} />
              <meshBasicMaterial color={EYE_CORE} transparent depthTest={false}
                depthWrite={false} toneMapped={false} />
            </mesh>
            <pointLight ref={(m) => { if (m) eyeRefs.current[i].light = m; }}
              color={EYE_HALO} intensity={0} distance={4} decay={2} />
          </group>
        ))}
      </group>

      {/* gilded scan-line riding the clipping plane while the metal forms */}
      <group ref={scanRef} position={[0, -2.1, 0.4]} visible={false}>
        <mesh renderOrder={28}>
          <planeGeometry args={[4.6, 0.8]} />
          <meshBasicMaterial map={softTex} color={OXBLOOD} transparent opacity={0.6}
            depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
        <mesh renderOrder={29}>
          <planeGeometry args={[4.0, 0.035]} />
          <meshBasicMaterial map={softTex} color={GOLD} transparent opacity={1}
            depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      </group>

      {/* hellfire uplight — the oldest horror trick there is */}
      <pointLight ref={hellLight} position={[0, -3.4, 1.6]} color={CRIMSON}
        intensity={0} distance={9} decay={2} />
    </>
  );
}

/* ============================ ember field ===============================
   Embers rise on convection, weave on their own sine and flicker out of
   phase. Threat spins the swarm tighter; the scanner ignites what it sweeps. */
const PTS = 650;
function Embers({ mouse, boot }) {
  const { positions, seeds } = useMemo(() => {
    const positions = new Float32Array(PTS * 3);
    const seeds = new Float32Array(PTS);
    for (let i = 0; i < PTS; i++) {
      const inner = Math.random() < 0.30;
      const r = inner ? 1.55 + Math.random() * 0.60 : 1.9 + Math.random() * 2.8;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 2 - 1);
      positions[i * 3] = r * Math.sin(ph) * Math.cos(th);
      positions[i * 3 + 1] = r * Math.cos(ph) * 0.65;
      positions[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      seeds[i] = Math.random();
    }
    return { positions, seeds };
  }, []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uBoot: { value: 0 },
    uMouse: { value: new THREE.Vector2() }, uThreat: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) }, uRadius: { value: 240 },
    uRed: { value: CRIMSON.clone() },
    uAmber: { value: new THREE.Color('#e8892c') },
    uGold: { value: new THREE.Color('#cfb87c') },
    uSize: { value: 3.0 },
  }), []);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uBoot.value = boot.k;
    uniforms.uRes.value.set(state.size.width, state.size.height);
    uniforms.uMouse.value.copy(mouse.px);
    uniforms.uThreat.value = mouse.threat;
    uniforms.uRadius.value = Math.min(state.size.width, state.size.height) * 0.34;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
      </bufferGeometry>
      <shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          uniform float uTime, uBoot, uRadius, uThreat, uSize;
          uniform vec2 uMouse, uRes;
          attribute float aSeed;
          varying float vHeat;
          varying float vFlick;
          void main(){
            vec3 p = position;
            float rise = uTime * (0.12 + uThreat * 0.30 + aSeed * 0.08);
            p.y += mod(rise * (0.65 + aSeed * 0.45), 4.8) - 2.4;
            p.y += sin(uTime * 0.5 + aSeed * 20.0) * 0.14;
            p.x += cos(uTime * 0.43 + aSeed * 17.0) * 0.14;
            p.z += sin(uTime * 0.55 + aSeed * 23.0) * 0.14;
            float spin = uThreat * uTime * 0.9;
            float cs = cos(spin * aSeed), sn = sin(spin * aSeed);
            p.xz = mat2(cs, sn, -sn, cs) * p.xz;
            float burst = (1.0 - uBoot) * (2.0 + aSeed * 3.0);
            p += normalize(p) * burst * 0.9;
            p.y += burst * (aSeed - 0.5) * 0.6;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            vec4 clip = projectionMatrix * mv;
            vec2 screen = (clip.xy / clip.w * 0.5 + 0.5) * uRes;
            float d = distance(screen, uMouse);
            float hit = 1.0 - smoothstep(uRadius * 0.35, uRadius, d);
            float jitter = sin(uTime * 55.0 + aSeed * 50.0);
            p += normalize(p) * hit * jitter * 0.08;
            mv = modelViewMatrix * vec4(p, 1.0);
            mv.z += hit * (0.5 + uThreat * 0.5);
            vHeat = hit * (0.25 + uThreat * 0.40);
            vFlick = 0.65 + 0.35 * sin(uTime * (6.0 + aSeed * 18.0) + aSeed * 40.0);
            gl_Position = projectionMatrix * mv;
            float boot = clamp(uBoot, 0.0, 1.0);
            gl_PointSize = mix(0.4, uSize + hit * (2.5 + uThreat * 1.5), boot) * (300.0 / -mv.z);
          }
        `}
        fragmentShader={/* glsl */ `
          precision mediump float;
          uniform vec3 uRed, uAmber, uGold;
          varying float vHeat;
          varying float vFlick;
          void main(){
            vec2 c = gl_PointCoord - 0.5;
            float d2 = dot(c, c);
            float a = smoothstep(0.5, 0.02, sqrt(d2));
            float r = sqrt(d2) * 2.0;
            vec3 col = mix(uRed, uAmber, smoothstep(0.3, 0.55, 1.0 - r));
            col = mix(col, uGold * 1.6, smoothstep(0.85, 0.98, 1.0 - r));
            col *= mix(0.06, 1.0, vHeat * 0.8 + 0.2);
            col *= vFlick;
            a *= mix(0.18, 0.95, vHeat + 0.22);
            gl_FragColor = vec4(col, a);
          }
        `}
      />
    </points>
  );
}

/* gliding gold key light — the metal catches a moving highlight under the hand */
function FollowLight({ mouse }) {
  const ref = useRef();
  const target = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, MAX_DT);
    target.set(mouse.smoothNdc.x * 4.6, mouse.smoothNdc.y * 3.0, 5.0);
    if (ref.current) easing.damp3(ref.current.position, target, 0.28, dt);
  });
  return <pointLight ref={ref} color={GOLD} intensity={55} distance={20} decay={2} />;
}

/* ========================= orbiting skill words =========================*/
const GLYPHS = '!<>-_\\/[]{}—=+*^?#01';
const randGlyph = (seed) => GLYPHS[(seed * GLYPHS.length) | 0];

function nodeLayout(n, total, seed) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (n / (total - 1)) * 2;
  const r = Math.sqrt(1 - y * y);
  const theta = golden * n + seed * 0.6;
  const radius = 4.35 + (seed - 0.5) * 1.45;
  return new THREE.Vector3(
    Math.cos(theta) * r * radius,
    y * radius * 0.62,
    Math.sin(theta) * r * radius,
  );
}

function SkillLabel({ node, index, total, mouse, beams }) {
  const groupRef = useRef();
  const nodeRef = useRef();
  const nameRef = useRef();
  const [hovered, setHovered] = useState(false);
  const lastOpacity = useRef(-1);
  const strikeTimer = useRef(0);
  const decoded = useRef(0);
  const lastReveal = useRef(false);
  const lastSettled = useRef(-1);

  const pos = useMemo(
    () => nodeLayout(index, total, (Math.sin(index * 91.7) * 0.5 + 0.5)),
    [index, total],
  );
  const projected = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.getWorldPosition(projected);
    const worldZ = projected.z;
    projected.project(state.camera);
    const sx = (projected.x * 0.5 + 0.5) * state.size.width;
    const syTop = (-projected.y * 0.5 + 0.5) * state.size.height;
    const d = Math.hypot(sx - mouse.px.x, (state.size.height - syTop) - mouse.px.y);
    const radius = Math.min(state.size.width, state.size.height) * 0.34;
    const inScanner = d < radius * 1.05 && projected.z < 1;
    const active = inScanner || hovered;

    if (active !== lastReveal.current) {
      lastReveal.current = active;
      gsap.to(decoded, {
        current: active ? 1 : 0,
        duration: active ? 0.45 : 0.3,
        ease: active ? 'power3.out' : 'power1.in',
        overwrite: true,
      });
    }

    const p = decoded.current;
    if (nameRef.current) {
      if (p > 0.001 && p < 0.999) {
        lastSettled.current = -1;
        const name = node.name;
        const shown = Math.floor(name.length * p);
        let out = '';
        for (let i = 0; i < name.length; i++) {
          out += (i < shown || name[i] === ' ') ? name[i] : randGlyph(Math.random());
        }
        nameRef.current.textContent = out;
      } else if (lastSettled.current !== p) {
        nameRef.current.textContent = node.name;
        lastSettled.current = p;
      }
    }
    if (nodeRef.current) {
      // words orbiting BEHIND the skull dim hard instead of painting over it
      const behind = worldZ < 1.35;
      const overSkull = Math.abs(projected.x) < 0.20 && Math.abs(projected.y) < 0.30;
      const occluded = behind && overSkull && !hovered;
      let o = 0.18 + p * 0.82;
      if (occluded) o *= 0.12;
      o = Math.round(o * 100) / 100;
      if (o !== lastOpacity.current) {
        lastOpacity.current = o;
        nodeRef.current.style.opacity = String(o);
      }
    }
  });

  const fire = () => {
    if (!groupRef.current) return;
    beams.targetObj = groupRef.current;
    groupRef.current.getWorldPosition(beams.target);
    beams.mode = 'lock';
    beams.sustain = false;
    beams.firing = true;
    beams.t = 0;
    const cfg = BEAM_MODE.lock;
    const delay = beams.reduced ? 120 : (cfg.charge + cfg.travel) * 1000;
    window.clearTimeout(strikeTimer.current);
    strikeTimer.current = window.setTimeout(() => {
      const el = nodeRef.current;
      if (!el) return;
      el.classList.remove('is-struck');
      void el.offsetWidth;
      el.classList.add('is-struck');
      strikeTimer.current = window.setTimeout(() => {
        if (nodeRef.current) nodeRef.current.classList.remove('is-struck');
      }, 700);
    }, delay);
  };

  useEffect(() => () => {
    window.clearTimeout(strikeTimer.current);
    if (hovered) beams.hoverCount = Math.max(0, beams.hoverCount - 1);
  }, [hovered, beams]);

  return (
    <group position={pos} ref={groupRef}>
      <Html center distanceFactor={9} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div
          ref={nodeRef}
          className={`sentinel-node${hovered ? ' is-hot' : ''}`}
          style={{ opacity: 0.18, transition: 'opacity .15s linear' }}
          role="button"
          tabIndex={0}
          aria-label={`Target ${node.name}`}
          onPointerEnter={() => { setHovered(true); beams.hoverCount += 1; }}
          onPointerLeave={() => { setHovered(false); beams.hoverCount = Math.max(0, beams.hoverCount - 1); }}
          onClick={fire}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            fire();
          }}
        >
          <span ref={nameRef} className="sentinel-node-name">{node.name}</span>
        </div>
      </Html>
    </group>
  );
}

function OrbitingSkills({ mouse, beams }) {
  const group = useRef();
  const spin = useRef(0.07);
  useFrame((_, rawDt) => {
    if (!group.current) return;
    const dt = Math.min(rawDt, MAX_DT);
    const held = beams.hoverCount > 0 || (beams.firing && beams.mode === 'lock');
    spin.current = THREE.MathUtils.damp(spin.current, held ? 0 : 0.07, 6, dt);
    group.current.rotation.y += dt * spin.current;
  });
  return (
    <group ref={group}>
      {NODES.map((node, i) => (
        <SkillLabel key={node.name} node={node} index={i} total={NODES.length}
          mouse={mouse} beams={beams} />
      ))}
    </group>
  );
}

/* ============================ eye beams =================================
   Twin lances from the sockets to the target. Idle cost is one branch: both
   lances share a geometry + material, sit invisible, and the frame callback
   returns immediately until a shot is queued. Nothing allocates while firing. */
function EyeBeams({ beams }) {
  const leftRef = useRef();
  const rightRef = useRef();
  const glowL = useRef();
  const glowR = useRef();
  const flareRefs = useRef([null, null]);
  const impactRef = useRef();
  const impactSoftRef = useRef();
  const lightRef = useRef();

  const burstTex = useMemo(makeBurstTexture, []);
  const geom = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 20, 1, true), []);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uProgress: { value: 0 }, uEnergy: { value: 0 }, uCrackle: { value: 1 },
    uCore: { value: new THREE.Color('#ffe4d2') },
    uEdge: { value: new THREE.Color('#ff0812') },
  }), []);

  const BEAM_VERT = /* glsl */ `
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){
      vUv = uv;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal);
      vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }
  `;
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    vertexShader: BEAM_VERT,
    fragmentShader: /* glsl */ `
      precision mediump float;
      uniform float uTime, uProgress, uEnergy, uCrackle;
      uniform vec3 uCore, uEdge;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float head = smoothstep(uProgress, uProgress - 0.075, vUv.y);
        float facing = pow(max(dot(normalize(vN), normalize(vV)), 0.0), 1.5);
        float crackle = 1.0 - uCrackle * 0.18 *
          (0.5 + 0.5 * sin(vUv.y * 120.0 - uTime * 70.0) * sin(vUv.y * 41.0 + uTime * 26.0));
        float muzzle = 1.0 + 1.15 * exp(-vUv.y * 14.0) + 0.7 * exp(-(1.0 - vUv.y) * 9.0);
        float taper = mix(1.0, 0.78, vUv.y);
        float a = facing * head * uEnergy * crackle * taper;
        float core = smoothstep(0.16, 0.72, facing);
        vec3 col = mix(uEdge * 1.15, uCore, core);
        col = mix(col, vec3(2.9, 1.02, 0.44), pow(core, 3.0) * 0.85);
        gl_FragColor = vec4(col * (0.8 + core * 4.8) * muzzle, min(a * (0.85 + core * 0.15) * muzzle, 1.0));
      }
    `,
  }), [uniforms]);

  const glowMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.FrontSide,
    vertexShader: BEAM_VERT,
    fragmentShader: /* glsl */ `
      precision mediump float;
      uniform float uTime, uProgress, uEnergy, uCrackle;
      uniform vec3 uEdge;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float head = smoothstep(uProgress, uProgress - 0.14, vUv.y);
        float f = max(dot(normalize(vN), normalize(vV)), 0.0);
        float body = pow(f, 2.2);
        float boil = 1.0 - uCrackle * 0.26 * (0.5 + 0.5 * sin(vUv.y * 26.0 - uTime * 17.0));
        float muzzle = 1.0 + 1.4 * exp(-vUv.y * 7.0);
        float a = body * head * uEnergy * boil * muzzle * 0.23;
        gl_FragColor = vec4(uEdge * (0.7 + body * 0.95) * muzzle, min(a, 0.34));
      }
    `,
  }), [uniforms]);

  useEffect(() => () => {
    mat.dispose(); glowMat.dispose(); geom.dispose(); burstTex.dispose();
  }, [mat, glowMat, geom, burstTex]);

  const dir = useMemo(() => new THREE.Vector3(), []);
  const mid = useMemo(() => new THREE.Vector3(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, MAX_DT);
    const b = beams;

    if (!b.firing) {
      if (b.charge > 0) b.charge = Math.max(0, b.charge - dt * 5);
      if (leftRef.current && leftRef.current.visible) {
        leftRef.current.visible = false;
        if (rightRef.current) rightRef.current.visible = false;
        if (glowL.current) glowL.current.visible = false;
        if (glowR.current) glowR.current.visible = false;
        for (let i = 0; i < 2; i++) if (flareRefs.current[i]) flareRefs.current[i].visible = false;
        if (impactRef.current) impactRef.current.visible = false;
        if (impactSoftRef.current) impactSoftRef.current.visible = false;
        if (lightRef.current) lightRef.current.intensity = 0;
      }
      return;
    }

    const cfg = BEAM_MODE[b.mode] || BEAM_MODE.lock;
    b.t += dt;
    if (b.sustain && b.t > cfg.charge + cfg.travel + cfg.hold) {
      b.t = cfg.charge + cfg.travel + cfg.hold;
    }
    if (b.targetObj) b.targetObj.getWorldPosition(b.target);

    const reduced = b.reduced;
    const t = b.t;
    const total = cfg.charge + cfg.travel + cfg.hold + BEAM_DECAY;
    let charge, progress, energy;
    if (t < cfg.charge) {
      charge = t / cfg.charge; progress = 0; energy = 0;
    } else if (!reduced && t < cfg.charge + cfg.travel) {
      charge = 1; progress = (t - cfg.charge) / cfg.travel; energy = 1;
    } else if (t < cfg.charge + cfg.travel + cfg.hold) {
      charge = 1; progress = 1; energy = 1;
    } else if (t < total) {
      const k = (t - cfg.charge - cfg.travel - cfg.hold) / BEAM_DECAY;
      charge = 1 - k; progress = 1; energy = 1 - k;
    } else {
      b.firing = false; b.t = 0; b.charge = 0; b.strike = 0; b.recoil = 0;
      b.sustain = false; b.targetObj = null;
      return;
    }

    b.charge = charge;
    b.strike = progress > 0.98 ? energy : 0;
    b.recoil = (energy > 0 ? -energy : charge * 0.4) * cfg.recoil;

    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uProgress.value = progress;
    uniforms.uEnergy.value = energy;
    uniforms.uCrackle.value = reduced ? 0 : 1;

    const on = energy > 0.001 && progress > 0.001;
    const refs = [leftRef.current, rightRef.current];
    const halos = [glowL.current, glowR.current];
    const origins = [b.eyeL, b.eyeR];
    for (let i = 0; i < 2; i++) {
      const m = refs[i];
      const s = halos[i];
      if (m) m.visible = on;
      if (s) s.visible = on;
      if (!on || !m) continue;
      dir.subVectors(b.target, origins[i]);
      const len = dir.length();
      if (len < 1e-4) continue;
      dir.divideScalar(len);
      quat.setFromUnitVectors(BEAM_UP, dir);
      m.quaternion.copy(quat);
      mid.copy(origins[i]).addScaledVector(dir, len * 0.5);
      m.position.copy(mid);
      const rad = cfg.radius * (0.7 + energy * 0.5);
      m.scale.set(rad, len, rad);
      if (s) {
        s.quaternion.copy(quat);
        s.position.copy(mid);
        const sr = rad * cfg.glow;
        s.scale.set(sr, len, sr);
      }
    }

    const muzzle = Math.max(charge * charge, energy) * (progress > 0 ? 1 : 0.55) * (1 - progress * 0.35);
    for (let i = 0; i < 2; i++) {
      const f = flareRefs.current[i];
      if (!f) continue;
      const lit = charge > 0.02 || on;
      f.visible = lit;
      if (!lit) continue;
      f.position.copy(origins[i]);
      const fs = (0.42 + muzzle * 1.15) * cfg.flare;
      f.scale.set(fs, fs, 1);
      f.material.opacity = Math.min(0.25 + muzzle * 0.85, 1);
    }

    const strike = b.strike;
    if (impactRef.current) {
      impactRef.current.visible = strike > 0.001;
      if (strike > 0.001) {
        impactRef.current.position.copy(b.target);
        const jitter = reduced ? 0 : Math.sin(state.clock.elapsedTime * 42) * 0.06;
        const s = 0.30 + strike * 0.46 + jitter;
        impactRef.current.scale.set(s, s, 1);
        impactRef.current.material.opacity = Math.min(0.72 + strike * 0.28, 1);
      }
    }
    if (impactSoftRef.current) {
      impactSoftRef.current.visible = strike > 0.001;
      if (strike > 0.001) {
        impactSoftRef.current.position.copy(b.target);
        const ss = 0.85 + (1 - strike) * 1.5;
        impactSoftRef.current.scale.set(ss, ss, 1);
        impactSoftRef.current.material.opacity = strike * 0.38;
      }
    }
    if (lightRef.current) {
      lightRef.current.position.copy(b.target);
      lightRef.current.intensity = strike * cfg.light;
    }
  });

  return (
    <>
      <mesh ref={glowL} geometry={geom} material={glowMat} renderOrder={39} frustumCulled={false} visible={false} />
      <mesh ref={glowR} geometry={geom} material={glowMat} renderOrder={39} frustumCulled={false} visible={false} />
      <mesh ref={leftRef} geometry={geom} material={mat} renderOrder={40} frustumCulled={false} visible={false} />
      <mesh ref={rightRef} geometry={geom} material={mat} renderOrder={40} frustumCulled={false} visible={false} />
      {[0, 1].map((i) => (
        <sprite key={i} ref={(m) => { flareRefs.current[i] = m; }} renderOrder={43} visible={false}>
          <spriteMaterial map={burstTex} color="#ffe6d4" transparent opacity={0}
            depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      ))}
      <sprite ref={impactSoftRef} renderOrder={41} visible={false}>
        <spriteMaterial map={burstTex} color="#ff1410" transparent opacity={0}
          depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      <sprite ref={impactRef} renderOrder={42} visible={false}>
        <spriteMaterial map={burstTex} color="#ffe0c4" transparent opacity={0}
          depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      <pointLight ref={lightRef} color="#ff1a14" intensity={0} distance={7} decay={2} />
    </>
  );
}

/* ============================ free fire =================================
   Click anywhere on the stage to fire; hold and drag to sweep. The hit is
   resolved against a plane through the Sentinel with a rect measured fresh
   on every event, so smooth-scroll never desyncs the impact from the cursor. */
function FreeFire({ beams }) {
  const { camera, gl } = useThree();
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const el = gl.domElement;
    const resolve = (ev) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.ray.intersectPlane(plane, hit) ? hit : null;
    };
    const onDown = (ev) => {
      if (ev.button !== undefined && ev.button !== 0) return;
      if (ev.target && ev.target.closest && ev.target.closest('.sentinel-node')) return;
      const p = resolve(ev);
      if (!p) return;
      beams.targetObj = null;
      beams.target.copy(p);
      beams.mode = 'free';
      beams.sustain = true;
      beams.firing = true;
      beams.t = 0;
    };
    const onMove = (ev) => {
      if (!beams.sustain) return;
      const p = resolve(ev);
      if (p) beams.target.copy(p);
    };
    const release = () => { beams.sustain = false; };

    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [beams, camera, gl, ndc, ray, plane, hit]);

  return null;
}

/* ============================ post ======================================*/
function Effects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom intensity={1.0} luminanceThreshold={0.55} luminanceSmoothing={0.4} mipmapBlur />
      <Vignette eskil={false} offset={0.18} darkness={0.9} />
    </EffectComposer>
  );
}

/* ============================ scene =====================================*/
function Scene({ mouse, beams, boot, booted }) {
  const softTex = useMemo(makeSoftTexture, []);
  useEffect(() => () => softTex.dispose(), [softTex]);
  return (
    <>
      <PointerRig mouse={mouse} />
      <color attach="background" args={['#050507']} />
      <ambientLight intensity={0.12} />
      {/* a dim cold key from above so the dome still has form, and a HOT crimson
          rim from behind-left (physically-correct units: candela) */}
      <pointLight position={[4, 5, 6]} intensity={48} color="#c2cddc" decay={2} />
      <pointLight position={[-5, -2, -4]} intensity={120} color={CRIMSON} decay={2} />
      <FollowLight mouse={mouse} />

      {/* the environment is a furnace, not a studio: crimson from below and the
          side, a faint cold sky so the bone keeps its silhouette, one small gold
          strip so the high points still catch a glint */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={1.1} color="#c9d4e6" position={[0, 6, -1]} scale={[10, 5, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={5.0} color="#ff1f33" position={[-6, -3, 2]} scale={[9, 3, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={4.2} color="#ff2a1a" position={[0, -6, 1]} scale={[10, 3, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.2} color="#e0c078" position={[6, 1.5, 3]} scale={[5, 1.5, 1]} target={[0, 0, 0]} />
        <Lightformer form="circle" intensity={0.9} color="#fff1e4" position={[1.5, 3, 8]} scale={2.2} target={[0, 0, 0]} />
      </Environment>

      <Backdrop mouse={mouse} boot={boot} />
      <GridFloor mouse={mouse} boot={boot} />
      <FloorGlow boot={boot} tex={softTex} />

      <Suspense fallback={null}>
        <Skull mouse={mouse} beams={beams} boot={boot} booted={booted} softTex={softTex} />
      </Suspense>
      <Embers mouse={mouse} boot={boot} />
      <OrbitingSkills mouse={mouse} beams={beams} />
      <EyeBeams beams={beams} />
      <FreeFire beams={beams} />

      <Effects />
    </>
  );
}

export default function SkillMatrix3D({ active = true }) {
  const mouse = useMemo(makeMouse, []);
  const beams = useMemo(makeBeams, []);
  const boot = useMemo(makeBoot, []);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => { beams.reduced = mq.matches; };
    sync();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', sync);
      return () => mq.removeEventListener('change', sync);
    }
    mq.addListener(sync);
    return () => mq.removeListener(sync);
  }, [beams]);

  useEffect(() => {
    const id = setTimeout(() => setBooted(true), 160);
    return () => clearTimeout(id);
  }, []);

  return (
    <Canvas
      className="sentinel-canvas"
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 1.5]}
      eventPrefix="client"
      gl={{ antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0.1, 10.5], fov: 40, near: 0.1, far: 100 }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;   // the boot scan is a real clipping plane
        gl.toneMappingExposure = 1.05;
        gl.setClearColor(0x050507, 1);
      }}
    >
      <Scene mouse={mouse} beams={beams} boot={boot} booted={booted} />
    </Canvas>
  );
}

useGLTF.preload(SKULL_URL);
