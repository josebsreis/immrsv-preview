/* ═══════════════════════════════════════════════════════════════════
   The mark as particles. Each of the three L-shaped plates is a slab of
   points: sampled over its face (the notch rejected) and through its
   thickness, plus a denser, brighter outline that draws the silhouette.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
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
  /** how many of them, from the front, are in the round rather than on a
   *  plate: none of a plate's, all of the cloud's. `j < face` is the test. */
  face: number;
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
  iDelay: Float32Array; iDur: Float32Array;
  mPrev: THREE.Vector3; hadM: boolean;
  shockSeen: number; settled: boolean;
}

export function makeParticleMaterial(cfg: HeroConfig): THREE.ShaderMaterial {
  const { base, mid, high } = cfg.mark.tint;
  const D = cfg.mark.depth;
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: cfg.mark.pointPx }, uFlat: { value: 0 }, uChurn: { value: 0 }, uScale: { value: 1 } },
    vertexShader: `
      attribute float aSeed; attribute float aTint; attribute vec3 aOff; attribute float aIn;
      attribute float aCore;   // 1 on the cloud's particles, 0 on the cube's
      uniform float uTime, uPx, uFlat, uChurn, uScale;  // uFlat: a form is standing; uChurn: how far the cloud wanders; uScale: how big the cube is
      varying float vA; varying vec3 vC; varying float vB;
      void main(){
        vec3 p = position + aOff;
        float ph = aSeed * 6.28318;
        // Drift. On the cube a hair, so a point is never quite still; on the
        // cloud as much as it is given — two sines a point, at different
        // rates, which is what keeps a few thousand of them from ever settling
        // into a shape. Done here because here it is free.
        float amp = 0.0055 + uChurn * aCore;
        p += amp * vec3( sin(uTime*0.9 + ph), cos(uTime*0.7 + ph*1.3), sin(uTime*1.1 + ph*0.7) );
        p += amp * 0.6 * vec3( sin(uTime*2.3 + ph*2.1), sin(uTime*1.9 + ph*3.3), cos(uTime*2.7 + ph*1.7) );
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vec4 clip = projectionMatrix * mv;
        // displaced particles glow a little brighter and larger
        float f = clamp(length(aOff) / 0.09, 0.0, 1.0);
        gl_Position  = clip;
        // Every particle is the same size. The cloud is one material, and a
        // scatter of sizes reads as noise in it rather than as depth — what
        // depth there is comes from the focal plane below.
        // Depth. Nothing here reads as a volume without it: the far side of a
        // cloud has to fall away, or every point sits on the same pane of glass.
        // The cube's depth range grows with the cube: scaled up three times,
        // its far corner would otherwise be past the fog's far plane and its
        // back plate a dim smear. The range is opened about the camera
        // distance by the same factor, so it is the same cube, only larger.
        float ds = mix(1.0, uScale, 1.0 - aCore);
        float nearD = ${cfg.camera.dist.toFixed(3)} - ${(cfg.camera.dist - D.near).toFixed(3)} * ds;
        float farD  = ${cfg.camera.dist.toFixed(3)} + ${(D.far - cfg.camera.dist).toFixed(3)} * ds;
        float dep = clamp((-mv.z - nearD) / (farD - nearD), 0.0, 1.0);
        float lit = mix(1.0, ${D.dim.toFixed(2)}, dep);
        // A focal plane, the way a lens has one: points away from it spread and
        // dim rather than staying the same crisp dot at every distance. This is
        // most of what separates something photographed from a field of dots.
        float off = clamp(abs(dep - ${D.focus.toFixed(2)}) / ${Math.max(D.focus, 1 - D.focus).toFixed(2)}, 0.0, 1.0);
        // squared, so the plane keeps a generous sharp band and only what is
        // properly far from it goes soft
        float blur = off * off;
        vB = blur;
        // the cube never flattens: it is the mark, and evening it out with the
        // form would put the logo and the thing it made in the same voice
        float fl = uFlat * aCore;
        float tn = mix(aTint, 0.86, fl * ${D.even.toFixed(2)});
        // the cube's points go down as it grows: the open cube is a frame
        // and a frame is quiet
        float big = (uScale - 1.0) * (1.0 - aCore);
        gl_PointSize = uPx / clip.w * (1.0 + f*0.22) * (1.0 + blur * ${D.bokeh.toFixed(2)}) * (1.0 + big * ${cfg.open.grow.toFixed(2)});
        // the same light spread over a wider disc is a fainter disc
        // the cube starts its intro as a faint dot and the cloud starts as
        // nothing at all, which is the difference in the floor here
        float floor_ = 0.10 * (1.0 - aCore);
        // At rest a point is nearly full white: the mark is the brightest thing
        // on the page and it was reading as a grey haze. What takes it down is
        // depth, and growing — the open cube is a frame and a frame is quiet —
        // not its starting point.
        vA = (0.92 + 0.08*f) * mix(floor_, 1.0, aIn) * (1.0 + ${D.lift.toFixed(2)}*fl) * lit
             / (1.0 + big * ${cfg.open.fade.toFixed(2)})
             / (1.0 + blur * ${(D.bokeh * 0.55).toFixed(2)});
        vec3 c0 = vec3(${base.join(',')}), c1 = vec3(${mid.join(',')}), c2 = vec3(${high.join(',')});
        vec3 col = tn < 0.5 ? mix(c0, c1, tn*2.0) : mix(c1, c2, (tn-0.5)*2.0);
        // and the far side cools as it goes, the way distance always does
        vC = mix(col, col * vec3(0.74, 0.80, 0.94), dep);
      }`,
    fragmentShader: `
      precision highp float;
      varying float vA; varying vec3 vC; varying float vB;
      void main(){
        vec2 q = abs(gl_PointCoord - 0.5);
        float r = length(gl_PointCoord - 0.5);
        // In focus a particle is a square — the site is built out of squares,
        // and a square has corners, which is most of what "crisp" means at two
        // pixels across. Out of focus it becomes a disc, because that is what a
        // lens does to a point: the shape of the aperture, not of the thing.
        float e = fwidth(q.x) * 0.9 + 0.004;
        float sq = 1.0 - smoothstep(0.30 - e, 0.30 + e, max(q.x, q.y));
        float disc = smoothstep(0.5, mix(0.2, 0.42, vB), r);
        float a = mix(sq, disc * mix(0.8, 1.0, vB), vB) * vA;
        gl_FragColor = vec4(vC * a, a);
      }`,
  });
}

