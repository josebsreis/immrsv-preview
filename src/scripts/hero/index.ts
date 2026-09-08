/* ═══════════════════════════════════════════════════════════════════
   The hero: the particle mark, its physics, the lens and the fluid, as
   one island with a small API the page drives (ready, exit progress,
   strike). All numbers come from HERO_CONFIG; a page can override any.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { HERO_CONFIG, type HeroConfig } from './config';
import { FACE_BASES, SPIN_AXIS, buildPlate, makeParticleMaterial, type PlateSim } from './mark';
import { simulate } from './sim';
import { SHAPES, shapeTargets } from './shapes';
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
  /** 0..1 — how far the mark has gone out, once the name has been read */
  setOut(p: number): void;
  /** 0..1 — how far the particles have travelled into the wordmark */
  setMorph(p: number): void;
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
    /** 0..1 per particle: when it leaves, so a form unfolds rather than snaps */
    when: Float32Array;
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
    plates.push({ holder, points, sim, axis, out, homeInner, when, targets: SHAPES.map(() => null) });
  });
  const L0 = new THREE.Group(); L0.add(inner); scene.add(L0);
  const qSpin = new THREE.Quaternion(), qTilt = new THREE.Quaternion(), qUp = new THREE.Quaternion();
  const AX = new THREE.Vector3(1, 0, 0), UP = new THREE.Vector3(0, 1, 0);

  // ── state the page drives ──────────────────────────────────────────
  let ready = reduced, exit = 0, morph = 0, out = 0, shockT = -9;
  let spinAngle = 0, upAngle = 0, spinBoost = cfg.intro.spinBoost;

  // ── the reel ───────────────────────────────────────────────────────
  const reel = cfg.shapes.enabled && !reduced;
  let shape = -1;        // −1 is the cube
  let shapeAt = 0;       // 0..1 — how far the cloud has gone into `shape`
  let shapeTo = 0;       // where it is heading
  let pending = -1;      // a form asked for while another is still standing
  let phase = 0, beat = 0;

  /** sample shape `i` for every plate, once: the fields are authored in the
   *  mark's frame, so a plate's targets are those points less its own offset */
  function ensureShape(i: number) {
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

  function showShape(i: number) {
    if (!reel || i === shape) return;
    if (i < 0) { shapeTo = 0; pending = -1; return; }
    // one form never slides into the next: the cloud goes home through the
    // cube, which is the only reading that makes sense of three loose plates
    if (shapeAt > 0.02 && shape >= 0) { pending = i; shapeTo = 0; phase = 3; beat = 0; return; }
    ensureShape(i); shape = i; shapeTo = 1; phase = 1; beat = 0;
  }
  let introT0 = 0, last: number | undefined, yaw = cfg.camera.isoYaw, tilt = cfg.camera.isoTilt;

  function strike(x: number, y: number) {
    P.tx = x; P.ty = y; P.moved = true;
    shockT = performance.now() / 1000;
    spinBoost += cfg.strike.spin;
    // a click is a blast and a change of form: it comes apart, and what comes
    // back together is the next thing
    if (reel && exit === 0) showShape((shape + 1) % SHAPES.length);
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

  const onResize = () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setPixelRatio(dpr()); renderer.setSize(innerWidth, innerHeight);
    lens.resize();
    material.uniforms.uPx.value = cfg.mark.pointPx * renderer.getPixelRatio();
  };
  addEventListener('resize', onResize);

  // ── frame ──────────────────────────────────────────────────────────
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  let running = true, raf = 0;
  const ctx = {
    dt: 0, t: 0, camera, pointer: P, introT0: 0, exit: 0, shockT: -9, reduced, cfg,
    morph: 0, out: 0, density: 1, mp0: new THREE.Vector3(), mru: new THREE.Vector3(), mvv: new THREE.Vector3(),
  };
  // the wordmark panel's outline: the particles land inside it
  const wordmark = document.querySelector<SVGSVGElement>('[data-wordmark] svg');
  const _p0 = new THREE.Vector3(), _ru = new THREE.Vector3(), _vv = new THREE.Vector3();
  const _right = new THREE.Vector3(), _up = new THREE.Vector3(), _inv = new THREE.Matrix4();

  /** the box the letters live in, in world units on the plane through the origin */
  function letterBox() {
    if (!wordmark) return false;
    const r = wordmark.getBoundingClientRect();
    if (r.width < 1) return false;
    const half = Math.tan((camera.fov * Math.PI) / 360) * camera.position.length();
    const halfW = half * camera.aspect;
    camera.matrixWorld.extractBasis(_right, _up, _p0);            // _p0 is scratch here
    // the top-left corner of the box, and one edge each way
    const nx = (r.left / innerWidth) * 2 - 1, ny = 1 - (r.top / innerHeight) * 2;
    _p0.copy(_right).multiplyScalar(nx * halfW).addScaledVector(_up, ny * half);
    _ru.copy(_right).multiplyScalar((r.width / innerWidth) * 2 * halfW);
    _vv.copy(_up).multiplyScalar((-r.height / innerHeight) * 2 * half);
    return true;
  }
  function frame(now: number) {
    const t = now / 1000;
    const dt = Math.max(0, Math.min((now - (last ?? now)) / 1000, 0.05));
    if (last === undefined || !ready) introT0 = t;                      // the intro waits to be released
    last = now;

    // the reel turns on its own: cube, crossing, form, crossing, next form.
    // Scrolling takes precedence — nothing changes shape on the way out.
    const S = cfg.shapes;
    if (reel && exit === 0 && ready) {
      beat += dt;
      const span = phase === 0 ? S.beat.cube : phase === 2 ? S.beat.shape : S.beat.cross;
      if (beat > span) {
        beat = 0; phase = (phase + 1) % 4;
        if (phase === 1) showShape((shape + 1) % SHAPES.length);
        else if (phase === 3) shapeTo = 0;
      }
    } else if (exit > 0) shapeTo = 0;
    if (shapeTo === 0 && shapeAt < 0.02 && pending >= 0) { const q = pending; pending = -1; ensureShape(q); shape = q; shapeTo = 1; phase = 1; beat = 0; }
    else if (shapeTo === 0 && shapeAt < 0.002 && shape >= 0) shape = -1;
    const sRate = dt / S.beat.cross;
    shapeAt = clamp(shapeAt + (shapeTo > shapeAt ? sRate : -sRate), 0, 1);
    // the letters always win: a form gives way as the name is read
    const shapeE = shapeAt * shapeAt * (3 - 2 * shapeAt) * (1 - morph);

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
    // once the faces are leaving, the revolution eases down to a drift rather
    // than carrying the whole frame around with it
    const spinFade = 1 - (1 - cfg.exit.spin) * Math.min(1, morph / 0.55);
    spinAngle += ((cfg.mark.spin + spinBoost) * spinFade) * (1 - shapeE) * dt;
    upAngle += cfg.mark.spin * S.turntable * shapeE * dt;
    qSpin.setFromAxisAngle(SPIN_AXIS, spinAngle);
    qTilt.setFromAxisAngle(AX, Math.sin(t * 0.083) * cfg.mark.wobble);
    // the diagonal tumble only ever existed to hide the cube's hollow back:
    // a form has a front and a floor, so it turns on a vertical axis instead
    L0.quaternion.copy(qSpin).multiply(qTilt);
    if (shapeE > 0) { qUp.setFromAxisAngle(UP, upAngle); L0.quaternion.slerp(qUp, shapeE); }

    L0.updateMatrixWorld(true);

    material.uniforms.uTime.value = t;
    ctx.dt = dt; ctx.t = t; ctx.introT0 = introT0; ctx.exit = exit; ctx.shockT = shockT;
    ctx.morph = morph > 0 && letterBox() ? morph : 0;
    ctx.out = out;
    if (ctx.morph > 0) {
      const boxPx = wordmark ? wordmark.getBoundingClientRect().width : innerWidth;
      const fit = clamp(boxPx / cfg.morph.fullDensityPx, cfg.morph.minScale, 1);
      ctx.density = Math.min(1, Math.max(cfg.morph.minDensity, fit));
      // the point is sized to the letterform, not to the screen: on a phone the
      // letters are a quarter of the size and so are the points that draw them
      const letterPx = cfg.mark.pointPx * fit * (1 - cfg.morph.thin);
      const px = cfg.mark.pointPx + (letterPx - cfg.mark.pointPx) * ctx.morph;
      material.uniforms.uPx.value = px * renderer.getPixelRatio();
      material.uniforms.uFlat.value = ctx.morph;
    } else {
      material.uniforms.uPx.value = cfg.mark.pointPx * renderer.getPixelRatio();
      material.uniforms.uFlat.value = shapeE * S.flat;
    }
    for (const p of plates) {
      if (ctx.morph > 0) {
        _inv.copy(p.holder.matrixWorld).invert();                 // the box in this plate's space
        ctx.mp0.copy(_p0).applyMatrix4(_inv);
        // transformDirection normalises, so the edge lengths are put back
        ctx.mru.copy(_ru).transformDirection(_inv).multiplyScalar(_ru.length());
        ctx.mvv.copy(_vv).transformDirection(_inv).multiplyScalar(_vv.length());
      }
      simulate(p.holder, p.points, p.sim, ctx);
      const tg = shape >= 0 ? p.targets[shape] : null;
      if (shapeE > 0.0005 && tg) {
        const { off, home, total } = p.sim, when = p.when;
        for (let j = 0; j < total; j++) {
          const u = clamp(shapeE * (1 + S.stagger) - S.stagger * when[j], 0, 1);
          const w = u * u * (3 - 2 * u);
          if (w <= 0) continue;
          const i3 = j * 3;
          // some of the cursor's push survives, so a standing form is still
          // something you can put your hand through
          const keep = 1 - w * (1 - S.touch);
          off[i3] = off[i3] * keep + (tg[i3] - home[i3]) * w;
          off[i3 + 1] = off[i3 + 1] * keep + (tg[i3 + 1] - home[i3 + 1]) * w;
          off[i3 + 2] = off[i3 + 2] * keep + (tg[i3 + 2] - home[i3 + 2]) * w;
        }
      }
    }

    lens.render(scene, camera, P);
    if (running) raf = requestAnimationFrame(frame);
  }
  const onVisibility = () => {
    if (document.hidden) { running = false; cancelAnimationFrame(raf); fluid?.stop(); }
    else if (!running) { running = true; last = undefined; fluid?.start(); raf = requestAnimationFrame(frame); }
  };
  document.addEventListener('visibilitychange', onVisibility);
  raf = requestAnimationFrame(frame);

  return {
    setReady() { ready = true; },
    setExit(p) { exit = Math.max(0, Math.min(1, p)); },
    setMorph(p) { morph = Math.max(0, Math.min(1, p)); },
    setOut(p) { out = Math.max(0, Math.min(1, p)); },
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
