/* The studios' heading: the mark's three faces — one for each studio —
   come a little apart as it rises into view, and their names draw out on
   hairlines. One value, --e, 0 to 1, written from the scroll. */

export interface StudiosMap { destroy(): void }

export function createStudiosMap(el: HTMLElement): StudiosMap {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.style.setProperty('--e', '1');
    return { destroy() {} };
  }
  let raf = 0;
  const frame = () => {
    raf = 0;
    const r = el.getBoundingClientRect();
    const vh = innerHeight;
    // from when it is a third of the way up the screen to when it is near the middle
    const t = Math.max(0, Math.min(1, (vh * 0.9 - r.top) / (vh * 0.4)));
    const e = t * t * (3 - 2 * t);
    el.style.setProperty('--e', e.toFixed(3));
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
