/* ═══════════════════════════════════════════════════════════════════
   The name, letter by letter. Each glyph is its own object: touching one
   hands it the pointer's momentum — a shove along the direction of travel
   and a spin from the torque about its centre — then a spring walks it
   back to its place. Contact also fills it at once, and the fill fades away a
   moment later, so the mark is an outline again by the time you look away.

   The physics is the same shape as GSAP's inertia (velocity in, resistance,
   settle at the origin) written as a spring so the page keeps its own
   integrator and no library.
   ═══════════════════════════════════════════════════════════════════ */

import { SYMBOL } from '@lib/lettermark';

export interface WordmarkLettersConfig {
  shove: number;        // pointer velocity → letter velocity
  spin: number;         // torque → angular velocity, deg/s per unit
  maxShove: number;     // px/s
  maxSpin: number;      // deg/s
  stiffness: number;    // spring back to place
  damping: number;
  spinStiffness: number;
  spinDamping: number;
  hold: number;         // ms a touched letter stays filled
}

export const WORDMARK_LETTERS: WordmarkLettersConfig = {
  shove: 0.15,
  spin: 0.022,
  maxShove: 380,
  maxSpin: 90,
  stiffness: 80,          // a touch stiffer, so a nudged letter is back sooner
  damping: 7.6,
  spinStiffness: 58,
  spinDamping: 6.6,
  hold: 620,
};

interface Letter {
  el: SVGGraphicsElement;
  x: number; y: number; r: number;
  vx: number; vy: number; vr: number;
  timer: number;
}

const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

export interface WordmarkLetters { destroy(): void; }

export function createWordmarkLetters(
  host: HTMLElement,
  config: Partial<WordmarkLettersConfig> = {},
): WordmarkLetters | null {
  const svg = host.querySelector('svg');
  const nodes = Array.from(host.querySelectorAll<SVGGraphicsElement>('[data-letter]'));
  if (!svg || nodes.length === 0) return null;

  const C = { ...WORDMARK_LETTERS, ...config };
  const letters: Letter[] = nodes.map((el) => ({ el, x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0, timer: 0 }));

  // the SVG is drawn in user units, the pointer moves in CSS pixels
  let scale = 1;
  const measure = () => {
    const box = svg.viewBox.baseVal;
    scale = box.width > 0 ? svg.getBoundingClientRect().width / box.width : 1;
  };
  measure();

  // pointer velocity, in px/s, from the last move
  let px = 0, py = 0, pt = 0, vx = 0, vy = 0;
  const onMove = (e: PointerEvent) => {
    const now = e.timeStamp;
    const dt = (now - pt) / 1000;
    if (pt > 0 && dt > 0 && dt < 0.1) { vx = (e.clientX - px) / dt; vy = (e.clientY - py) / dt; }
    px = e.clientX; py = e.clientY; pt = now;
  };
  addEventListener('pointermove', onMove, { passive: true });

  function touch(L: Letter, e: PointerEvent) {
    const b = L.el.getBoundingClientRect();
    const ox = e.clientX - (b.left + b.width / 2);
    const oy = e.clientY - (b.top + b.height / 2);

    // torque about the letter's centre, normalised so spin follows speed
    const lever = Math.hypot(ox, oy) || 1;
    const torque = (ox * vy - oy * vx) / lever;

    L.vx += clamp(vx * C.shove, C.maxShove);
    L.vy += clamp(vy * C.shove, C.maxShove);
    L.vr += clamp(torque * C.spin, C.maxSpin);

    // lit is instant; dropping the class lets CSS fade it back out
    L.el.classList.add('lit');
    clearTimeout(L.timer);
    L.timer = window.setTimeout(() => L.el.classList.remove('lit'), C.hold);
  }

  const enters = letters.map((L) => {
    const fn = (e: PointerEvent) => touch(L, e);
    L.el.addEventListener('pointerenter', fn);
    return fn;
  });

  let raf = 0, last = performance.now(), running = true;
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    if (!running) return;

    for (const L of letters) {
      // a spring home, damped — the shove decays and the letter lands where it started
      L.vx += -C.stiffness * L.x * dt; L.vx *= Math.exp(-C.damping * dt); L.x += L.vx * dt;
      L.vy += -C.stiffness * L.y * dt; L.vy *= Math.exp(-C.damping * dt); L.y += L.vy * dt;
      L.vr += -C.spinStiffness * L.r * dt; L.vr *= Math.exp(-C.spinDamping * dt); L.r += L.vr * dt;

      const still = Math.abs(L.x) + Math.abs(L.y) + Math.abs(L.r) < 0.02
                 && Math.abs(L.vx) + Math.abs(L.vy) + Math.abs(L.vr) < 0.5;
      if (still) {
        if (L.x || L.y || L.r) { L.x = L.y = L.r = 0; L.el.style.transform = ''; }
        continue;
      }
      L.el.style.transform = `translate(${(L.x / scale).toFixed(3)}px, ${(L.y / scale).toFixed(3)}px) rotate(${L.r.toFixed(3)}deg)`;
    }
  }

  const io = new IntersectionObserver(([e]) => { running = e.isIntersecting; last = performance.now(); }, { rootMargin: '20% 0px' });
  io.observe(host);
  const ro = new ResizeObserver(measure);
  ro.observe(host);
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
      removeEventListener('pointermove', onMove);
      letters.forEach((L, i) => { clearTimeout(L.timer); L.el.removeEventListener('pointerenter', enters[i]); });
    },
  };
}
