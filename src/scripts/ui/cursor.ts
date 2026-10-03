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

   The pill eases towards the pointer rather than sitting on it — by time,
   so it trails the same distance on any screen — and only while it is
   moving. What is under the pointer is asked once a frame, not on every
   move and every scroll event, and the pill's width only when its words
   change. Near the right edge it swings
   to the pointer's left so it is never cut off. Mouse only: a touch has no
   hover, so on a phone this does nothing at all.
   ═══════════════════════════════════════════════════════════════════ */

export interface Cursor { destroy(): void }

/** how far the pill sits from the pointer's point */
const GAP = 18;
/** the ease, in seconds: what closing 0.22 of the way a frame was at 120Hz */
const TAU = 0.035;

export function createCursor(): Cursor {
  const el = document.querySelector<HTMLElement>('[data-cursor]');
  const text = el?.querySelector<HTMLElement>('[data-cursor-text-target]');
  if (!el || !text || !matchMedia('(hover: hover) and (pointer: fine)').matches) return { destroy() {} };

  let mx = -100, my = -100, x = -100, y = -100, raf = 0, on = false, last = 0;
  let over: HTMLElement | null = null, stale = false, w = 0;

  const look = () => {
    stale = false;
    const hit = document.elementFromPoint(mx, my)?.closest<HTMLElement>('[data-cursor-hover]') ?? null;
    if (hit === over) return;
    over = hit;
    if (hit) {
      const words = hit.dataset.cursorText ?? '';
      el.dataset.cursorKind = hit.dataset.cursorKind ?? '';
      el.dataset.cursor = 'on';
      if (text.textContent !== words) { text.textContent = words; w = 0; }
    } else {
      el.dataset.cursor = '';
    }
  };

  const tick = (t: number) => {
    raf = 0;
    if (stale) look();
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60;
    last = t;
    const k = 1 - Math.exp(-dt / TAU);
    x += (mx - x) * k; y += (my - y) * k;
    // to the pointer's left when there is no room to its right
    if (!w) w = el.offsetWidth;
    const flip = x + GAP + w > innerWidth - 8;
    el.style.translate = `${(flip ? x - GAP - w : x + GAP).toFixed(1)}px ${(y + GAP).toFixed(1)}px`;
    if (stale || Math.abs(mx - x) > 0.2 || Math.abs(my - y) > 0.2) raf = requestAnimationFrame(tick);
    else last = 0;
  };
  const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX; my = e.clientY;
    if (!on) { on = true; x = mx; y = my; }
    stale = true; wake();
  };
  // the page moving under a still pointer changes what is under it
  const onScroll = () => { if (on) { stale = true; wake(); } };
  // the face arriving late changes the words' width
  document.fonts?.ready.then(() => { w = 0; });
  const onLeave = () => { over = null; el.dataset.cursor = ''; };

  /* Pressing, over something that is dragged: the pill answers the hand.
     It marks the press, and while the button is down it says which way the
     pointer has gone since — the stylesheet leans the pill's discs apart
     and favours the one on that side. Released, or the pointer let go of
     off the page, it all comes back. */
  let px = 0;
  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !over || over.dataset.cursorKind !== 'drag') return;
    px = e.clientX;
    el.dataset.press = '';
    el.dataset.dir = '';
  };
  const onDrag = (e: PointerEvent) => {
    if (!('press' in el.dataset) || e.pointerType !== 'mouse') return;
    const d = e.clientX - px;
    if (Math.abs(d) > 6) el.dataset.dir = d < 0 ? 'l' : 'r';
  };
  const onUp = () => { delete el.dataset.press; delete el.dataset.dir; };

  addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onDrag, { passive: true });
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('scroll', onScroll, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerdown', onDown);
      removeEventListener('pointermove', onDrag);
      removeEventListener('pointerup', onUp);
      removeEventListener('pointercancel', onUp);
      removeEventListener('scroll', onScroll);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      el.dataset.cursor = '';
    },
  };
}
