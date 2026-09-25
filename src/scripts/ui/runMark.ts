/* ═══════════════════════════════════════════════════════════════════
   The small white mark over the run of pictures (a trial, with
   ?hero=metal). The column holds it in the middle of the screen while
   the pictures pass under it; this turns it as they go — a turn and a
   half across the whole run — and brings it in as the run's head
   reaches the middle, where the big mark has just shrunk to its size
   behind the first picture, and out again at the run's foot.
   ═══════════════════════════════════════════════════════════════════ */

export interface RunMark { destroy(): void }

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function createRunMark(root: HTMLElement): RunMark {
  const mark = root.querySelector<SVGSVGElement>('[data-run-mark]');
  if (!mark || new URLSearchParams(location.search).get('hero') !== 'metal') return { destroy() {} };
  document.documentElement.dataset.runMark = '';
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let frame = 0;
  const update = () => {
    frame = 0;
    const r = root.getBoundingClientRect();
    const mid = innerHeight / 2;
    /* 0 as the run's head crosses the middle of the screen, 1 as its foot does */
    const p = (mid - r.top) / Math.max(1, r.height);
    const shown = clamp01(p / 0.04) * clamp01((1 - p) / 0.04);
    mark.style.opacity = shown.toFixed(3);
    const turn = still ? 0 : clamp01(p) * 540;
    mark.style.transform = `perspective(600px) rotateY(${turn.toFixed(1)}deg) rotateX(${(Math.sin(clamp01(p) * Math.PI * 2) * 8).toFixed(1)}deg)`;
  };
  const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  update();
  return { destroy() { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); if (frame) cancelAnimationFrame(frame); } };
}
