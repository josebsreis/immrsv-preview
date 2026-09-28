/* The studios' heading: the selected work's dial round the name, its two
   rings turning against each other as the page is scrolled past — the
   inner with the scroll, the outer against it — and still when it is. */

export interface StudiosDial { destroy(): void }

/** degrees of turn for every screen scrolled */
const RATE = 24;

export function createStudiosDial(root: HTMLElement): StudiosDial {
  const rings = [...root.querySelectorAll<SVGElement>('[data-dial-ring]')];
  if (!rings.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return { destroy() {} };
  let raf = 0;
  const frame = () => {
    raf = 0;
    const r = root.getBoundingClientRect();
    if (r.bottom < -200 || r.top > innerHeight + 200) return;
    const a = (-r.top / innerHeight) * RATE;
    rings.forEach((el, i) => { el.style.transform = `rotate(${(i ? -a : a).toFixed(2)}deg)`; });
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(frame); };
  addEventListener('scroll', onScroll, { passive: true });
  frame();
  return { destroy() { removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); } };
}