/** build one plate's cloud and its simulation state */
export function buildPlate(i: number, cfg: HeroConfig, material: THREE.Material, reduced: boolean): { points: THREE.Points; sim: PlateSim } {
  const b = FACE_BASES[i];
  const { perPlate, edgePerPlate, thick, separation, voidCentre } = cfg.mark;
  const total = perPlate + edgePerPlate;
  const pos = new Float32Array(total * 3), seed = new Float32Array(total), tint = new Float32Array(total);
  const place = (k: number, u: number, v: number, depth: number) => {
    for (let c = 0; c < 3; c++) pos[k * 3 + c] = b.A[c] + u * (b.B[c] - b.A[c]) + v * (b.D[c] - b.A[c]) + b.n[c] * depth;
    seed[k] = Math.random();
  };
  let k = 0;
  while (k < perPlate) {
    const u = Math.random(), v = Math.random();
    if (u > 2 / 3 && v > 2 / 3) continue;                         // the notch
    place(k, u, v, -Math.random() * thick);
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
    tint[k] = 0.55 + Math.random() * 0.45;
    k++;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  g.setAttribute('aTint', new THREE.BufferAttribute(tint, 1));
  g.setAttribute('aCore', new THREE.BufferAttribute(new Float32Array(total), 1));   // the cube's: 0
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
    total, face: 0, n: b.n, home: pos, off: off.array as Float32Array, ain: ain.array as Float32Array, sim: new Float32Array(total * 3),
    vel, stiff, damp, jit: jitA, gain, intro, over, seedv, iDelay, iDur,
    mPrev: new THREE.Vector3(), hadM: false, shockSeen: -1, settled: false,
  };
  return { points, sim };
}

/**
 * The cloud: its own particles, in the void. Built in the mark's frame with
 * the pivot where the shapes are — the same coordinates a form is authored in,
 * so a target is a point and not a transform.
 *
 * Not a ball. A few clumps of different sizes, scattered about the pivot, each
 * crowded at its middle and thinning to stragglers — and no clump quite where
 * another is — so the whole thing is lumpy, open, and never reads as an object
 * with a skin. The churn that keeps it moving is the shader's; what is laid
 * down here is only where each point calls home.
 */
