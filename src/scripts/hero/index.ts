/* ═══════════════════════════════════════════════════════════════════
   The hero: the particle mark, its physics, the lens and the fluid, as
   one island with a small API the page drives (ready, exit progress,
   strike). All numbers come from HERO_CONFIG; a page can override any.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { HERO_CONFIG, type HeroConfig } from './config';
import { FACE_BASES, SPIN_AXIS, buildPlate, makeParticleMaterial, type PlateSim } from './mark';
import { simulate } from './sim';
import { SHAPES, cloudFor, formFloor, loadCloud, poseInto, shapeTargets, skinnedIndices } from './shapes';
import { loadSkin, skinFor } from './skin';
import { createLens } from './lens';
import { createPointer } from './pointer';
import { createFluid, type FluidHandle } from '../fluid';

export interface HeroOptions {
  /** where the three.js canvas goes */
  host: HTMLElement;
  /** the fluid's own canvas (sits under the host) */
  fluidCanvas?: HTMLCanvasElement | null;
  config?: DeepPartial<HeroConfig>;
}

export interface Hero {
  /** release the intro (call when the page is ready) */
  setReady(): void;
  /** 0..1 — the fade, as the hero goes by */
  setOut(p: number): void;
  /** 0..1 — the scroll-driven exit */
  setExit(p: number): void;
  /** a strike at viewport coords (0..1, y up) */
  strike(x: number, y: number): void;
  /** stand as shape `i`, or go back to the cube with −1 */
  showShape(i: number): void;
  readonly fluid: FluidHandle | null;
  destroy(): void;
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
function merge<T>(base: T, over?: DeepPartial<T>): T {
  if (!over) return base;
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...base };
  for (const k in over) {
    const v = (over as any)[k], b = (base as any)[k];
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && b && typeof b === 'object' ? merge(b, v) : v;
  }
  return out;
}

