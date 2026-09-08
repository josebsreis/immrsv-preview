/* ═══════════════════════════════════════════════════════════════════
   The mark as particles. Each of the three L-shaped plates is a slab of
   points: sampled over its face (the notch rejected) and through its
   thickness, plus a denser, brighter outline that draws the silhouette.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { LETTERMARK } from '@lib/lettermark';
import type { HeroConfig } from './config';

type Vec3 = readonly [number, number, number];
interface FaceBase { A: Vec3; B: Vec3; D: Vec3; n: Vec3; }

/** the three faces in cube coordinates: origin corner, two edge ends, outward normal */
export const FACE_BASES: FaceBase[] = [
  { A: [-.5, .5, -.5], B: [.5, .5, -.5], D: [-.5, .5, .5], n: [0, 1, 0] },   // top
  { A: [-.5, -.5, .5], B: [.5, -.5, .5], D: [-.5, .5, .5], n: [0, 0, 1] },   // front
  { A: [.5, -.5, -.5], B: [.5, -.5, .5], D: [.5, .5, -.5], n: [1, 0, 0] },   // right
];

/** the L, in face uv: unit square minus the notch at (1,1) */
const L_OUTLINE: [number, number][] = [[0, 0], [1, 0], [1, 2 / 3], [2 / 3, 2 / 3], [2 / 3, 1], [0, 1]];

/** per-plate simulation state, all flat typed arrays */
export interface PlateSim {
  total: number;
  n: Vec3;
  home: Float32Array;     // rest positions
  off: Float32Array;      // the attribute the shader reads (sim + intro + exit)
  ain: Float32Array;      // per-particle brightness (intro/exit fade)
  sim: Float32Array;      // spring offset
  vel: Float32Array;
  stiff: Float32Array; damp: Float32Array; jit: Float32Array; gain: Float32Array;
  intro: Float32Array;    // seed − home
  over: Float32Array;     // overshoot vector, radial from the void
  seedv: Float32Array;    // seed − seed centre
  letter: Float32Array;   // u,v inside the wordmark's box — where it lands when the mark reads
  iDelay: Float32Array; iDur: Float32Array;
  mPrev: THREE.Vector3; hadM: boolean;
  shockSeen: number; settled: boolean;
}

export function makeParticleMaterial(cfg: HeroConfig): THREE.ShaderMaterial {
  const { base, mid, high } = cfg.mark.tint;
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: cfg.mark.pointPx }, uFlat: { value: 0 } },
    vertexShader: `
      attribute float aSeed; attribute float aSize; attribute float aTint; attribute vec3 aOff; attribute float aIn;
      uniform float uTime, uPx, uFlat;   // uFlat: 1 while the cloud is spelling the name
      varying float vA; varying vec3 vC;
      void main(){
        vec3 p = position + aOff;
        float ph = aSeed * 6.28318;
        // micro drift — each point wanders a hair around home
        p += 0.0055 * vec3( sin(uTime*0.9 + ph), cos(uTime*0.7 + ph*1.3), sin(uTime*1.1 + ph*0.7) );
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        // displaced particles glow a little brighter and larger
        float f = clamp(length(aOff) / 0.09, 0.0, 1.0);
        gl_Position  = clip;
        // as the letters form, every point takes the same size and the same
        // brightness: a letterform wants an even stroke, not a starfield
        float sz = mix(aSize, 1.0, uFlat);
        float tn = mix(aTint, 0.92, uFlat);
        gl_PointSize = sz * uPx / clip.w * (1.0 + f*0.22);
        vA = (0.62 + 0.16*f) * mix(0.10, 1.0, aIn) * (1.0 + 0.7*uFlat);
        vec3 c0 = vec3(${base.join(',')}), c1 = vec3(${mid.join(',')}), c2 = vec3(${high.join(',')});
        vC = tn < 0.5 ? mix(c0, c1, tn*2.0) : mix(c1, c2, (tn-0.5)*2.0);
      }`,
    fragmentShader: `
      precision highp float;
      varying float vA; varying vec3 vC;
      void main(){
        float r = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.10, r) * vA;
        gl_FragColor = vec4(vC * a, a);
      }`,
  });
}

