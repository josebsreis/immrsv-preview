/* ═══════════════════════════════════════════════════════════════════
   A lab scene, not part of the site: the same particle mark as the hero,
   but the cloud lets go of the cube and reassembles as the things the
   studios make — a figure, a house, a screen — then goes back.

   Nothing new is downloaded for this. The shapes are distance fields in
   code, sampled once into one array of targets per plate per shape; the
   render cost is exactly the render cost of the cube, because it is the
   same 7,200 points either way.

   While a shape is standing, the mark stops tumbling on its diagonal and
   turns on a vertical axis instead: a figure that cartwheels is a mess,
   and the diagonal spin only ever existed to hide the cube's hollow back.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { HERO_CONFIG } from '../hero/config';
import { FACE_BASES, SPIN_AXIS, buildPlate, makeParticleMaterial, type PlateSim } from '../hero/mark';
import { SHAPES, cloudFor, loadCloud, poseInto, shapeTargets, skinnedIndices } from '../hero/shapes';
import { loadSkin, skinFor } from '../hero/skin';
import { simulate, type SimContext } from '../hero/sim';
import { createLens } from '../hero/lens';
import { createPointer } from '../hero/pointer';

export interface ShapeLab {
  /** show shape `i`, or the cube for −1 */
  show(i: number): void;
  /** stop advancing on its own — a click or a key has taken over */
  hold(): void;
  destroy(): void;
}

const EASE = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** how much of the travel is spent letting particles leave in turn */
const STAGGER = 0.5;
/** how much of the cursor's push survives once a shape has formed */
const TOUCH_IN_SHAPE = 0.4;
/** seconds: cube held, crossing, shape held */
const BEAT = { first: 2.6, cube: 0.7, cross: 1.4, shape: 4.2 };

