/* ═══════════════════════════════════════════════════════════════════
   The hero: the particle mark, its physics, the lens and the fluid, as
   one island with a small API the page drives (ready, exit progress,
   strike). All numbers come from HERO_CONFIG; a page can override any.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { HERO_CONFIG, type HeroConfig } from './config';
import { FACE_BASES, SPIN_AXIS, buildPlate, makeParticleMaterial, type PlateSim } from './mark';
import { simulate } from './sim';
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
  /** release the intro (call when the loader is done) */
  setReady(): void;
  /** 0..1 — the scroll-driven exit */
  setExit(p: number): void;
  /** a strike at viewport coords (0..1, y up) */
  strike(x: number, y: number): void;
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
  const plates: { holder: THREE.Group; points: THREE.Points; sim: PlateSim }[] = [];
  const inner = new THREE.Group();                                    // pivots on the void
  const vc = cfg.mark.voidCentre;
  inner.position.set(-vc, -vc, -vc);
  FACE_BASES.forEach((b, i) => {
    const holder = new THREE.Group();
    const { points, sim } = buildPlate(i, cfg, material, reduced);
    holder.add(points);
    holder.position.set(b.n[0], b.n[1], b.n[2]).multiplyScalar(cfg.mark.separation);
    inner.add(holder);
    plates.push({ holder, points, sim });
  });
  const L0 = new THREE.Group(); L0.add(inner); scene.add(L0);
  const qSpin = new THREE.Quaternion(), qTilt = new THREE.Quaternion(), AX = new THREE.Vector3(1, 0, 0);

  // ── state the page drives ──────────────────────────────────────────
  let ready = reduced, exit = 0, shockT = -9;
  let spinAngle = 0, spinBoost = cfg.intro.spinBoost;
  let introT0 = 0, last: number | undefined, yaw = cfg.camera.isoYaw, tilt = cfg.camera.isoTilt;

  function strike(x: number, y: number) {
    P.tx = x; P.ty = y; P.moved = true;
    shockT = performance.now() / 1000;
    spinBoost += cfg.strike.spin;
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
  const ctx = { dt: 0, t: 0, camera, pointer: P, introT0: 0, exit: 0, shockT: -9, reduced, cfg };
  function frame(now: number) {
    const t = now / 1000;
    const dt = Math.max(0, Math.min((now - (last ?? now)) / 1000, 0.05));
    if (last === undefined || !ready) introT0 = t;                      // the intro waits for the loader
    last = now;

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
    // once the mark lets go there is no shape left to turn: the rotation eases
    // down to a drift, so the dust does not carry the whole frame around
    const spinFade = 1 - (1 - cfg.exit.spin) * Math.min(1, exit / 0.6);
    spinAngle += ((cfg.mark.spin + spinBoost) * spinFade) * dt;
    qSpin.setFromAxisAngle(SPIN_AXIS, spinAngle);
    qTilt.setFromAxisAngle(AX, Math.sin(t * 0.083) * cfg.mark.wobble);
    L0.quaternion.copy(qSpin).multiply(qTilt);
    L0.updateMatrixWorld(true);

    material.uniforms.uTime.value = t;
    ctx.dt = dt; ctx.t = t; ctx.introT0 = introT0; ctx.exit = exit; ctx.shockT = shockT;
    for (const p of plates) simulate(p.holder, p.points, p.sim, ctx);

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
    strike,
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