export function buildCloud(count: number, cfg: HeroConfig, material: THREE.Material, pivot: number): { points: THREE.Points; sim: PlateSim; wide: Float32Array; band: Uint8Array } {
  const F = cfg.core;
  const pos = new Float32Array(count * 3), seed = new Float32Array(count), tint = new Float32Array(count);
  const wide = new Float32Array(count * 3), band = new Uint8Array(count);
  // the clumps
  const lobes: { x: number; y: number; z: number; r: number; w: number }[] = [];
  for (let l = 0; l < F.lobes; l++) {
    const th = Math.random() * 6.2832, ph = Math.acos(2 * Math.random() - 1);
    const d = F.radius * F.lobeSpread * Math.cbrt(Math.random());
    const r = F.radius * (0.3 + Math.random() * 0.55);
    lobes.push({ x: Math.sin(ph) * Math.cos(th) * d, y: Math.cos(ph) * d * F.flatten, z: Math.sin(ph) * Math.sin(th) * d, r, w: r * r });
  }
  const wsum = lobes.reduce((a, l) => a + l.w, 0);
  for (let j = 0; j < count; j++) {
    // a clump, the bigger the likelier; then a point in it, near its middle
    let pick = Math.random() * wsum, L = lobes[0];
    for (const l of lobes) { if (pick <= l.w) { L = l; break; } pick -= l.w; }
    const th = Math.random() * 6.2832, ph = Math.acos(2 * Math.random() - 1);
    const r = L.r * Math.pow(Math.random(), F.density);
    const x = L.x + Math.sin(ph) * Math.cos(th) * r;
    const y = L.y + Math.cos(ph) * r * F.flatten;
    const z = L.z + Math.sin(ph) * Math.sin(th) * r;
    pos[j * 3] = pivot + x; pos[j * 3 + 1] = pivot + y; pos[j * 3 + 2] = pivot + z;
    seed[j] = Math.random();
    tint[j] = Math.pow(Math.random(), 1.4);
    band[j] = Math.min(F.bands - 1, (Math.hypot(x, z) / F.radius * F.bands) | 0);
    // where it comes in from: well outside, in its own direction, so the
    // cloud gathers out of the dark rather than switching on
    const far = F.radius * (1.6 + Math.random() * 2.2);
    wide[j * 3] = Math.sin(ph) * Math.cos(th) * far; wide[j * 3 + 1] = Math.cos(ph) * far; wide[j * 3 + 2] = Math.sin(ph) * Math.sin(th) * far;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  g.setAttribute('aTint', new THREE.BufferAttribute(tint, 1));
  g.setAttribute('aCore', new THREE.BufferAttribute(new Float32Array(count).fill(1), 1));
  const off = new THREE.BufferAttribute(new Float32Array(count * 3), 3); off.setUsage(THREE.DynamicDrawUsage);
  const ain = new THREE.BufferAttribute(new Float32Array(count), 1); ain.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aOff', off); g.setAttribute('aIn', ain);
  const points = new THREE.Points(g, material);
  points.frustumCulled = false;

  const S = cfg.sim;
  const vel = new Float32Array(count * 3), stiff = new Float32Array(count), damp = new Float32Array(count), jitA = new Float32Array(count), gain = new Float32Array(count);
  const over = new Float32Array(count * 3);
  for (let j = 0; j < count; j++) {
    stiff[j] = S.stiffness[0] + Math.random() * (S.stiffness[1] - S.stiffness[0]);
    damp[j] = S.damping[0] + Math.random() * (S.damping[1] - S.damping[0]);
    jitA[j] = (Math.random() - 0.5) * S.jitter;
    gain[j] = S.gainRange[0] + Math.random() * (S.gainRange[1] - S.gainRange[0]);
    // the exit throws it outward from the pivot, each point on its own line
    const ov = cfg.intro.over * (0.6 + Math.random() * 0.8) * 2.5;
    over[j * 3] = (pos[j * 3] - pivot) * ov; over[j * 3 + 1] = (pos[j * 3 + 1] - pivot) * ov; over[j * 3 + 2] = (pos[j * 3 + 2] - pivot) * ov;
  }
  // no arrival of its own: the intro arrays are left at zero and the flight
  // time at nothing, so the cube's intro passes over these without moving them
  const sim: PlateSim = {
    total: count, face: count, n: [0, 1, 0], home: pos, off: off.array as Float32Array, ain: ain.array as Float32Array, sim: new Float32Array(count * 3),
    vel, stiff, damp, jit: jitA, gain,
    intro: new Float32Array(count * 3), over, seedv: new Float32Array(count * 3),
    iDelay: new Float32Array(count), iDur: new Float32Array(count).fill(0.001),
    mPrev: new THREE.Vector3(), hadM: false, shockSeen: -1, settled: false,
  };
  return { points, sim, wide, band };
}

/** Spin about the cube's diagonal: the mark has 3-fold symmetry around the
 *  axis through its notch corner, so it can revolve forever without ever
 *  showing its hollow back. */
export const SPIN_AXIS = new THREE.Vector3(1, 1, 1).normalize();
