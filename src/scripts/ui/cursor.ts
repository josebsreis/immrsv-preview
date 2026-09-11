/* ═══════════════════════════════════════════════════════════════════
   A word beside the pointer, over the things that want one.

   A small pill follows the mouse a step behind it and says what the thing
   under the pointer does — "Explore project" over a studio's work, "Drag"
   over the pile of cards — for as long as the pointer is over something
   marked `data-cursor-hover`; the text is that element's `data-cursor-text`
   and its kind, if any, its `data-cursor-kind`, which the stylesheet uses
   to dress the pill (the drag one carries a marker either side). It never
   replaces the pointer: the arrow, the hand and the grab stay, and the pill
   is a caption to them.

   The pill eases towards the pointer rather than sitting on it, on one
   frame a tick and only while it is moving. Near the right edge it swings
   to the pointer's left so it is never cut off. Mouse only: a touch has no
   hover, so on a phone this does nothing at all.
   ═══════════════════════════════════════════════════════════════════ */

export interface Cursor { destroy(): void }

/** how far the pill sits from the pointer's point */
const GAP = 18;
/** the ease: how much of the remaining distance it closes each frame */
const EASE = 0.22;

export function createCursor(): Cursor {
  const el = document.querySelector<HTMLElement>('[data-cursor]');
  const text = el?.querySelector<HTMLElement>('[data-cursor-text-target]');
  if (!el || !text || !matchMedia('(hover: hover) and (pointer: fine)').matches) return { destroy() {} };

  let mx = -100, my = -100, x = -100, y = -100, raf = 0, on = false;
  let over: HTMLElement | null = null;

  const look = () => {
    const hit = document.elementFromPoint(mx, my)?.closest<HTMLElement>('[data-cursor-hover]') ?? null;
    if (hit === over) return;
    over = hit;
    if (hit) {
      text.textContent = hit.dataset.cursorText ?? '';
      el.dataset.cursorKind = hit.dataset.cursorKind ?? '';
      // the pill is inverted against whatever it is over: it takes the
      // ground of the section under the pointer, and its stylesheet paints
      // it in that ground's ink
      const ground = hit.closest<HTMLElement>('[data-panel], [data-theme]');
      el.dataset.theme = ground?.dataset.panel ?? ground?.dataset.theme ?? document.body.dataset.theme ?? 'dark';
      el.dataset.cursor = 'on';
    } else {
      el.dataset.cursor = '';
    }
  };

  const tick = () => {
    raf = 0;
    x += (mx - x) * EASE; y += (my - y) * EASE;
    // to the pointer's left when there is no room to its right
    const w = el.offsetWidth;
    const flip = x + GAP + w > innerWidth - 8;
    el.style.translate = `${(flip ? x - GAP - w : x + GAP).toFixed(1)}px ${(y + GAP).toFixed(1)}px`;
    if (Math.abs(mx - x) > 0.2 || Math.abs(my - y) > 0.2) raf = requestAnimationFrame(tick);
  };
  const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX; my = e.clientY;
    if (!on) { on = true; x = mx; y = my; }
    look(); wake();
  };
  // the page moving under a still pointer changes what is under it
  const onScroll = () => { if (on) look(); };
  const onLeave = () => { over = null; el.dataset.cursor = ''; };

  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('scroll', onScroll, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', onMove);
      removeEventListener('scroll', onScroll);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      el.dataset.cursor = '';
    },
  };
}
