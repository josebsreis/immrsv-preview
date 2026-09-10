/* ═══════════════════════════════════════════════════════════════════
   Per-particle physics for one plate: the cursor's push (an inverse
   magnet with per-particle scatter so the hole is never a disc), the
   springs home, the click strike, the scroll-driven exit, and the intro
   composed on top. Writes the `aOff` / `aIn` attributes the shader reads.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import type { HeroConfig } from './config';
import type { PlateSim } from './mark';
import type { Pointer } from './pointer';

export interface SimContext {
  dt: number;
  t: number;
  camera: THREE.Camera;
  pointer: Pointer;
  introT0: number;
  exit: number;          // 0..1 scroll progress of the exit
  out: number;           // 0..1 the fade, as the hero goes by
  form: number;          // 0..1 how far a form is standing, not the cube
  /** how fast the cursor is crossing the screen, in mark units a second */
  swipe: number;
  shockT: number;        // time of the last strike, or < 0
  reduced: boolean;
  cfg: HeroConfig;
}

const _inv = new THREE.Matrix4(), _lo = new THREE.Vector3(), _ld = new THREE.Vector3(), _m = new THREE.Vector3();
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2();
const sm = (a: number, b: number, x: number) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

export function simulate(holder: THREE.Object3D, points: THREE.Points, S: PlateSim, ctx: SimContext): void {
  const { dt, t, camera, pointer: P, cfg } = ctx;
  const n = S.n, C = cfg.sim, I = cfg.intro, X = cfg.exit;

  /* Where the cursor meets the cloud, in this plate's own space.

     For the cube that is the plate's own plane: its particles live on it, and
     meeting them there is what makes the mark feel like three sheets.

     For a standing form it is the wrong plane entirely — the particles have
     left their plate and are somewhere else in the round — so the cursor is
     met on a plane through the middle of the mark, square to the camera. That
     is the plane a form is spread across from where you are looking. */
  const formAll = ctx.form;
  _inv.copy(holder.matrixWorld).invert();
  let hit = false, speed = 0;
  if (P.moved) {
    _ndc.set(P.tx * 2 - 1, P.ty * 2 - 1); _ray.setFromCamera(_ndc, camera);
    _lo.copy(_ray.ray.origin).applyMatrix4(_inv);
    _ld.copy(_ray.ray.direction).transformDirection(_inv);
    const nd = n[0] * _ld.x + n[1] * _ld.y + n[2] * _ld.z;
    if (Math.abs(nd) > 1e-4) {
      const k = (0.5 - (n[0] * _lo.x + n[1] * _lo.y + n[2] * _lo.z)) / nd;
      _m.copy(_ld).multiplyScalar(k).add(_lo);
      hit = true;
      if (S.hadM) speed = Math.min(_m.distanceTo(S.mPrev) / Math.max(dt, 1e-3), 6);
      S.mPrev.copy(_m); S.hadM = true;
    }
  } else S.hadM = false;

  const ex = ctx.exit;
  const { home, off, ain, sim, intro, over, seedv, iDelay, iDur, vel, stiff, damp, jit, gain, total, face } = S;
  const stagger = ctx.reduced ? 0 : I.stagger, dur = ctx.reduced ? 0.01 : I.duration;
  const it = t - ctx.introT0, building = it < stagger + dur * 1.25 + 0.1;
  /* How hard the cursor is pressing. On the cube that follows how fast its
     point travels across the plate — but a plate seen nearly edge-on turns a
     small movement of the hand into an enormous movement of that point, so
     while a form is standing the three plates were each being pushed with a
     different strength from the same hand, and the figure lurched. Once a form
     is up, the speed is the cursor's own across the screen, which every plate
     agrees on. */
  const swipe = speed + (ctx.swipe - speed) * formAll;
  const press = (C.rest + swipe * C.speed) * dt * 60 * C.gain;
  // one strike impulse per plate per click, and none before the first click
  const shock = hit && ctx.shockT > 0 && S.shockSeen !== ctx.shockT; if (shock) S.shockSeen = ctx.shockT;
  // The exit is one motion and it belongs to the hero: the throw is applied
  // there, after any standing form, so every particle leaves from where it
  // actually is. Nothing about it happens here.

  for (let j = 0; j < total; j++) {
    const i3 = j * 3;
    /* Only the face particles are ever anywhere but on this plate. The
       outline stays a flat sheet however far a form has come, so it keeps the
       cube's own gesture — a disc carved out of a plane — while the cloud in
       the middle answers to the line of sight instead. */
    const form = j < face ? formAll : 0;
    let ox = sim[i3], oy = sim[i3 + 1], oz = sim[i3 + 2];
    let vx = vel[i3], vy = vel[i3 + 1], vz = vel[i3 + 2];
    if (hit) {
      const px = home[i3] + ox, py = home[i3 + 1] + oy, pz = home[i3 + 2] + oz;
      /* Two ways of asking how near the cursor a particle is.

         On the cube: how far across its own plate, the depth through the plate
         thrown away. Its particles all sit on that plane, so this carves a
         clean disc out of a sheet.

         On a form: how far from the line of sight itself — the perpendicular
         distance to the cursor's ray — with the push across the screen rather
         than through it. That bores a hole straight through the figure from
         where you are looking, at every depth at once, which is the same
         gesture the cube gives. Measuring from a point at one depth only
         shook the parts that happened to be at that depth. */
      let ax = px - _m.x, ay = py - _m.y, az = pz - _m.z;
      const an = ax * n[0] + ay * n[1] + az * n[2];
      ax -= an * n[0]; ay -= an * n[1]; az -= an * n[2];

      let dx = ax, dy = ay, dz = az;
      if (form > 0.001) {
        const wx = px - _lo.x, wy = py - _lo.y, wz = pz - _lo.z;
        const t = wx * _ld.x + wy * _ld.y + wz * _ld.z;
        const bx = wx - _ld.x * t, by = wy - _ld.y * t, bz = wz - _ld.z * t;
        dx = ax + (bx - ax) * form; dy = ay + (by - ay) * form; dz = az + (bz - az) * form;
      }
      const d = Math.hypot(dx, dy, dz);
      const K = cfg.strike;
      // a form stands about twice the cube's size, so the same hand has to
      // reach further to take hold of the same share of it
      const reach = shock ? K.reach : C.reach * (1 + form * (C.formReach - 1));
      if (d < reach) {
        const fall = 1 - d / reach;
        // the blast falls away over its own radius, so it is a punch landing
        // where the cursor is rather than a shove the whole mark feels
        const a = shock ? K.press * fall * fall * gain[j] / (d + 0.12) : press * fall * fall * gain[j] / Math.max(d, 0.07);
        // the push is turned by this particle's own jitter, about whichever
        // axis it is being pushed around: the plate's normal on the cube, the
        // line of sight on a form
        const c = Math.cos(jit[j]), s_ = Math.sin(jit[j]);
        let rx = n[0] + (_ld.x - n[0]) * form, ry = n[1] + (_ld.y - n[1]) * form, rz = n[2] + (_ld.z - n[2]) * form;
        const rl = Math.hypot(rx, ry, rz) || 1;                // a half-way axis is short
        rx /= rl; ry /= rl; rz /= rl;
        const cx = ry * dz - rz * dy, cy = rz * dx - rx * dz, cz = rx * dy - ry * dx;
        vx += (dx * c + cx * s_) * a; vy += (dy * c + cy * s_) * a; vz += (dz * c + cz * s_) * a;
        // a breath off the plate — a form has no surface to lift off, and
        // lifting toward the camera only reads as wobble
        const lift = a * d * C.lift * gain[j] * (1 - form);
        vx += n[0] * lift; vy += n[1] * lift; vz += n[2] * lift;
      }
    }
    // spring home, per-particle feel
    const k = stiff[j], c = damp[j];
    vx += (-k * ox - c * vx) * dt; vy += (-k * oy - c * vy) * dt; vz += (-k * oz - c * vz) * dt;
    ox += vx * dt; oy += vy * dt; oz += vz * dt;
    sim[i3] = ox; sim[i3 + 1] = oy; sim[i3 + 2] = oz; vel[i3] = vx; vel[i3 + 1] = vy; vel[i3 + 2] = vz;

    if (building) {
      const u = Math.min(Math.max((it - iDelay[j]) / iDur[j], 0), 1);
      if (u < I.charge) {
        // charge: held as a small point that contracts and trembles
        const cc = u / I.charge, squeeze = 0.10 * cc * cc, trem = 0.04 * cc * Math.sin(it * 30 + jit[j] * 40);
        const kk = 1 - squeeze + trem;
        ox += intro[i3] + seedv[i3] * (kk - 1); oy += intro[i3 + 1] + seedv[i3 + 1] * (kk - 1); oz += intro[i3 + 2] + seedv[i3 + 2] * (kk - 1);
        ain[j] = 0.12 + 0.10 * cc;
      } else {
        // grow: out smoothly, a little past the shape, then the fall back
        const v = (u - I.charge) / (1 - I.charge), e = 1 - Math.pow(1 - v, 3);
        const bump = Math.sin(Math.min(v / 0.4, 1) * 1.5708) * Math.pow(1 - Math.max(0, (v - 0.4) / 0.6), 2);
        ox += intro[i3] * (1 - e) + over[i3] * bump; oy += intro[i3 + 1] * (1 - e) + over[i3 + 1] * bump; oz += intro[i3 + 2] * (1 - e) + over[i3 + 2] * bump;
        ain[j] = Math.min(1, e * 1.25);                        // from nothing, brightening as it opens out
      }
    } else ain[j] = 1;

    if (ctx.out > 0) ain[j] *= 1 - ctx.out * X.dim;
    off[i3] = ox; off[i3 + 1] = oy; off[i3 + 2] = oz;
  }
  const geo = points.geometry;
  (geo.attributes.aOff as THREE.BufferAttribute).needsUpdate = true;
  if (building || ex > 0 || !S.settled) {
    (geo.attributes.aIn as THREE.BufferAttribute).needsUpdate = true;
    S.settled = !building && ex === 0;
  }
}