export function startShapeLab(host: HTMLElement, onLabel?: (name: string) => void): ShapeLab {
  const cfg = HERO_CONFIG;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, cfg.renderer.dpr));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(cfg.renderer.ground, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = cfg.renderer.exposure;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(cfg.camera.fov, innerWidth / innerHeight, 0.1, 100);
  scene.add(camera);
  const { pointer: P, destroy: destroyPointer } = createPointer();
  const lens = createLens(renderer, cfg);

  const material = makeParticleMaterial(cfg);
  material.uniforms.uPx.value = cfg.mark.pointPx * renderer.getPixelRatio();

  interface Plate {
    holder: THREE.Group; points: THREE.Points; sim: PlateSim;
    /** targets in this plate's own space, one array per shape — built on
     *  demand, since sampling a field costs ~50ms and nothing should pay for
     *  a shape it never shows */
    targets: (Float32Array | null)[];
    src: (Uint16Array | null)[];
    homeInner: Float32Array;
    /** 0..1 per particle: when it leaves, so the cloud unfolds rather than snaps */
    when: Float32Array;
  }
  const plates: Plate[] = [];
  const inner = new THREE.Group();
  const vc = cfg.mark.voidCentre;
  inner.position.set(-vc, -vc, -vc);
  FACE_BASES.forEach((b, i) => {
    const holder = new THREE.Group();
    const { points, sim } = buildPlate(i, cfg, material, reduced);
    holder.add(points);
    holder.position.set(b.n[0], b.n[1], b.n[2]).multiplyScalar(cfg.mark.separation);
    inner.add(holder);
    // the shapes are authored in the mark's coordinates, so a plate's targets
    // are the shape's points less the plate's own offset along its normal
    const n = sim.total, homeInner = new Float32Array(n * 3);
    for (let j = 0; j < n; j++) {
      homeInner[j * 3] = sim.home[j * 3] + holder.position.x;
      homeInner[j * 3 + 1] = sim.home[j * 3 + 1] + holder.position.y;
      homeInner[j * 3 + 2] = sim.home[j * 3 + 2] + holder.position.z;
    }
    const when = new Float32Array(n);
    for (let j = 0; j < n; j++) when[j] = Math.random();
    plates.push({ holder, points, sim, targets: SHAPES.map(() => null), src: SHAPES.map(() => null), homeInner, when });
  });
  const L0 = new THREE.Group(); L0.add(inner); scene.add(L0);

  const qSpin = new THREE.Quaternion(), qTilt = new THREE.Quaternion();
  const AX = new THREE.Vector3(1, 0, 0), UP = new THREE.Vector3(0, 1, 0), _axis = new THREE.Vector3();

  // ── what is being shown ────────────────────────────────────────────
  let shape = -1;            // −1 = the cube
  let blend = 0;             // 0..1 toward `shape`
  let target = 0;            // where blend is heading
  let auto = !reduced, phase = 0, cycle = 0, working = false;
  let spinAngle = 0, introT0 = 0, last: number | undefined;
  let yaw = cfg.camera.isoYaw, tilt = cfg.camera.isoTilt;

  /** sample shape `i` for every plate, once. A shape baked from a model waits
   *  for its cloud; its field stands in if that never arrives. */
  const asked = new Set<number>();
  function ensure(i: number) {
    const def = SHAPES[i];
    if (def.skin && !skinFor(def.skin)) {
      if (!asked.has(i)) { asked.add(i); loadSkin(def.skin).then(() => build(i)); }
      return;
    }
    if (def.src && !cloudFor(def)) {
      if (!asked.has(i)) { asked.add(i); loadCloud(def.src).then(() => build(i)); }
      return;
    }
    build(i);
  }
  function build(i: number) {
    const def = SHAPES[i], skin = def.skin ? skinFor(def.skin) : null;
    if (skin) {
      for (const pl of plates) {
        if (pl.src[i]) continue;
        pl.src[i] = skinnedIndices(skin.bind, pl.homeInner, pl.sim.total);
        pl.targets[i] = new Float32Array(pl.sim.total * 3);
      }
      pose(i, 0);
      return;
    }
    for (const pl of plates) {
      if (pl.targets[i]) continue;
      const n = pl.sim.total, t = shapeTargets(SHAPES[i], pl.homeInner, n);
      for (let j = 0; j < n; j++) {
        t[j * 3] -= pl.holder.position.x;
        t[j * 3 + 1] -= pl.holder.position.y;
        t[j * 3 + 2] -= pl.holder.position.z;
      }
      pl.targets[i] = t;
    }
  }
  // the first shape is ready before it is asked for; the rest follow one idle
  // slice at a time, so no single frame carries more than one field
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 300));
  SHAPES.forEach((_, i) => idle(() => ensure(i)));

  function pose(i: number, t: number) {
    const def = SHAPES[i], skin = def.skin ? skinFor(def.skin) : null;
    if (!skin) return;
    skin.update(t);
    for (const pl of plates) {
      const src = pl.src[i], tg = pl.targets[i];
      if (src && tg) poseInto(def, skin.pose, src, tg, pl.holder.position.x, pl.holder.position.y, pl.holder.position.z);
    }
  }

  function show(i: number) {
    if (i === shape) return;
    if (i < 0) { target = 0; return; }
    // crossing straight from one shape to another would have the particles
    // slide between two skins; they go home through the cube instead
    if (blend > 0.02 && shape >= 0) { pending = i; target = 0; working = true; return; }
    ensure(i);
    shape = i; target = 1;
    onLabel?.(SHAPES[i].name);
  }
  let pending = -1;

  const onKey = (e: KeyboardEvent) => {
    const k = e.key;
    if (k === '0') { auto = false; show(-1); }
    else if (k >= '1' && k <= String(SHAPES.length)) { auto = false; show(Number(k) - 1); }
  };
  const onDown = () => { auto = false; show(shape >= 0 && blend > 0.5 ? -1 : (shape + 1) % SHAPES.length); };
  addEventListener('keydown', onKey);
  renderer.domElement.addEventListener('pointerdown', onDown);

  const onResize = () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight); lens.resize();
    material.uniforms.uPx.value = cfg.mark.pointPx * renderer.getPixelRatio();
  };
  addEventListener('resize', onResize);

  const ctx: SimContext = {
    dt: 0, t: 0, camera, pointer: P, introT0: 0, exit: 0, shockT: -9, reduced, cfg,
    morph: 0, out: 0, density: 1,
    mp0: new THREE.Vector3(), mru: new THREE.Vector3(), mvv: new THREE.Vector3(),
  };

  let running = true, raf = 0;
  function frame(now: number) {
    const t = now / 1000;
    const dt = Math.max(0, Math.min((now - (last ?? now)) / 1000, 0.05));
    if (last === undefined) introT0 = t;
    last = now;

    // the reel: cube, cross, shape, cross, next shape…
    if (auto) {
      cycle += dt;
      const span = phase === 0 ? (working ? BEAT.cube : BEAT.first)
                : phase === 2 ? BEAT.shape : BEAT.cross;
      if (cycle > span) {
        cycle = 0; phase = (phase + 1) % 4;
        if (phase === 1) show((shape + 1 + SHAPES.length) % SHAPES.length);
        if (phase === 3) { target = 0; working = true; }
      }
    }
    if (target === 0 && blend < 0.02 && pending >= 0) { const p = pending; pending = -1; ensure(p); shape = p; target = 1; onLabel?.(SHAPES[p].name); }
    if (target === 0 && blend < 0.002 && shape >= 0 && pending < 0) { shape = -1; onLabel?.('cube'); }
    const rate = dt / (reduced ? 0.01 : BEAT.cross);
    blend = clamp01(blend + (target > blend ? rate : -rate));

    // camera: the fixed isometric of the hero, swayed by the cursor
    P.x += (P.tx - P.x) * 0.08; P.y += (P.ty - P.y) * 0.08;
    const C = cfg.camera;
    yaw += (C.isoYaw + Math.max(-C.maxYaw, Math.min(C.maxYaw, (P.x - 0.5) * 2 * C.maxYaw)) - yaw) * C.easing;
    tilt += (C.isoTilt + Math.max(-C.maxTilt, Math.min(C.maxTilt, (P.y - 0.5) * 2 * C.maxTilt)) - tilt) * C.easing;
    camera.position.set(Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt)).multiplyScalar(C.dist);
    camera.lookAt(0, 0, 0);

    // one turn, always the same way round: the axis leans from the cube's
    // diagonal up to vertical as a shape stands
    const e = EASE(blend);
    const whirl = working ? 1 - e : 0;
    spinAngle += (cfg.mark.spin * (1 + whirl * cfg.shapes.whirl) * (1 - e) + cfg.mark.spin * 0.85 * e) * dt;
    _axis.copy(SPIN_AXIS).lerp(UP, e).normalize();
    qSpin.setFromAxisAngle(_axis, spinAngle);
    qTilt.setFromAxisAngle(AX, Math.sin(t * 0.083) * cfg.mark.wobble * (1 - e));
    L0.quaternion.copy(qSpin).multiply(qTilt);
    L0.updateMatrixWorld(true);

    material.uniforms.uTime.value = t;
    // as a shape resolves every point takes the same size and brightness: a
    // form wants an even skin, not a starfield with bright grains in it
    material.uniforms.uFlat.value = e * 0.75;
    ctx.dt = dt; ctx.t = t; ctx.introT0 = introT0;

    if (shape >= 0 && e > 0.0005 && SHAPES[shape].skin) pose(shape, t);
    for (const pl of plates) {
      simulate(pl.holder, pl.points, pl.sim, ctx);
      if (e > 0.0005 && shape >= 0) {
        const { off, home, ain } = pl.sim, tg = pl.targets[shape], when = pl.when, n = pl.sim.total;
        if (!tg) continue;
        for (let j = 0; j < n; j++) {
          const u = clamp01(e * (1 + STAGGER) - STAGGER * when[j]);
          const w = u * u * (3 - 2 * u);
          if (w <= 0) continue;
          const i3 = j * 3;
          const keep = 1 - w * (1 - TOUCH_IN_SHAPE);
          off[i3] = off[i3] * keep + (tg[i3] - home[i3]) * w;
          off[i3 + 1] = off[i3 + 1] * keep + (tg[i3 + 1] - home[i3 + 1]) * w;
          off[i3 + 2] = off[i3 + 2] * keep + (tg[i3 + 2] - home[i3 + 2]) * w;
          ain[j] = Math.min(ain[j], 1);
        }
        (pl.points.geometry.attributes.aOff as THREE.BufferAttribute).needsUpdate = true;
      }
    }

    lens.render(scene, camera, P);
    if (running) raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    show(i) { auto = false; show(i); },
    hold() { auto = false; },
    destroy() {
      running = false; cancelAnimationFrame(raf);
      removeEventListener('keydown', onKey); removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      destroyPointer(); lens.dispose();
      for (const p of plates) p.points.geometry.dispose();
      material.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
