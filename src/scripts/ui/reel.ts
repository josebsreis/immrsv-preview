/* ═══════════════════════════════════════════════════════════════════
   A reel of stills you scrub.

   With a pointer, the height of the card is divided into as many bands
   as there are projects and where the pointer stands picks one: running
   the cursor down the card walks through the studio's work, and the
   page scrolling under a still hand walks it too. The whole card is the
   control, not just the picture.

   Without one — a phone — the card's own travel up the screen is the
   scrub: it walks its frames as it passes, and the counter shows while
   it is in view.

   A change is a curtain, not a fade: the arriving frame is revealed by
   opening a clip from the edge the reel is travelling from, over the
   frame before it, which is still sitting underneath.

   Every reel on the page settles in one animation frame, from one read
   of the pointer and one of the scroll — never inside the events
   themselves, which arrive many times a frame under a smooth scroller.
   ═══════════════════════════════════════════════════════════════════ */

export interface Reel { destroy(): void }

const pointer = { x: -1, y: -1, seen: false };
const reels = new Set<() => void>();
let scheduled = 0, wired = false;

/** run every reel's settle once, on the next frame — or on the next tick
 *  when the document is not being painted, since a hidden page gets no
 *  frames and would otherwise carry stale state back with it */
function schedule() {
  if (scheduled) return;
  const run = () => { scheduled = 0; reels.forEach((fn) => fn()); };
  scheduled = document.visibilityState === 'visible' ? requestAnimationFrame(run) : setTimeout(run, 0);
}

function wire() {
  if (wired) return;
  wired = true;
  const mark = (e: PointerEvent) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.seen = true; schedule(); };
  addEventListener('pointermove', mark, { passive: true });
  // A pointer that comes back into the window without moving once it is here —
  // returning from another app, or the page scrolling a new element under a
  // hand that is holding still — announces itself with `pointerover` and
  // nothing else. Without this the counter went out when the hand left and
  // stayed out until it was jiggled.
  addEventListener('pointerover', mark, { passive: true });
  addEventListener('pointerdown', mark, { passive: true });
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  // the hand leaving the window is a move to nowhere
  document.addEventListener('mouseleave', () => { pointer.seen = false; schedule(); });
}

export function createReel(el: HTMLElement): Reel {
  const frames = [...el.querySelectorAll<HTMLElement>('[data-reel-frame]')];
  if (frames.length < 2) return { destroy() {} };
  const ticks = [...el.querySelectorAll<HTMLElement>('[data-reel-step]')];
  const fill = el.querySelector<HTMLElement>('[data-reel-fill]');
  const n = frames.length;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hover = matchMedia('(hover: hover)').matches;
  let at = 0, top = 1, live = false;

  /* Every frame is fetched and decoded before the card is reached: a scrub can
     land three projects away in one move, and an image arriving undecoded
     paints a frame late. */
  let warmed = false;
  const warmAll = () => {
    if (warmed) return;
    warmed = true;
    for (const f of frames) {
      f.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
        img.loading = 'eager';
        img.decode?.().catch(() => {});
      });
    }
  };
  const near = new IntersectionObserver(([e]) => { if (e.isIntersecting) { warmAll(); near.disconnect(); } }, { rootMargin: '60% 0px' });
  near.observe(el);

  /** `down` is the direction the reel is travelling */
  function show(i: number, down: boolean) {
    if (i === at || i < 0 || i >= n) return;
    const next = frames[i];
    next.style.zIndex = String(++top);
    // the arriving frame carries the whole picture; only the window onto it
    // opens. An animation rather than a transition: a transition needs its
    // start value laid out first, and that reflow is where it used to blink.
    next.style.clipPath = 'inset(0 0 0 0)';
    ticks.forEach((t, k) => t.classList.toggle('on', k === i));
    if (!reduced) {
      next.getAnimations().forEach((a) => a.cancel());
      next.animate(
        [{ clipPath: down ? 'inset(0 0 100% 0)' : 'inset(100% 0 0 0)' }, { clipPath: 'inset(0 0 0 0)' }],
        { duration: 620, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      );
    }
    // the frame you were on keeps its place in the stack, directly beneath
    at = i;
  }

  /** the bar fills from the first square down to where you are. Its ends are
   *  measured off the squares themselves — centre of the first to centre of
   *  the last — so full means the last square and empty means the first,
   *  exactly, whatever the strip's padding or the root size happens to be */
  function place(pos: number) {
    if (!fill || ticks.length < 2) return;
    const t = Math.min(1, Math.max(0, (pos - 0.5) / Math.max(n - 1, 1)));
    const roll = fill.parentElement!.getBoundingClientRect();
    const a = ticks[0].getBoundingClientRect(), b = ticks[n - 1].getBoundingClientRect();
    const y0 = a.top + a.height / 2 - roll.top, y1 = b.top + b.height / 2 - roll.top;
    fill.style.top = `${y0.toFixed(1)}px`;
    fill.style.height = `${((y1 - y0) * t).toFixed(1)}px`;
  }

  /** the frame for a position, with the switch tied to the stops: it changes
   *  when the bar's head is a sixth of a band short of the next square, from
   *  either side, so the two never disagree by much — and a hand that
   *  trembles on the line does not flip it back and forth */
  function follow(pos: number) {
    const band = Math.min(n - 1, Math.max(0, Math.floor(pos)));
    let i = at;
    if (pos > at + 1.35) i = band;
    else if (pos < at - 0.35) i = band;
    show(i, i > at);
  }

  frames.forEach((f, i) => {
    f.style.clipPath = i === 0 ? 'inset(0 0 0 0)' : 'inset(0 0 100% 0)';
    f.style.zIndex = i === 0 ? '1' : '';
  });
  ticks.forEach((t, k) => t.classList.toggle('on', k === 0));
  place(0.5);

  const settle = () => {
    const r = el.getBoundingClientRect();
    if (r.height < 1) return;

    if (hover) {
      const inside = pointer.seen
        && pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
      const entering = inside && !live;
      live = inside;
      el.classList.toggle('hovering', inside);
      if (!inside) return;
      const pos = ((pointer.y - r.top) / r.height) * n;
      place(pos);
      // arriving takes the frame under the pointer at once; after that the
      // frame follows with a little slack
      if (entering) { const b = Math.min(n - 1, Math.max(0, Math.floor(pos))); show(b, b > at); return; }
      follow(pos);
      return;
    }

    // No pointer: the card's travel through the screen is the scrub. It
    // starts turning as the card's top crosses three quarters of the way up
    // the screen, and has shown its last frame by the time its foot gets
    // there. The counter shows for as long as the card is turning.
    const vh = innerHeight;
    const p = (vh * 0.75 - r.top) / r.height;
    const onScreen = r.bottom > 0 && r.top < vh;
    live = onScreen;
    el.classList.toggle('hovering', onScreen && p > 0 && p < 1.15);
    if (!onScreen) return;
    const pos = Math.min(n - 0.001, Math.max(0, p * n));
    place(pos);
    follow(pos);
  };

  wire();
  reels.add(settle);
  schedule();

  return {
    destroy() {
      near.disconnect();
      reels.delete(settle);
    },
  };
}
