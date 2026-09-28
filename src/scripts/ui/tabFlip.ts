/* The studios' tab: it comes up the screen lying back on its hinge, and
   stands as it arrives. --flip, 1 lying to 0 standing, from the scroll. */

export interface TabFlip { destroy(): void }

export function createTabFlip(tab: HTMLElement): TabFlip {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return { destroy() {} };
  let raf = 0;
  const frame = () => {
    raf = 0;
    const r = tab.getBoundingClientRect();
    const vh = innerHeight;
    // lying as its foot enters the screen, standing by the time it is well over halfway up
    const t = Math.max(0, Math.min(1, (vh - r.bottom) / (vh * 0.62)));
    const e = 1 - Math.pow(1 - t, 3);
    tab.style.setProperty('--flip', (1 - e).toFixed(3));
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(frame); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  frame();
  return {
    destroy() {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    },
  };
}
