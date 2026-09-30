/* ═══════════════════════════════════════════════════════════════════
   The handover's marks: six thin-line solids (lib/formingShapes.ts),
   turning slowly on the spot about a leaning axis, each at its own pace so
   no two turn in step. Every frame each is projected flat and drawn as one
   hairline path. Only the ones on screen are drawn, and nothing at all
   while the section is away or for a reader who asked for less motion —
   they get each solid seen straight on, still.
   ═══════════════════════════════════════════════════════════════════ */
import { SHAPES, pathOf } from '../../lib/formingShapes';

export interface FormingMarks { destroy(): void }

/** rad/s, each mark on its own pace */
const SPEED = [0.35, 0.28, 0.32, 0.4, 0.3, 0.37];

export function createFormingMarks(root: HTMLElement): FormingMarks {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return { destroy() {} };
  const marks = [...root.querySelectorAll<SVGSVGElement>('[data-forming-mark]')].map((el, m) => ({
    path: el.querySelector('path')!, card: el.closest<HTMLElement>('[data-forming-beat]'),
    shape: SHAPES[Number(el.dataset.shape) || 0], speed: SPEED[m % SPEED.length], phase: m * 1.7,
  })).filter((m) => m.path);
  if (marks.length === 0) return { destroy() {} };

  let raf = 0, visible = false;
  const frame = (now: number) => {
    raf = 0;
    const t = now / 1000;
    for (const mk of marks) {
      // a card that cannot be seen is not drawn
      if (mk.card && parseFloat(mk.card.style.getPropertyValue('--v') || '0') <= 0.01) continue;
      mk.path.setAttribute('d', pathOf(mk.shape, t * mk.speed + mk.phase));
    }
    if (visible) raf = requestAnimationFrame(frame);
  };
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
