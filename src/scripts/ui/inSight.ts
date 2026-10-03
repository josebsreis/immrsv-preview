/* ═══════════════════════════════════════════════════════════════════
   Whether a thing can be seen: on the screen, and not under a section
   that has been laid over it.

   The page stacks its halves — the light half rides over the held dark
   one, the studios' panels lie on one another — so a thing can be in the
   viewport by every measure an IntersectionObserver has and still be
   covered, edge to edge. Whatever covers it says so with `data-covered`
   on an ancestor, and announces the change; this answers both at once,
   so a reel, a timer or a loop stops when it cannot be seen, whichever
   way it went out of sight.
   ═══════════════════════════════════════════════════════════════════ */

const COVER = 'immrsv:cover';

/** said by whatever lays itself over a part of the page, when that changes */
export function announceCover(): void {
  document.dispatchEvent(new Event(COVER));
}

export const isCovered = (el: Element) => !!el.closest('[data-covered]');

/** Calls `cb(true)` when `el` comes into sight and `cb(false)` when it goes,
 *  only on a change. */
export function watchSight(el: Element, cb: (seen: boolean) => void,
                           opts: IntersectionObserverInit = {}): { destroy(): void } {
  let onScreen = false, seen: boolean | null = null;
  const check = () => {
    const now = onScreen && !isCovered(el);
    if (now !== seen) { seen = now; cb(now); }
  };
  const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; check(); }, opts);
  io.observe(el);
  document.addEventListener(COVER, check);
  return {
    destroy() { io.disconnect(); document.removeEventListener(COVER, check); },
  };
}

/** Infinite CSS animations — a pulse, a glimmer — paused while the element
 *  marked `data-pause-unseen` cannot be seen: an animation off the screen
 *  is still worked out every frame in most browsers. */
export function pauseUnseen(root: ParentNode = document): { destroy(): void } {
  const made = [...root.querySelectorAll<HTMLElement>('[data-pause-unseen]')].map((el) =>
    watchSight(el, (seen) => el.toggleAttribute('data-unseen', !seen), { rootMargin: '10% 0px' }));
  return { destroy() { made.forEach((m) => m.destroy()); } };
}
