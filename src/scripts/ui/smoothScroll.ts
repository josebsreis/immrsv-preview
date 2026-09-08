import Lenis from 'lenis';

/** Lenis drives the native scroll, so scroll listeners keep working.
 *  lerp 0.14 follows the wheel closely — it only takes the edge off. */
export function createSmoothScroll(): Lenis | null {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const lenis = new Lenis({ lerp: 0.14, wheelMultiplier: 1, smoothWheel: true, autoRaf: true });

  // in-page anchors glide instead of jumping
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"], a[href^="/#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const hash = a.getAttribute('href')!.replace(/^\//, '');
      if (location.pathname !== '/' && a.getAttribute('href')!.startsWith('/#')) return;   // let it navigate
      const el = document.querySelector(hash);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el as HTMLElement, { duration: 1.2 });
    });
  });
  return lenis;
}
