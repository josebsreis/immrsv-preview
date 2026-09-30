/* ═══════════════════════════════════════════════════════════════════
   The handover's marks: a few plain lines each, drawing what its card
   says (components/home/Forming.astro). Each is shown as its card comes
   up — its lines draw on and its one moving part moves — and put away
   again once the card has gone, so it plays each time a card passes.
   Nothing runs while the section is away.
   ═══════════════════════════════════════════════════════════════════ */

export interface FormingMarks { destroy(): void }

export function createFormingMarks(root: HTMLElement): FormingMarks {
  const marks = [...root.querySelectorAll<SVGSVGElement>('[data-forming-mark]')].map((el) => ({
    el, card: el.closest<HTMLElement>('[data-forming-beat]'),
  }));
  if (marks.length === 0) return { destroy() {} };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    marks.forEach((m) => m.el.setAttribute('data-shown', ''));
    return { destroy() {} };
  }

  let raf = 0, visible = false;
  const frame = () => {
    raf = 0;
    for (const m of marks) {
      const v = parseFloat(m.card?.style.getPropertyValue('--v') || '0');
      // shown once its card is well up; put away once it has all but gone
      if (v > 0.35) m.el.setAttribute('data-shown', '');
      else if (v < 0.02) m.el.removeAttribute('data-shown');
    }
    if (visible) raf = requestAnimationFrame(frame);
  };
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(frame);
  });
  io.observe(root.querySelector('[data-forming-pane]') ?? root);

  return { destroy() { io.disconnect(); cancelAnimationFrame(raf); raf = 0; } };
}