export function createHero(opts: HeroOptions): Hero {
  const cfg = merge(HERO_CONFIG, opts.config);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = () => innerWidth <= cfg.mobileMax;

  // ── renderer / camera / scene ──────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true });
  const dpr = () => Math.min(devicePixelRatio, mobile() ? cfg.renderer.dprMobile : cfg.renderer.dpr);
  renderer.setPixelRatio(dpr());
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(cfg.renderer.ground, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = cfg.renderer.exposure;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  opts.host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(cfg.camera.fov, innerWidth / innerHeight, 0.1, 100);
  scene.add(camera);

  const fluid = opts.fluidCanvas ? createFluid(opts.fluidCanvas, { ...cfg.fluid, mobileMax: cfg.mobileMax }) : null;
  const { pointer: P, destroy: destroyPointer } = createPointer();
  const lens = createLens(renderer, cfg);

  // ── the mark ───────────────────────────────────────────────────────
  const material = makeParticleMaterial(cfg);
  material.uniforms.uPx.value = cfg.mark.pointPx * renderer.getPixelRatio();
  interface Plate {
    holder: THREE.Group; points: THREE.Points; sim: PlateSim; axis: THREE.Vector3; out: THREE.Vector3;
    /** the plate's rest positions in the mark's own frame — what the shape
     *  fields are authored against */
    homeInner: Float32Array;
    /** one array of targets per shape, sampled the first time it is asked for */
    targets: (Float32Array | null)[];
    /** for an animated shape: which of its points each particle takes */
    src: (Uint16Array | null)[];
    /** 0..1 per particle: when it leaves, so a form unfolds rather than snaps */
    when: Float32Array;
    /** where the particles were the instant a new form was asked for: a
     *  crossing interrupted mid-way carries on from here rather than jumping */
    hold: Float32Array;
  }
  const plates: Plate[] = [];
  const inner = new THREE.Group();                                    // pivots on the void
  const vc = cfg.mark.voidCentre;
  inner.position.set(-vc, -vc, -vc);
  FACE_BASES.forEach((b, i) => {
    const holder = new THREE.Group();
    const { points, sim } = buildPlate(i, cfg, material, reduced);
    holder.add(points);
    holder.position.set(b.n[0], b.n[1], b.n[2]).multiplyScalar(cfg.mark.separation);
    inner.add(holder);
    // the way out: straight along its own normal, turning about an axis that
    // lies in its face — the plate flips as it leaves
    const out = new THREE.Vector3(b.n[0], b.n[1], b.n[2]).normalize();
    const axis = out.clone().cross(SPIN_AXIS).normalize();
    const nP = sim.total, homeInner = new Float32Array(nP * 3), when = new Float32Array(nP);
    for (let j = 0; j < nP; j++) {
      homeInner[j * 3] = sim.home[j * 3] + holder.position.x;
      homeInner[j * 3 + 1] = sim.home[j * 3 + 1] + holder.position.y;
      homeInner[j * 3 + 2] = sim.home[j * 3 + 2] + holder.position.z;
      when[j] = Math.random();
    }
    plates.push({ holder, points, sim, axis, out, homeInner, when, targets: SHAPES.map(() => null), src: SHAPES.map(() => null), hold: new Float32Array(sim.total * 3) });
  });
  const L0 = new THREE.Group(); L0.add(inner); scene.add(L0);

  const qSpin = new THREE.Quaternion(), qTilt = new THREE.Quaternion();
  const AX = new THREE.Vector3(1, 0, 0), UP = new THREE.Vector3(0, 1, 0);
  /** the axis the mark turns on: the cube's diagonal, tilting up to vertical
   *  as a form stands. Both lean the same way, so the turn never reverses. */
  const _axis = new THREE.Vector3();

  // ── state the page drives ──────────────────────────────────────────
  let released = reduced, exit = 0, out = 0, shockT = -9;
  let spinAngle = 0, spinBoost = cfg.intro.spinBoost;

  // ── the reel ───────────────────────────────────────────────────────
  const reel = cfg.shapes.enabled && !reduced;
  let shape = -1;        // −1 is the cube
  let shapeAt = 0;       // 0..1 — how far the cloud has gone into `shape`
  let shapeTo = 0;       // where it is heading
  let prev = -1;         // the form being crossed out of, while `mix` < 1
  let held = false;      // …and whether that is a snapshot rather than a form
  let mix = 1;           // 0..1 across a direct crossing from `prev` to `shape`
  let phase = 0, beat = 0, parked = false;
  /** where the reel has got to. Not `shape`: that goes back to −1 on every
   *  interlude, so counting from it would ask for the first form for ever. */
  let cursor = -1;

  /** sample shape `i` for every plate, once. A shape baked from a model waits
   *  for its cloud to arrive; if that never comes, its field stands in, so the
   *  reel is never held up by the network. */
  const asked = new Set<number>();
  function ensureShape(i: number) {
    const def = SHAPES[i];
    if (def.skin && !skinFor(def.skin)) {
      if (!asked.has(i)) { asked.add(i); loadSkin(def.skin).then(() => buildShape(i)); }
      return;
    }
    if (def.src && !cloudFor(def)) {
      if (!asked.has(i)) { asked.add(i); loadCloud(def.src).then(() => buildShape(i)); }
      return;
    }
    buildShape(i);
  }
  /** the fields are authored in the mark's frame, so a plate's targets are
   *  those points less its own offset along its normal */
  function buildShape(i: number) {
    const def = SHAPES[i], skin = def.skin ? skinFor(def.skin) : null;
    if (skin) {
      // an animated form is not a fixed set of targets: each particle is given
      // one of the cloud's points to follow, and where that point is depends
      // on the frame
      for (const p of plates) {
        if (p.src[i]) continue;
        p.src[i] = skinnedIndices(skin.bind, p.homeInner, p.sim.total);
        p.targets[i] = new Float32Array(p.sim.total * 3);
      }
      poseShape(i, 0);
      return;
    }
    for (const p of plates) {
      if (p.targets[i]) continue;
      const n = p.sim.total, t = shapeTargets(SHAPES[i], p.homeInner, n);
      for (let j = 0; j < n; j++) {
        t[j * 3] -= p.holder.position.x;
        t[j * 3 + 1] -= p.holder.position.y;
        t[j * 3 + 2] -= p.holder.position.z;
      }
      p.targets[i] = t;
    }
  }
  /** the fields are built one idle slice at a time: ~50ms each, and never on
   *  the way to first paint — the hero itself is already there by then */
  if (reel) {
    const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 600));
    SHAPES.forEach((_, i) => idle(() => ensureShape(i)));
  }

  /** move an animated form to where it is at `t` seconds */
  function poseShape(i: number, t: number) {
    const def = SHAPES[i], skin = def.skin ? skinFor(def.skin) : null;
    if (!skin) return;
    skin.update(t);
    for (const p of plates) {
      const src = p.src[i], tg = p.targets[i];
      if (src && tg) poseInto(def, skin.pose, src, tg, p.holder.position.x, p.holder.position.y, p.holder.position.z);
    }
  }

  function showShape(i: number) {
    if (!reel || i === shape) return;
    if (i < 0) { shapeTo = 0; return; }
    ensureShape(i);
    // A form standing hands straight over to the next one: the particles travel
    // from one skin to the other and never pass through the cube. Going home
    // between every pair made each change three events instead of one.
    //
    // Asked again mid-crossing — clicking twice quickly — it leaves from where
    // the particles actually are, not from where the last form would have been:
    // a snapshot of this instant becomes the thing being crossed out of.
    if (shapeAt > 0.9 && shape >= 0 && ready(shape) && ready(i)) {
      snapshot();
      prev = shape; held = true; shape = i; mix = 0; beat = 0; phase = 2;
      return;
    }
    prev = -1; held = false; mix = 1;
    shape = i; shapeTo = 1; phase = 1; beat = 0;
  }
  /** has this shape's targets, on every plate */
  const ready = (i: number) => i >= 0 && plates.every((p) => p.targets[i]);

  /** freeze where every particle is bound this instant, so a crossing can be
   *  interrupted without anything jumping */
  function snapshot() {
    const c = mix * mix * (3 - 2 * mix), S = cfg.shapes;
    for (const p of plates) {
      const tg = shape >= 0 ? p.targets[shape] : null;
      const tp = prev >= 0 ? (held ? p.hold : p.targets[prev]) : null;
      if (!tg) continue;
      const { hold, when, total } = { hold: p.hold, when: p.when, total: p.sim.total };
      for (let j = 0; j < total; j++) {
        const i3 = j * 3;
        if (!tp) { hold[i3] = tg[i3]; hold[i3 + 1] = tg[i3 + 1]; hold[i3 + 2] = tg[i3 + 2]; continue; }
        const u = clamp(c * (1 + S.stagger) - S.stagger * when[j], 0, 1);
        const e = u * u * (3 - 2 * u);
        hold[i3] = tp[i3] + (tg[i3] - tp[i3]) * e;
        hold[i3 + 1] = tp[i3 + 1] + (tg[i3 + 1] - tp[i3 + 1]) * e;
        hold[i3 + 2] = tp[i3 + 2] + (tg[i3 + 2] - tp[i3 + 2]) * e;
      }
    }
  }
  let introT0 = 0, last: number | undefined, yaw = cfg.camera.isoYaw, tilt = cfg.camera.isoTilt;

  function strike(x: number, y: number) {
    P.tx = x; P.ty = y; P.moved = true;
    // The cursor teleports to wherever the click landed, and a cursor that
    // moves a screen's width in one frame reads to the physics as a hand
    // swiping through at speed — which is the shove you see as a jump. The
    // blast is the impulse here; the travel is not.
    for (const p of plates) p.sim.hadM = false;
    shockT = performance.now() / 1000;
    spinBoost += cfg.strike.spin;
    // a click is a blast, and what settles out of it is the next thing: the
    // reel's own clock starts again from here
    if (reel && exit === 0 && released) { cursor = (cursor + 1) % SHAPES.length; showShape(cursor); beat = 0; }
    if (fluid) for (let k = 0; k < 10; k++) {
      const a = k / 10 * 6.2832, c = Math.cos(a), s = Math.sin(a);
      fluid.splat(x + c * 0.012, y + s * 0.012 * camera.aspect, c * cfg.strike.fluidForce, s * cfg.strike.fluidForce, cfg.strike.fluidDye, cfg.strike.fluidRadius);
    }
  }
  const onDown = (e: PointerEvent) => {
    const el = e.target instanceof Element ? e.target : null;
    if (e.button !== 0 || (el && el.closest(cfg.strike.ignore))) return;
    strike(e.clientX / innerWidth, 1 - e.clientY / innerHeight);
  };
  addEventListener('pointerdown', onDown);

  // The address bar on a phone slides away as you scroll and back as you stop,
  // which fires a resize each way. Rebuilding the canvas for that makes the
  // mark jump about with the scroll, so a height-only change of less than a
  // fifth is ignored: the canvas is pinned to the tall viewport regardless.
  let vw = innerWidth, vhSeen = innerHeight;
  const onResize = () => {
    if (innerWidth === vw && Math.abs(innerHeight - vhSeen) < vhSeen * 0.2) return;
    vw = innerWidth; vhSeen = innerHeight;
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setPixelRatio(dpr()); renderer.setSize(innerWidth, innerHeight);
    lens.resize();
    material.uniforms.uPx.value = cfg.mark.pointPx * renderer.getPixelRatio();
  };
  addEventListener('resize', onResize);

  // ── frame ──────────────────────────────────────────────────────────
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  let running = true, raf = 0;
  /** Once the mark has gone out there is nothing to draw and nothing to
   *  integrate, so the loop stops entirely: no rAF, no fluid, no 7,200
   *  springs, for the whole of the rest of the page. Scrolling back wakes it. */
  let asleep = false;
  function wake() {
    if (!asleep || document.hidden) return;
    asleep = false; running = true; last = undefined;
    fluid?.start(); raf = requestAnimationFrame(frame);
  }
  const ctx = {
    dt: 0, t: 0, camera, pointer: P, introT0: 0, exit: 0, shockT: -9, reduced, cfg,
    out: 0,
  };
  function frame(now: number) {
    const t = now / 1000;
    const dt = Math.max(0, Math.min((now - (last ?? now)) / 1000, 0.05));
    if (last === undefined || !released) introT0 = t;                      // the intro waits to be released
    last = now;

    // the reel turns on its own: cube, crossing, form, crossing, next form.
    // Scrolling takes precedence — nothing changes shape on the way out.
    const S = cfg.shapes;
    if (reel && exit === 0 && released) {
      beat += dt;
      const span = phase === 0 ? S.beat.first : phase === 2 ? S.beat.shape : S.beat.cross;
      if (beat > span) {
        beat = 0;
        // the logo holds while the page settles; after that one form follows
        // another for as long as you stay, and the mark never goes home again
        if (phase === 0) { phase = 1; cursor = 0; showShape(0); }
        else if (phase === 2) { cursor = (cursor + 1) % SHAPES.length; showShape(cursor); }
        else phase = 2;
      }
    } else if (exit > 0 && !parked) {
      // scrolling away stops the reel where it stands. Whatever is up is what
      // gets thrown apart — going home to the cube first meant watching a form
      // undo itself and only then explode, which is two exits, not one.
      parked = true;
    }
    if (exit === 0) parked = false;
    if (shapeTo === 0 && shapeAt < 0.002 && shape >= 0) { shape = -1; prev = -1; held = false; mix = 1; }
    const sRate = dt / S.beat.cross;
    shapeAt = clamp(shapeAt + (shapeTo > shapeAt ? sRate : -sRate), 0, 1);
    const shapeE = shapeAt * shapeAt * (3 - 2 * shapeAt);
    // the direct crossing from one form to the next
    if (mix < 1) mix = clamp(mix + dt / S.beat.cross, 0, 1);
    if (mix >= 1) { prev = -1; held = false; }
    const cross = mix * mix * (3 - 2 * mix);
    // The throw: one curve from the first pixel of scroll to gone. It used to
    // be two — a loosening that swelled and settled, and this — and the second
    // began while the first was still pulling back, so the cloud opened,
    // hesitated, and only then left.
    // It answers the first pixel of scroll and then accelerates: a square law
    // alone is so flat at the start that the mark appears to ignore you for
    // the first stretch, which reads as the page not responding rather than
    // as a thing gathering speed.
    const burst = (0.4 * exit + 0.6 * exit * exit) * cfg.exit.burst;
    // Air. A form that only turns is a model on a turntable; a slow lean at the
    // top, or a rise and fall of the whole thing, is the difference between an
    // object and something standing there. The wave is worked out once a frame
    // and each particle takes its own share of it, so it costs no trigonometry
    // per point.
    const def = shape >= 0 ? SHAPES[shape] : null;
    const swayX = def?.sway ? def.sway * Math.sin(t * 0.62) : 0;
    const swayZ = def?.sway ? def.sway * 0.7 * Math.cos(t * 0.47) : 0;
    const bobY = def?.bob ? def.bob * Math.sin(t * 0.55) : 0;
    const floorY = def ? formFloor(def) : 0;
    const invH = def ? 1 / def.scale : 1;

    // parallax: the mark sways with the cursor inside a hard clamp
    P.x += (P.tx - P.x) * 0.08; P.y += (P.ty - P.y) * 0.08;
    const C = cfg.camera;
    yaw += (C.isoYaw + clamp((P.x - 0.5) * 2 * C.maxYaw, -C.maxYaw, C.maxYaw) - yaw) * C.easing;
    tilt += (C.isoTilt + clamp((P.y - 0.5) * 2 * C.maxTilt, -C.maxTilt, C.maxTilt) - tilt) * C.easing;
    const dist = C.dist * (mobile() ? C.distMobileScale : 1);
    camera.position.set(Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt)).multiplyScalar(dist);
    camera.lookAt(0, 0, 0);

    // the revolution about the diagonal; faster after a strike, and as it drains away on scroll
    spinBoost *= Math.exp(-cfg.intro.spinDecay * dt);
    // once the mark is leaving, the revolution eases down to a drift rather
    // than carrying the whole frame around with it
    const spinFade = 1 - (1 - cfg.exit.spin) * Math.min(1, exit / 0.5);
    // One turn, always the same way round. The diagonal tumble only ever
    // existed to hide the cube's hollow back; a form has a front and a floor,
    // so the axis leans up to vertical as one stands — the mark keeps turning
    // through the change instead of stopping and picking a new direction.
    const rate = (cfg.mark.spin + spinBoost) * spinFade * (1 - shapeE) + cfg.mark.spin * S.turntable * shapeE;
    spinAngle += rate * dt;
    _axis.copy(SPIN_AXIS).lerp(UP, shapeE).normalize();
    qSpin.setFromAxisAngle(_axis, spinAngle);
    qTilt.setFromAxisAngle(AX, Math.sin(t * 0.083) * cfg.mark.wobble * (1 - shapeE));
    L0.quaternion.copy(qSpin).multiply(qTilt);

    L0.updateMatrixWorld(true);

    material.uniforms.uTime.value = t;
    ctx.dt = dt; ctx.t = t; ctx.introT0 = introT0; ctx.exit = exit; ctx.shockT = shockT;
    ctx.out = out;
    material.uniforms.uPx.value = cfg.mark.pointPx * renderer.getPixelRatio();
    material.uniforms.uFlat.value = shapeE * S.flat;
    // an animated form is re-posed once a frame, for every plate at once —
    // both of them while one is crossing into the other
    if (shapeE > 0.0005) {
      if (shape >= 0 && SHAPES[shape].skin) poseShape(shape, t);
      if (prev >= 0 && !held && SHAPES[prev].skin) poseShape(prev, t);
    }
    for (const p of plates) {
      simulate(p.holder, p.points, p.sim, ctx);
      const tg = shape >= 0 ? p.targets[shape] : null;
      const tp = prev >= 0 ? (held ? p.hold : p.targets[prev]) : null;
      if (shapeE > 0.0005 && tg) {
        const { off, home, total } = p.sim, when = p.when;
        for (let j = 0; j < total; j++) {
          const i3 = j * 3;
          // The order particles arrive in. Chance alone gives a cloud that
          // condenses; ordering it by how high the point sits gives a form
          // laid down from the floor up, the way a printer builds one — which
          // is the difference between a cloud settling and a thing being made.
          const key = def
            ? when[j] * (1 - S.print) + clamp((tg[i3 + 1] - floorY) * invH, 0, 1) * S.print
            : when[j];
          const u = clamp(shapeE * (1 + S.stagger) - S.stagger * key, 0, 1);
          const w = u * u * (3 - 2 * u);
          if (w <= 0) continue;
          // where this particle is bound: one form, or somewhere along the
          // line between the one it is leaving and the one it is joining
          let tx = tg[i3], ty = tg[i3 + 1], tz = tg[i3 + 2];
          if (tp) {
            // each particle crosses in its own time, so the cloud shears from
            // one form into the other rather than sliding across as a block
            const c = clamp(cross * (1 + S.stagger) - S.stagger * key, 0, 1);
            const e = c * c * (3 - 2 * c);
            tx = tp[i3] + (tx - tp[i3]) * e;
            ty = tp[i3 + 1] + (ty - tp[i3 + 1]) * e;
            tz = tp[i3 + 2] + (tz - tp[i3 + 2]) * e;
          }
          if (def && w > 0.02) {
            // rooted at the foot, loosest at the head — and each particle
            // takes a slightly different share, so the form bends rather
            // than sliding
            const h = clamp((ty - floorY) * invH, 0, 1);
            const lean = h * h * (0.7 + 0.6 * when[j]) * w;
            tx += swayX * lean;
            tz += swayZ * lean;
            ty += bobY * w;
          }
          // some of the cursor's push survives, so a standing form is still
          // something you can put your hand through
          const keep = 1 - w * (1 - S.touch);
          off[i3] = off[i3] * keep + (tx - home[i3]) * w;
          off[i3 + 1] = off[i3 + 1] * keep + (ty - home[i3 + 1]) * w;
          off[i3 + 2] = off[i3 + 2] * keep + (tz - home[i3 + 2]) * w;
        }
      }
      // and last, the exit: every particle thrown outward from wherever it
      // ended up, form or no form. `over` is each one's own radial, so the
      // cloud comes apart rather than sliding away as a block.
      if (burst > 0) {
        const { off, over, total } = p.sim;
        for (let j = 0; j < total; j++) {
          const i3 = j * 3;
          off[i3] += over[i3] * burst;
          off[i3 + 1] += over[i3 + 1] * burst;
          off[i3 + 2] += over[i3 + 2] * burst;
        }
      }
    }

    lens.render(scene, camera, P);
    // this frame drew nothing — everything is faded out — so it is the last
    // one until something asks for the mark back
    if (out >= 0.999 && exit >= 1) {
      asleep = true; running = false; fluid?.stop();
      return;
    }
    if (running) raf = requestAnimationFrame(frame);
  }
  const onVisibility = () => {
    if (document.hidden) { running = false; cancelAnimationFrame(raf); fluid?.stop(); }
    else if (!running) { running = true; last = undefined; fluid?.start(); raf = requestAnimationFrame(frame); }
  };
  document.addEventListener('visibilitychange', onVisibility);
  raf = requestAnimationFrame(frame);

  return {
    setReady() { released = true; },
    setExit(p) { exit = Math.max(0, Math.min(1, p)); if (exit < 1) wake(); },
    setOut(p) { out = Math.max(0, Math.min(1, p)); if (out < 0.999) wake(); },
    strike,
    showShape,
    get fluid() { return fluid; },
    destroy() {
      running = false; cancelAnimationFrame(raf);
      removeEventListener('pointerdown', onDown); removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      destroyPointer(); lens.dispose(); fluid?.destroy();
      for (const p of plates) p.points.geometry.dispose();
      material.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
