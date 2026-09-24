import Lenis from 'lenis';

/** The page's smooth scroll, while there is one: each page makes its own and
 *  hands it back to be destroyed on the way out. */
let current: Lenis | null = null;

/* In-page anchors glide instead of jumping, on every page. One listener for
   the whole visit, on the document and in the capture phase, rather than one
   per link: the nav is carried from page to page without being rebuilt, so
   links wired by one page's script went stale on the next, and the router's
   own handler would take a same-page hash before a bubbling one got it.
   A link to this same page with no hash — the nav's Home, on the homepage —
   glides to the top instead of reloading the page it is already on. */
function onClick(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a || a.target === '_blank') return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.pathname !== location.pathname) return;   // another page: let it go

  const el = url.hash ? document.querySelector<HTMLElement>(decodeURIComponent(url.hash)) : null;
  if (url.hash && !el) return;
  e.preventDefault();
  const to: HTMLElement | number = el ?? 0;
  if (current) current.scrollTo(to, { duration: 1.2 });
  else if (el) el.scrollIntoView({ behavior: 'smooth' });
  else scrollTo({ top: 0, behavior: 'smooth' });
}
document.addEventListener('click', onClick, { capture: true });

/** Lenis drives the native scroll, so scroll listeners keep working.
 *  lerp 0.14 follows the wheel closely — it only takes the edge off. */
export function createSmoothScroll(): { destroy(): void } | null {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const lenis = new Lenis({ lerp: 0.14, wheelMultiplier: 1, smoothWheel: true, autoRaf: true });
  current = lenis;
  return {
    destroy() {
      if (current === lenis) current = null;
      lenis.destroy();
    },
  };
}
