/* ═══════════════════════════════════════════════════════════════════
   The hero: the particle mark, its physics and the lens, as
   one island with a small API the page drives (ready, exit progress,
   strike). All numbers come from HERO_CONFIG; a page can override any.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { HERO_CONFIG, type HeroConfig } from './config';
import { FACE_BASES, SPIN_AXIS, buildCloud, buildPlate, makeParticleMaterial, type PlateSim } from './mark';
import { simulate } from './sim';
import { PIVOT, SHAPES, cloudFor, formFloor, loadCloud, poseInto, shapeTargets, skinnedIndices } from './shapes';
import { loadSkin, skinFor } from './skin';
import { createLens } from './lens';
import { createPointer } from './pointer';

export interface HeroOptions {
  /** where the three.js canvas goes */
  host: HTMLElement;
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
  /** make form `i` next: whatever is standing falls back to the cloud first */
  showShape(i: number): void;
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

  const { pointer: P, destroy: destroyPointer } = createPointer();
  const lens = createLens(renderer, cfg);

  // ── the mark ───────────────────────────────────────────────────────
  const material = makeParticleMaterial(cfg);
  material.uniforms.uPx.value = cfg.mark.pointPx * renderer.getPixelRatio();
  interface Plate { holder: THREE.Group; points: THREE.Points; sim: PlateSim; }
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
    plates.push({ holder, points, sim });
  });
  const L0 = new THREE.Group(); L0.add(inner); scene.add(L0);

  // ── the cloud ──────────────────────────────────────────────────────
  /* Its own thing, beside the cube rather than inside it: the cube turns on
     its diagonal and the cloud must not, or everything it makes would tumble.
     So it hangs off the scene on a pivot of its own, offset the same way the
     cube's inner frame is — the shapes' pivot lands on the origin, where the
     void is — and turns slowly about the vertical, carrying whatever it is. */
  const F = cfg.core;
  const cloudN = mobile() ? F.countMobile : F.count;
  const cloud = buildCloud(cloudN, cfg, material, PIVOT);
  const cloudRoot = new THREE.Group(); cloudRoot.position.set(-vc, -vc, -vc); cloudRoot.add(cloud.points);
  const cloudPivot = new THREE.Group(); cloudPivot.add(cloudRoot);
  /** one array of targets per shape, in the cloud's frame, sampled once */
  const targets: (Float32Array | null)[] = SHAPES.map(() => null);
  /** for an animated shape: which of its points each particle takes */
  const src: (Uint16Array | null)[] = SHAPES.map(() => null);
  /** how far out in that shape each particle lands, 0..1 — a form blooms from
   *  the middle of the cloud outward, which is the one ordering that matches
   *  where it is coming from */
  const rank: (Float32Array | null)[] = SHAPES.map(() => null);
  /** per-particle chance, mixed into every ordering so no front is straight */
  const when = new Float32Array(cloudN);
  for (let j = 0; j < cloudN; j++) when[j] = Math.random();
  /** the swirl's cosine and sine, one pair per speed band, rewritten a frame */
  const bandC = new Float32Array(F.bands), bandS = new Float32Array(F.bands);

  const qSpin = new THREE.Quaternion(), qTilt = new THREE.Quaternion();
  const AX = new THREE.Vector3(1, 0, 0);

  // ── state the page drives ──────────────────────────────────────────
  let released = reduced, exit = 0, out = 0, shockT = -9;
  let spinAngle = 0, spinBoost = cfg.intro.spinBoost;
  let pace = cfg.mark.spinShut;    // the turn's current multiple of cruise, eased
  let swipe = 0, lastTx = 0.5, lastTy = 0.5;

  // ── the reel ───────────────────────────────────────────────────────
  /* The whole of it, in order and once per visit:
   *
   *   arrive    the cube flies in and lands, closed and whole
   *   gather    the cloud comes together in the void out of the dark
   *   settle    it churns there — and this is the wait, the one point in the
   *             visit where something is actually being loaded
   *   bloom     the cloud opens out into a form, and the cube swells up around
   *             it to give it room
   *   hold      the form stands
   *   collapse  it falls back to the cloud, the cube comes part way in, and
   *             settle → bloom go again
   *
   * The cube shuts once. After that it breathes with the reel, and the cloud
   * is what changes inside it — which is the reason for the arrangement: the
   * mark is never the thing that goes away. */
  type Phase = 'arrive' | 'gather' | 'settle' | 'bloom' | 'hold' | 'collapse';
  const reel = cfg.shapes.enabled && !reduced;
  // asked for less motion, there is no reel and so no cloud: the cube arrives
  // and stays, and the cloud's particles are never drawn or integrated
  if (reel) scene.add(cloudPivot);
  let phase: Phase = 'arrive';
  let beat = 0, parked = false;
  let coreAt = 0;        // 0..1 — the cloud, from nothing to there
  let formAt = 0;        // 0..1 — the cloud, from a cloud to the form it is making
  let shape = 0;         // the form the cloud is bound to
  let cursor = -1;       // where the reel has got to
  let queued = -1;       // a form asked for out of turn — by a click

  /** sample shape `i`, once. A shape baked from a model waits for its cloud to
   *  arrive; if that never comes, its field stands in, so the reel is never
   *  held up by the network. */
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
  function rankShape(i: number) {
    const tg = targets[i]; if (!tg) return;
    const r = new Float32Array(cloudN);
    let far = 1e-6;
    for (let j = 0; j < cloudN; j++) {
      r[j] = Math.hypot(tg[j * 3] - PIVOT, tg[j * 3 + 1] - PIVOT, tg[j * 3 + 2] - PIVOT);
      if (r[j] > far) far = r[j];
    }
    for (let j = 0; j < cloudN; j++) r[j] = (r[j] / far) * 0.82 + when[j] * 0.18;
    rank[i] = r;
  }
  function buildShape(i: number) {
    if (targets[i]) return;
    const def = SHAPES[i], skin = def.skin ? skinFor(def.skin) : null;
    if (skin) {
      // an animated form is not a fixed set of targets: each particle is given
      // one of the cloud's points to follow, and where that point is depends
      // on the frame
      src[i] = skinnedIndices(skin.bind, cloud.sim.home, cloudN);
      targets[i] = new Float32Array(cloudN * 3);
      poseShape(i, 0);
    } else {
      targets[i] = shapeTargets(def, cloud.sim.home, cloudN);
    }
    rankShape(i);
  }
  const ready = (i: number) => i >= 0 && !!targets[i] && !!rank[i];

  /* The first form is asked for straight away — it is the thing the loader is
     waiting on, so leaving it to an idle slice would make the cloud churn for
     no reason. The rest can wait for a gap. */
  if (reel) {
    ensureShape(0);
    const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 600));
    SHAPES.forEach((_, i) => { if (i > 0) idle(() => ensureShape(i)); });
  }

  /** move an animated form to where it is at `t` seconds */
  function poseShape(i: number, t: number) {
    const def = SHAPES[i], skin = def.skin ? skinFor(def.skin) : null;
    const sr = src[i], tg = targets[i];
    if (!skin || !sr || !tg) return;
    skin.update(t);
    poseInto(def, skin.pose, sr, tg, 0, 0, 0);
  }

  /** Ask for a form out of turn. It is queued rather than switched to: the
   *  cloud is the only way from one form to another, so whatever is standing
   *  falls back in first. */
  function showShape(i: number) {
    if (!reel || i < 0 || i >= SHAPES.length || coreAt < 1) return;
    ensureShape(i);
    queued = i;
    if (phase === 'hold' || phase === 'bloom') { phase = 'collapse'; beat = 0; }
  }

  let introT0 = 0, begun = false, last: number | undefined, yaw = cfg.camera.isoYaw, tilt = cfg.camera.isoTilt;

  function strike(x: number, y: number) {
    P.tx = x; P.ty = y; P.moved = true;
    // The cursor teleports to wherever the click landed, and a cursor that
    // moves a screen's width in one frame reads to the physics as a hand
    // swiping through at speed — which is the shove you see as a jump. The
    // blast is the impulse here; the travel is not.
    for (const p of plates) p.sim.hadM = false;
    shockT = performance.now() / 1000;
    spinBoost += cfg.strike.spin;
    // a click is a blast, and what settles out of it is the next thing —
    // once there is a cloud to make it out of
    if (reel && exit === 0 && released) showShape((cursor + 1) % SHAPES.length);
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
   *  integrate, so the loop stops entirely: no rAF and no 7,200
   *  springs, for the whole of the rest of the page. Scrolling back wakes it. */
  let asleep = false;
  function wake() {
    if (!asleep || document.hidden) return;
    asleep = false; running = true; last = undefined;
    raf = requestAnimationFrame(frame);
  }
  const ctx = {
    dt: 0, t: 0, camera, pointer: P, introT0: 0, exit: 0, shockT: -9, reduced, cfg,
    out: 0, form: 0, swipe: 0,
  };
  function frame(now: number) {
    const t = now / 1000;
    const dt = Math.max(0, Math.min((now - (last ?? now)) / 1000, 0.05));
    // The intro waits to be released, and then it is on the clock: its start
    // is never moved again. It used to be re-stamped whenever the last frame
    // time was cleared, which is also what a tab coming back does — so a page
    // hidden during the intro replayed it from the first frame on every
    // return, and in a browser that hides the page between every tool call
    // it never got past that frame at all.
    if (!released || !begun) { introT0 = t; begun = released; }
    last = now;

    // The reel turns on its own. Scrolling takes precedence — nothing changes
    // shape on the way out.
    const S = cfg.shapes, O = cfg.open;
    if (reel && exit === 0 && released) {
      beat += dt;
      switch (phase) {
        case 'arrive':
          // the cube lands, whole, and is allowed to be the logo for a moment
          if (beat > S.beat.first) { phase = 'gather'; beat = 0; }
          break;
        case 'gather':
          coreAt = clamp(coreAt + dt / F.gather, 0, 1);
          if (coreAt >= 1) { phase = 'settle'; beat = 0; }
          break;
        case 'settle': {
          // The wait, and the only one. The cloud churns until the form it is
          // about to make has been sampled — the first time round that is the
          // page loading; after it, it is the beat where the cloud is just a
          // cloud. `patience` is the floor under a shape that never arrives.
          const next = queued >= 0 ? queued : (cursor + 1) % SHAPES.length;
          ensureShape(next);
          if (beat > F.settle && (ready(next) || beat > F.patience)) {
            cursor = next; shape = next; queued = -1;
            phase = 'bloom'; beat = 0;
          }
          break;
        }
        case 'bloom':
          formAt = clamp(formAt + dt / F.bloom, 0, 1);
          if (formAt >= 1) { phase = 'hold'; beat = 0; }
          break;
        case 'hold':
          if (beat > S.beat.shape) { phase = 'collapse'; beat = 0; }
          break;
        case 'collapse':
          formAt = clamp(formAt - dt / F.collapse, 0, 1);
          if (formAt <= 0) { phase = 'settle'; beat = 0; }
          break;
      }
    } else if (exit > 0 && !parked) {
      // scrolling away stops the reel where it stands. Whatever is up is what
      // gets thrown apart — going home to the cube first meant watching a form
      // undo itself and only then explode, which is two exits, not one.
      parked = true;
    }
    if (exit === 0) parked = false;
    const coreE = coreAt * coreAt * (3 - 2 * coreAt);
    // The form's easing is not the same both ways. Blooming, it is all at the
    // start — fast out and slow to land, a burst; collapsing, the curve is
    // turned round, so the form holds almost whole and is then taken into
    // the ball in the last stretch. Creation, and the undoing of it, do not
    // look alike, and a single symmetric ease made them the same event.
    const rising = phase === 'bloom' || phase === 'hold';
    const formE = rising ? 1 - Math.pow(1 - formAt, 3) : formAt * formAt * formAt;
    // The cube follows. To `rest` as the cloud gathers; the last of the way as
    // the form comes, springing a little past and settling (easeOutBack); and
    // back in as the form is taken, on exactly that curve inverted — a little
    // past its rest size, then up to it. One movement, forwards and backwards.
    const back = (x: number) => { const u = x - 1, c1 = O.overshoot, c3 = c1 + 1; return 1 + c3 * u * u * u + c1 * u * u; };
    const cubeE = rising ? back(formAt) : 1 - back(1 - formAt);
    const openE = O.rest * coreE + (1 - O.rest) * cubeE;
    // The ball draws in through the settle and the burst opens from there:
    // while it waits it tightens (eased, so it is a gathering rather than a
    // shrink), and as the form comes the tightness is let go with the form's
    // own curve, so nothing steps.
    const sqT = phase === 'settle' ? clamp(beat / F.settle, 0, 1) : 0;
    const squeeze = phase === 'settle' ? sqT * sqT * (3 - 2 * sqT) : rising ? 1 - formE : 0;
    const tight = 1 - F.squeeze * squeeze;

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
    const def = SHAPES[shape];
    const swayX = def?.sway ? def.sway * Math.sin(t * 0.62) : 0;
    const swayZ = def?.sway ? def.sway * 0.7 * Math.cos(t * 0.47) : 0;
    const bobY = def?.bob ? def.bob * Math.sin(t * 0.55) : 0;
    const floorY = def ? formFloor(def) : 0;
    const invH = def ? 1 / def.scale : 1;

    // How fast the cursor is crossing the screen, in the mark's own units: the
    // simulation needs one number every plate can agree on, and each plate's
    // own reading of it depends on how square its face is to the camera.
    const half = Math.tan((cfg.camera.fov * Math.PI) / 360) * cfg.camera.dist;
    swipe = dt > 0 ? Math.min(Math.hypot(P.tx - lastTx, P.ty - lastTy) * 2 * half / dt, 6) : 0;
    lastTx = P.tx; lastTy = P.ty;

    // parallax: the mark sways with the cursor inside a hard clamp
    P.x += (P.tx - P.x) * 0.08; P.y += (P.ty - P.y) * 0.08;
    const C = cfg.camera;
    yaw += (C.isoYaw + clamp((P.x - 0.5) * 2 * C.maxYaw, -C.maxYaw, C.maxYaw) - yaw) * C.easing;
    tilt += (C.isoTilt + clamp((P.y - 0.5) * 2 * C.maxTilt, -C.maxTilt, C.maxTilt) - tilt) * C.easing;
    const dist = C.dist * (mobile() ? C.distMobileScale : 1);
    camera.position.set(Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt)).multiplyScalar(dist);
    camera.lookAt(0, 0, 0);

    // ── the cube: its turn, and its size ───────────────────────────────
    // the revolution about the diagonal; faster after a strike, and as it drains away on scroll
    spinBoost *= Math.exp(-cfg.intro.spinDecay * dt);
    // once the mark is leaving, the revolution eases down to a drift rather
    // than carrying the whole frame around with it
    const spinFade = 1 - (1 - cfg.exit.spin) * Math.min(1, exit / 0.5);
    // The wind-up and the release. Shut and tightening, the turn builds; the
    // burst lets it go. The pace chases a target set by what the reel is
    // doing rather than by the size, at two speeds: winding up is slow and
    // letting go is quick, which is the shape of any release.
    const M = cfg.mark;
    const paceTo = rising ? M.spinOpen : M.spinShut;
    pace += (paceTo - pace) * (1 - Math.exp(-(rising ? M.spinRelease : M.spinWind) * dt));
    spinAngle += (M.spin * pace + spinBoost) * spinFade * dt;
    qSpin.setFromAxisAngle(SPIN_AXIS, spinAngle);
    qTilt.setFromAxisAngle(AX, Math.sin(t * 0.083) * cfg.mark.wobble);
    L0.quaternion.copy(qSpin).multiply(qTilt);
    // The open cube is the closed one, larger. How much larger is the config's
    // number, held back on a screen without the room: the closed cube reaches
    // `reach` across the screen, the room is the shorter half of the viewport,
    // and the scale may take the one up to `fill` of the other and no further.
    const halfH = Math.tan((C.fov * Math.PI) / 360) * dist;
    const room = Math.min(halfH, halfH * camera.aspect) * O.fill;
    const scaleMax = Math.min(O.scale, room / O.reach);
    L0.scale.setScalar(1 + (scaleMax - 1) * openE);
    L0.updateMatrixWorld(true);
    material.uniforms.uScale.value = L0.scale.x;

    // ── the cloud: its turn, its churn ─────────────────────────────────
    // What the cube's turn cannot do for it, the cloud does for itself: one
    // slow turn on the spot, about the vertical, carrying whatever it is.
    cloudPivot.rotation.y = t * S.turn;
    cloudPivot.updateMatrixWorld(true);
    material.uniforms.uTime.value = t;
    // the wander is the cloud's; a standing form keeps a quarter of it, which
    // is the difference between a statue and something alive
    material.uniforms.uChurn.value = F.drift * coreE * (1 - 0.75 * formE) * (1 + 0.8 * squeeze);
    material.uniforms.uFlat.value = formE * S.flat;
    material.uniforms.uPx.value = cfg.mark.pointPx * renderer.getPixelRatio();
    // The swirl, once per band rather than once per particle. The middle of
    // the cloud turns fastest and the outside trails, which is what stops a
    // ball of points from reading as a solid object being rotated.
    for (let k = 0; k < F.bands; k++) {
      const a = (t * F.churn) / (0.4 + (k + 0.5) / F.bands);
      bandC[k] = Math.cos(a); bandS[k] = Math.sin(a);
    }
    // an animated form is re-posed once a frame
    if (formE > 0.0005 && SHAPES[shape].skin) poseShape(shape, t);

    ctx.dt = dt; ctx.t = t; ctx.introT0 = introT0; ctx.exit = exit; ctx.shockT = shockT;
    ctx.out = out;
    ctx.form = coreE;
    ctx.swipe = swipe;

    for (const p of plates) simulate(p.holder, p.points, p.sim, ctx);
    if (reel) {
      simulate(cloudRoot, cloud.points, cloud.sim, ctx);
      const { off, home, ain } = cloud.sim, { wide, band } = cloud;
      const tg = formE > 0.0005 ? targets[shape] : null;
      const rk = tg ? rank[shape] : null;
      const dim = 1 - out * cfg.exit.dim;
      for (let j = 0; j < cloudN; j++) {
        const i3 = j * 3;
        // how far this particle has arrived at all: from the dark, in its turn
        const g = clamp(coreE * (1 + F.spread) - F.spread * when[j], 0, 1);
        const w = g * g * (3 - 2 * g);
        ain[j] = w * dim;
        if (w <= 0) { off[i3] = wide[i3]; off[i3 + 1] = wide[i3 + 1]; off[i3 + 2] = wide[i3 + 2]; continue; }
        // where the cloud holds it, turning
        const k = band[j], ca = bandC[k], sa = bandS[k];
        const ux = (home[i3] - PIVOT) * tight, uz = (home[i3 + 2] - PIVOT) * tight;
        let Tx = PIVOT + ux * ca - uz * sa;
        let Ty = PIVOT + (home[i3 + 1] - PIVOT) * tight;
        let Tz = PIVOT + ux * sa + uz * ca;
        if (tg && rk) {
          // …and where the form wants it. Each particle crosses in its own
          // time, ordered from the middle out, so the cloud opens into the
          // form rather than sliding into it as a block.
          const u = clamp(formE * (1 + F.spread) - F.spread * rk[j], 0, 1);
          const e = u * u * (3 - 2 * u);
          Tx += (tg[i3] - Tx) * e;
          Ty += (tg[i3 + 1] - Ty) * e;
          Tz += (tg[i3 + 2] - Tz) * e;
          if (def && e > 0.02) {
            // rooted at the foot, loosest at the head — and each particle
            // takes a slightly different share, so the form bends rather
            // than sliding
            const h = clamp((Ty - floorY) * invH, 0, 1);
            const lean = h * h * (0.7 + 0.6 * when[j]) * e;
            Tx += swayX * lean;
            Tz += swayZ * lean;
            Ty += bobY * e;
          }
        }
        // still on its way in: the rest of the road from where it started
        const far = 1 - w;
        // some of the cursor's push survives, so the cloud is still
        // something you can put your hand through
        const keep = S.touch;
        off[i3] = off[i3] * keep + (Tx - home[i3]) + wide[i3] * far;
        off[i3 + 1] = off[i3 + 1] * keep + (Ty - home[i3 + 1]) + wide[i3 + 1] * far;
        off[i3 + 2] = off[i3 + 2] * keep + (Tz - home[i3 + 2]) + wide[i3 + 2] * far;
      }
      (cloud.points.geometry.attributes.aIn as THREE.BufferAttribute).needsUpdate = true;
    }
    // and last, the exit: every particle thrown outward from wherever it
    // ended up, form or no form. `over` is each one's own radial, so the
    // cloud comes apart rather than sliding away as a block.
    if (burst > 0) {
      for (const sim of [...plates.map((p) => p.sim), cloud.sim]) {
        const { off, over, total } = sim;
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
      asleep = true; running = false;
      return;
    }
    if (running) raf = requestAnimationFrame(frame);
  }
  /* A hidden tab gets no animation frames, so there is nothing to stop on the
     way out. What matters is the way back: forget the last frame time, or the
     first frame after an absence would integrate the whole of it — and make
     sure the loop is going, because a page that was hidden while it was asleep
     and scrolled back meanwhile has been asked for the mark and not answered.
     It used to cancel itself on hide and count on the matching show to start
     it again; in one embedded browser that show never came, and the hero
     stood at the first frame of its intro for as long as the page was open. */
  const onVisibility = () => {
    if (document.hidden) return;
    last = undefined;
    if (!running && !asleep) { running = true; raf = requestAnimationFrame(frame); }
  };
  document.addEventListener('visibilitychange', onVisibility);
  raf = requestAnimationFrame(frame);

  return {
    setReady() { released = true; },
    setExit(p) { exit = Math.max(0, Math.min(1, p)); if (exit < 1) wake(); },
    setOut(p) { out = Math.max(0, Math.min(1, p)); if (out < 0.999) wake(); },
    strike,
    showShape,
    destroy() {
      running = false; cancelAnimationFrame(raf);
      removeEventListener('pointerdown', onDown); removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      destroyPointer(); lens.dispose();
      for (const p of plates) p.points.geometry.dispose();
      cloud.points.geometry.dispose();
      material.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
