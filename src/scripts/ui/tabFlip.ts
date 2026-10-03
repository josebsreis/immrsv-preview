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
  /* measured on the scroll only while the tab is near the screen: it read
     its own box on every scroll frame of the whole homepage */
  let near = false;
  const onScroll = () => { if (near && !raf) raf = requestAnimationFrame(frame); };
  // one last measure on the way out too, so it is left lying or standing
  const io = new IntersectionObserver(([e]) => { near = e.isIntersecting; if (!raf) raf = requestAnimationFrame(frame); },
                                      { rootMargin: '25% 0px' });
  io.observe(tab);
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  frame();
  return {
    destroy() {
      io.disconnect();
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    },
  };
}