/* The wordmark, as a field of points. The letters are rasterised once into a
   small bitmap and every filled pixel becomes a candidate landing spot, so the
   particles can spell the name without any path maths at runtime. */
let letterField: { w: number; h: number; edge: Int32Array; fill: Int32Array } | null = null;

function buildLetterField() {
  const w = 1024, box = LETTERMARK.box, h = Math.round((w * box.h) / box.w);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.setTransform(w / box.w, 0, 0, h / box.h, (-box.x * w) / box.w, (-box.y * h) / box.h);
  g.fillStyle = '#fff';
  for (const d of LETTERMARK.paths) g.fill(new Path2D(d));
  const data = g.getImageData(0, 0, w, h).data;
  const on = new Uint8Array(w * h);
  for (let i = 3, px = 0; i < data.length; i += 4, px++) on[px] = data[i] > 128 ? 1 : 0;

  // an edge pixel is a filled one with air within a couple of pixels: those are
  // the letterform's own contour, which is exactly where the outline is drawn
  const edge: number[] = [], fill: number[] = [], R = 3;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = y * w + x;
    if (!on[px]) continue;
    let open = false;
    for (let dy = -R; dy <= R && !open; dy++) for (let dx = -R; dx <= R; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || !on[ny * w + nx]) { open = true; break; }
    }
    (open ? edge : fill).push(px);
  }
  letterField = { w, h, edge: Int32Array.from(edge), fill: Int32Array.from(fill) };
}

/** n points in the letters, as u,v in the wordmark's own box. Most land on the
 *  contour so the cloud reads as the same letterform the outline draws; the
 *  rest fill the interior thinly, so the letters have body without turning to
 *  soup. */
const EDGE_SHARE = 0.72;

function letterSamples(n: number): Float32Array {
  const out = new Float32Array(n * 2);
  try { if (!letterField) buildLetterField(); } catch { letterField = null; }
  if (!letterField || letterField.edge.length === 0) {
    for (let i = 0; i < n; i++) { out[i * 2] = Math.random(); out[i * 2 + 1] = Math.random(); }
    return out;
  }
  const { w, h, edge, fill } = letterField;
  for (let i = 0; i < n; i++) {
    const pool = Math.random() < EDGE_SHARE || fill.length === 0 ? edge : fill;
    const px = pool[(Math.random() * pool.length) | 0];
    out[i * 2] = ((px % w) + Math.random()) / w;
    out[i * 2 + 1] = (((px / w) | 0) + Math.random()) / h;
  }
  return out;
}

