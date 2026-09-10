/* ═══════════════════════════════════════════════════════════════════
   The page's life, once the client router is in.

   With <ClientRouter /> a navigation swaps the document's body instead of
   loading a new one, so a page's module script runs once for the whole
   visit rather than once per page. Anything a page sets up has to be set
   up again after each swap, and taken down before it — a Lenis left
   running, or a listener left on, belongs to a page that is no longer
   there.

   A page therefore does its wiring inside onPage(), returning whatever it
   made. Everything in this codebase already returns a destroy().
   ═══════════════════════════════════════════════════════════════════ */

export interface Teardown { destroy(): void }
type Made = Teardown | null | undefined | void;

/**
 * Wire a page up, and unwire it when it leaves.
 *
 * `setup` runs on the first paint and after every client-side navigation
 * that lands on `page`; whatever it returns is destroyed when that page is
 * left. It listens on `astro:page-load`, which fires for the initial load
 * too, so a page never has to call it itself.
 *
 * `page` matters. A module stays loaded for the whole visit, so the
 * homepage's listener is still there when the reader is on Work — without
 * this check the homepage would wire itself up over every page that
 * followed it, and a second smooth scroll on one page is a fight, not a
 * feature. The name is matched against `data-page` on the page's own root.
 */
export function onPage(page: string, setup: () => Made[] | Made): void {
  let made: Teardown[] = [];
  const here = () => !!document.querySelector(`[data-page="${page}"]`);

  const start = () => {
    if (!here()) return;
    syncNavTheme();
    const out = setup();
    made = (Array.isArray(out) ? out : [out]).filter(Boolean) as Teardown[];
  };

  const stop = () => {
    for (const thing of made) {
      try { thing.destroy(); } catch { /* a page on its way out is not worth an error */ }
    }
    made = [];
  };

  document.addEventListener('astro:page-load', start);
  document.addEventListener('astro:before-swap', stop);
}

/* The nav survives a navigation, but its arrival does not: `.arrives` plays
   under `body.ready`, the body is replaced on every swap, and a moved node
   restarts its animations anyway — so the bar would blink out and back in on
   each page, having never actually gone anywhere. It arrives once, on the
   page the reader landed on; from then on it only changes colour. Registered
   at module level and idempotent: removing a class twice costs nothing. */
document.addEventListener('astro:before-swap', () => {
  document.querySelectorAll('[data-astro-transition-persist].arrives, [data-astro-transition-persist] .arrives')
    .forEach((el) => el.classList.remove('arrives'));
});

/* ── the nav takes the ground it is standing on ──────────────────────────
   The nav is fixed and persists across navigations, so it has to be told
   what is under it — and every page now has both grounds in it, the black
   footer under a white page as much as the white half under the black hero.

   So the page declares its grounds and this reads them: any element with an
   explicit `data-theme` is a section, and whichever one is under the nav's
   own line wins. Later in the document wins a tie, which is what makes a
   sticky half riding over another resolve correctly.

   It is one owner for the whole site: no page works this out for itself. */
const PROBE = 0.5;                 // where in the nav's own height to read

let sections: HTMLElement[] = [];
let followers: HTMLElement[] = [];
let probeY = 0;

function reread(): void {
  const nav = document.querySelector<HTMLElement>('[data-theme-follows]');
  probeY = nav ? nav.getBoundingClientRect().height * PROBE : 0;
  followers = Array.from(document.querySelectorAll<HTMLElement>('[data-theme-follows]'));
  sections = Array.from(document.querySelectorAll<HTMLElement>('[data-theme]'))
    .filter((el) => el !== document.documentElement && el !== document.body
                 && !el.hasAttribute('data-theme-follows'));
}

function paintNav(): void {
  if (followers.length === 0) return;
  let ground = document.documentElement.dataset.theme ?? 'dark';
  for (const el of sections) {
    const box = el.getBoundingClientRect();
    if (box.top <= probeY && box.bottom > probeY) ground = el.dataset.theme ?? ground;
  }
  for (const el of followers) if (el.dataset.theme !== ground) el.dataset.theme = ground;
}

const onScroll = () => paintNav();
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', () => { reread(); paintNav(); });

/** the nav's ground, recalculated for the page that has just arrived */
export function syncNavTheme(): void {
  reread();
  paintNav();
}
