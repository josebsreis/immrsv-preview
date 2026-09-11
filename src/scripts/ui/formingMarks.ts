/* ═══════════════════════════════════════════════════════════════════
   The handover's marks: four small solids made of particles, turning.

   Each mark is a set of points in three dimensions, carried on the dots
   themselves. Every frame the solid is turned a little further about a
   tilted axis and projected flat, and each dot is put where its point
   lands — nearer points a touch larger and brighter, so the turn reads as
   depth and not as a flat pattern shuffling. The whole figure moves as one
   thing, which is what keeps it a figure.

   The arrival rides on top: the card's script writes --a, 0 to 1, over the
   first part of its pass, and each dot takes its own slice of that in the
   order it was dealt — from a little way off, and small, to its seat.

   It runs only while the section is on screen, and not at all for a reader
   who asked for less motion: they get each solid seen straight on, still.
   ═══════════════════════════════════════════════════════════════════ */

export interface FormingMarks { destroy(): void }

/** rad/s, each mark on its own pace so the four never turn in step */
const SPEED = [0.35, 0.28, 0.32, 0.4];
/** the axis leans out of the screen, so a ring is never seen edge-on for long */
const TILT = 0.55;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function createFormingMarks(root: HTMLElement): FormingMarks {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return { destroy() {} };
  const marks = [...root.querySelectorAll<HTMLElement>('[data-forming-mark]')].map((el, m) => {
    const dots = [...el.querySelectorAll<HTMLElement>('i')];
    const p = dots.map((d) => (d.dataset.p ?? '').split(',').map(Number));
    return { el, card: el.closest<HTMLElement>('[data-forming-beat]'), dots, p, speed: SPEED[m % SPEED.length], phase: m * 1.7 };
  });
  if (marks.length === 0) return { destroy() {} };

  const ct = Math.cos(TILT), st = Math.sin(TILT);
  let raf = 0, visible = false;

  const frame = (now: number) => {
    raf = 0;
    const t = now / 1000;
    for (const mk of marks) {
      const a = parseFloat(mk.card?.style.getPropertyValue('--a') || '1');
      const th = t * mk.speed + mk.phase, c = Math.cos(th), s = Math.sin(th);
      mk.dots.forEach((d, i) => {
        const [x, y, z, dx, dy, turn] = mk.p[i];
        // turn about the vertical, then lean the whole thing towards the reader
        const x1 = x * c + z * s, z1 = -x * s + z * c;
        const y2 = y * ct - z1 * st, z2 = y * st + z1 * ct;
        // nearer is larger and brighter: z2 runs about ±20
        const near = clamp01(0.5 + z2 / 40);
        const k = clamp01((a - turn * 0.5) / 0.5);
        d.style.translate = `${(x1 + dx * (1 - k)).toFixed(1)}px ${(y2 + dy * (1 - k)).toFixed(1)}px`;
        d.style.scale = String((0.7 + near * 0.6) * k);
        d.style.opacity = ((0.45 + near * 0.55) * k).toFixed(3);
      });
    }
    if (visible) raf = requestAnimationFrame(frame);
  };
  // the pane, not the section: the section is several screens tall and the
  // pane is the one screen of it that is pinned while it plays — and, in the
  // dev pin, the only part of it that is on screen at all
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(frame);
  });
  io.observe(root.querySelector('[data-forming-pane]') ?? root);

  return {
    destroy() {
      io.disconnect();
      cancelAnimationFrame(raf); raf = 0;
    },
  };
}
