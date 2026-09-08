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

  // cursor ray → this plate's plane, in the holder's local space
  _inv.copy(holder.matrixWorld).invert();
  let hit = false, speed = 0;
  if (P.moved) {
    _ndc.set(P.tx * 2 - 1, P.ty * 2 - 1); _ray.setFromCamera(_ndc, camera);
    _lo.copy(_ray.ray.origin).applyMatrix4(_inv);
    _ld.copy(_ray.ray.direction).transformDirection(_inv);
    const nd = n[0] * _ld.x + n[1] * _ld.y + n[2] * _ld.z;
    if (Math.abs(nd) > 1e-4) {
      const k = (0.5 - (n[0] * _lo.x + n[1] * _lo.y + n[2] * _lo.z)) / nd;
      _m.copy(_ld).multiplyScalar(k).add(_lo); hit = true;
      if (S.hadM) speed = Math.min(_m.distanceTo(S.mPrev) / Math.max(dt, 1e-3), 6);
      S.mPrev.copy(_m); S.hadM = true;
    }
  } else S.hadM = false;

  const { home, off, ain, sim, intro, over, seedv, iDelay, iDur, vel, stiff, damp, jit, gain, total } = S;
  const stagger = ctx.reduced ? 0 : I.stagger, dur = ctx.reduced ? 0.01 : I.duration;
  const it = t - ctx.introT0, building = it < stagger + dur * 1.25 + 0.1;
  const press = (C.rest + speed * C.speed) * dt * 60 * C.gain;
  // one strike impulse per plate per click, and none before the first click
  const shock = hit && ctx.shockT > 0 && S.shockSeen !== ctx.shockT; if (shock) S.shockSeen = ctx.shockT;
  // the exit: the mark lets go, then bursts outward and goes out with the
  // first screen. It belongs to the hero and to nothing after it.
  const ex = ctx.exit;
  const loosen = ex > 0 ? sm(0, 0.16, ex) * (1 - sm(0.12, 0.45, ex)) : 0;
  const burst = ex > 0 ? sm(0.1, 1, ex) : 0;

  for (let j = 0; j < total; j++) {
    const i3 = j * 3;
    let ox = sim[i3], oy = sim[i3 + 1], oz = sim[i3 + 2];
    let vx = vel[i3], vy = vel[i3 + 1], vz = vel[i3 + 2];
    if (hit) {
      let dx = home[i3] + ox - _m.x, dy = home[i3 + 1] + oy - _m.y, dz = home[i3 + 2] + oz - _m.z;
      const dn = dx * n[0] + dy * n[1] + dz * n[2];            // in-plane distance only
      dx -= dn * n[0]; dy -= dn * n[1]; dz -= dn * n[2];
      const d = Math.hypot(dx, dy, dz);
      const K = cfg.strike, reach = shock ? K.reach : C.reach;
      if (d < reach) {
        const fall = 1 - d / reach;
        // the blast falls away over its own radius, so it is a punch landing
        // where the cursor is rather than a shove the whole mark feels
        const a = shock ? K.press * fall * fall * gain[j] / (d + 0.12) : press * fall * fall * gain[j] / Math.max(d, 0.07);
        const c = Math.cos(jit[j]), s_ = Math.sin(jit[j]);     // rotate the push by this particle's jitter
        const cx = n[1] * dz - n[2] * dy, cy = n[2] * dx - n[0] * dz, cz = n[0] * dy - n[1] * dx;
        vx += (dx * c + cx * s_) * a; vy += (dy * c + cy * s_) * a; vz += (dz * c + cz * s_) * a;
        const lift = a * d * C.lift * gain[j];                  // a breath off the surface
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

    if (ex > 0) {
      const push = loosen * X.loosen + burst * burst * X.burst;
      ox += over[i3] * push;
      oy += over[i3 + 1] * push;
      oz += over[i3 + 2] * push;
    }

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