/** build one plate's cloud and its simulation state */
export function buildPlate(i: number, cfg: HeroConfig, material: THREE.Material, reduced: boolean): { points: THREE.Points; sim: PlateSim } {
  const b = FACE_BASES[i];
  const { perPlate, edgePerPlate, thick, separation, voidCentre } = cfg.mark;
  const total = perPlate + edgePerPlate;
  const pos = new Float32Array(total * 3), seed = new Float32Array(total), size = new Float32Array(total), tint = new Float32Array(total);
  const place = (k: number, u: number, v: number, depth: number) => {
    for (let c = 0; c < 3; c++) pos[k * 3 + c] = b.A[c] + u * (b.B[c] - b.A[c]) + v * (b.D[c] - b.A[c]) + b.n[c] * depth;
    seed[k] = Math.random();
  };
  let k = 0;
  while (k < perPlate) {
    const u = Math.random(), v = Math.random();
    if (u > 2 / 3 && v > 2 / 3) continue;                         // the notch
    place(k, u, v, -Math.random() * thick);
    size[k] = 0.6 + Math.random() * 1.5;
    tint[k] = Math.pow(Math.random(), 1.5);
    k++;
  }
  const segs = L_OUTLINE.map((p, j) => { const q = L_OUTLINE[(j + 1) % 6]; return { p, q, len: Math.hypot(q[0] - p[0], q[1] - p[1]) }; });
  const per = segs.reduce((a, s) => a + s.len, 0);
  while (k < total) {
    let r = Math.random() * per, sg = segs[0];
    for (const s of segs) { if (r <= s.len) { sg = s; break; } r -= s.len; }
    const t = Math.random(), jit = (Math.random() - 0.5) * 0.014;
    const u = sg.p[0] + (sg.q[0] - sg.p[0]) * t, v = sg.p[1] + (sg.q[1] - sg.p[1]) * t;
    const du = -(sg.q[1] - sg.p[1]) / sg.len * jit, dv = (sg.q[0] - sg.p[0]) / sg.len * jit;
    place(k, u + du, v + dv, -Math.random() * thick);
    size[k] = 0.9 + Math.random() * 1.6;
    tint[k] = 0.55 + Math.random() * 0.45;
    k++;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aTint', new THREE.BufferAttribute(tint, 1));
  const off = new THREE.BufferAttribute(new Float32Array(total * 3), 3); off.setUsage(THREE.DynamicDrawUsage);
  const ain = new THREE.BufferAttribute(new Float32Array(total), 1); ain.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aOff', off); g.setAttribute('aIn', ain);
  const points = new THREE.Points(g, material);
  points.frustumCulled = false;

  // per-particle physics
  const S = cfg.sim;
  const vel = new Float32Array(total * 3), stiff = new Float32Array(total), damp = new Float32Array(total), jitA = new Float32Array(total), gain = new Float32Array(total);
  for (let j = 0; j < total; j++) {
    stiff[j] = S.stiffness[0] + Math.random() * (S.stiffness[1] - S.stiffness[0]);
    damp[j] = S.damping[0] + Math.random() * (S.damping[1] - S.damping[0]);
    jitA[j] = (Math.random() - 0.5) * S.jitter;
    gain[j] = S.gainRange[0] + Math.random() * (S.gainRange[1] - S.gainRange[0]);
  }

  // the arrival: the seed is the logo itself, small and loose; the plate's
  // group sits `separation` out along its normal, so the shared centre is the
  // void pulled back by that much — all three plates seed in one spot
  const I = cfg.intro;
  const intro = new Float32Array(total * 3), over = new Float32Array(total * 3), seedv = new Float32Array(total * 3), iDelay = new Float32Array(total), iDur = new Float32Array(total);
  const letter = letterSamples(total);
  const cx = voidCentre - b.n[0] * separation, cy = voidCentre - b.n[1] * separation, cz = voidCentre - b.n[2] * separation;
  const stagger = reduced ? 0 : I.stagger, dur = reduced ? 0.01 : I.duration;
  for (let j = 0; j < total; j++) {
    const th = Math.random() * 6.2832, ph = Math.acos(2 * Math.random() - 1), r = Math.random() * I.seed;
    const sx = cx + (pos[j * 3] - cx) * I.scale + Math.sin(ph) * Math.cos(th) * r;
    const sy = cy + (pos[j * 3 + 1] - cy) * I.scale + Math.sin(ph) * Math.sin(th) * r;
    const sz = cz + (pos[j * 3 + 2] - cz) * I.scale + Math.cos(ph) * r;
    intro[j * 3] = sx - pos[j * 3]; intro[j * 3 + 1] = sy - pos[j * 3 + 1]; intro[j * 3 + 2] = sz - pos[j * 3 + 2];
    seedv[j * 3] = sx - cx; seedv[j * 3 + 1] = sy - cy; seedv[j * 3 + 2] = sz - cz;
    const ov = I.over * (0.6 + Math.random() * 0.8);
    over[j * 3] = (pos[j * 3] - cx) * ov; over[j * 3 + 1] = (pos[j * 3 + 1] - cy) * ov; over[j * 3 + 2] = (pos[j * 3 + 2] - cz) * ov;
    iDelay[j] = Math.random() * stagger; iDur[j] = dur * (0.75 + Math.random() * 0.5);

  }

  const sim: PlateSim = {
    total, n: b.n, home: pos, off: off.array as Float32Array, ain: ain.array as Float32Array, sim: new Float32Array(total * 3),
    vel, stiff, damp, jit: jitA, gain, intro, over, seedv, letter, iDelay, iDur,
    mPrev: new THREE.Vector3(), hadM: false, shockSeen: -1, settled: false,
  };
  return { points, sim };
}

/** Spin about the cube's diagonal: the mark has 3-fold symmetry around the
 *  axis through its notch corner, so it can revolve forever without ever
 *  showing its hollow back. */
export const SPIN_AXIS = new THREE.Vector3(1, 1, 1).normalize();
