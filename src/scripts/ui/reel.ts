/* ═══════════════════════════════════════════════════════════════════
   A reel of stills you scrub with the cursor.

   Nothing changes on its own. The height of the card is divided into
   as many bands as there are projects, and where the pointer stands
   decides which one you are looking at — so running the cursor down the
   card walks through the studio's work, and running it back up walks
   back. The whole card is the control, not just the picture: the words
   are half of it, and reaching for a strip of image to scrub is a game,
   not an interface.

   A change is a curtain, not a fade: the new frame is revealed by
   opening a clip from the edge the cursor came from, over the top of
   the one before it, which is still sitting there underneath.

   Where there is no pointer to speak of, a tap takes the next one.
   ═══════════════════════════════════════════════════════════════════ */

export interface Reel { destroy(): void }

/* Where the pointer is, kept once for every reel on the page. The page moves
   under a still cursor when you scroll, and that is a change of position as
   far as the card is concerned, so a reel has to be able to ask where the
   pointer stands without waiting for it to move. */
const pointer = { x: -1, y: -1, seen: false };
let tracking = false;
function track() {
  if (tracking) return;
  tracking = true;
  addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.seen = true; }, { passive: true });
  addEventListener('pointerleave', () => { pointer.seen = false; });
  document.addEventListener('mouseleave', () => { pointer.seen = false; dispatchEvent(new Event('scroll')); });
}

export function createReel(el: HTMLElement): Reel {
  const frames = [...el.querySelectorAll<HTMLElement>('[data-reel-frame]')];
  if (frames.length < 2) return { destroy() {} };
  const ticks = [...el.querySelectorAll<HTMLElement>('[data-reel-step]')];
  const mark = el.querySelector<HTMLElement>('[data-reel-mark]');

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let at = 0, top = 1, was = false;

  /* Every frame is fetched and decoded before the card is reached. The
     flicker on a change was an image arriving undecoded and painting a frame
     late: a scrub can land three projects away in one move, and only the
     neighbours had been asked for. */
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

  /** `down` is the direction the reel is travelling, not the cursor */
  function show(i: number, down: boolean) {
    if (i === at || i < 0 || i >= frames.length) return;
    const next = frames[i];
    next.style.zIndex = String(++top);
    // The frame that is arriving carries the whole picture; it is only the
    // window onto it that opens, so nothing about the image itself moves.
    // The open is an animation rather than a transition: a transition needs
    // the start value laid out first, and the reflow that forces is where the
    // old version flickered.
    next.style.clipPath = 'inset(0 0 0 0)';
    // the dash for this frame stretches, and the picture in front comes back
    // to its own colour while the ones behind it stay grey
    ticks.forEach((t, k) => t.classList.toggle('on', k === i));
    frames.forEach((f, k) => f.classList.toggle('live', k === i));
    if (!reduced) {
      next.getAnimations().forEach((a) => a.cancel());
      next.animate(
        [{ clipPath: down ? 'inset(0 0 100% 0)' : 'inset(100% 0 0 0)' }, { clipPath: 'inset(0 0 0 0)' }],
        { duration: 620, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      );
    }
    // the frame you were on keeps its place in the stack, directly beneath the
    // one arriving: clearing it dropped it to the bottom, so the curtain
    // opened onto the very first frame instead of onto the one you just left
    at = i;
    warmAll();
  }

  /** the state the reel is built in, and returns to when it is let go */
  function rest() {
    at = 0; top = 1;
    frames.forEach((f, i) => {
      f.getAnimations().forEach((a) => a.cancel());
      f.style.clipPath = i === 0 ? 'inset(0 0 0 0)' : 'inset(0 0 100% 0)';
      f.style.zIndex = i === 0 ? '1' : '';
    });
    ticks.forEach((t, k) => t.classList.toggle('on', k === 0));
    frames.forEach((f, k) => f.classList.toggle('live', k === 0));
  }
  rest();

  /** pick the frame for wherever the pointer is over the card right now */
  const settle = () => {
    const r = el.getBoundingClientRect();
    const inside = pointer.seen && r.height > 0
      && pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
    // the card under the hand says so, and the roll shows only there
    el.classList.toggle('hovering', inside);
    const entering = inside && !was;
    was = inside;
    // A card left behind goes back to its first picture. Otherwise a reel is
    // whatever frame the hand happened to leave it on, and the first project
    // — the one chosen to lead — is the one nobody sees at rest.
    // A card the hand has left keeps the picture it was left on: the reel is
    // a thing you set, not a thing that resets itself the moment you look
    // away. Only the counter goes, with the pane it sits on.
    if (!inside) return;
    const pos = ((pointer.y - r.top) / r.height) * frames.length;
    const band = Math.min(frames.length - 1, Math.max(0, Math.floor(pos)));
    // The marker rides the pointer, not the frame: between two stops while you
    // are between two pictures, so the next one can be seen coming. The stops
    // sit at the centre of each band, so the travel runs from half a band in
    // to half a band from the end.
    if (mark) {
      const t = Math.min(1, Math.max(0, (pos - 0.5) / Math.max(frames.length - 1, 1)));
      mark.style.top = `${(t * 100).toFixed(2)}%`;
    }
    // Arriving on the card takes the frame under the pointer at once: waiting
    // for a third of a band of travel means entering halfway down and being
    // shown the first picture until the hand has moved a long way.
    if (entering) { show(band, band > at); return; }
    // Once on it, hysteresis. A hand at rest still trembles and a page under a
    // still hand moves in steps; either sitting on the line between two bands
    // would flip the frame back and forth — the flicker on the way in.
    let i = at;
    if (pos > at + 1.33) i = band;
    else if (pos < at - 0.33) i = band;
    show(i, i > at);
  };
  const onTap = () => show((at + 1) % frames.length, true);

  // Two things move the pointer across the card: the hand, and the page
  // scrolling underneath a hand that is holding still. Both are answered.
  // A tap takes the next frame for anything that only ever taps.
  track();
  addEventListener('pointermove', settle, { passive: true });
  addEventListener('scroll', settle, { passive: true });
  if (!fine) el.addEventListener('click', onTap);

  return {
    destroy() {
      near.disconnect();
      removeEventListener('pointermove', settle);
      removeEventListener('scroll', settle);
      el.removeEventListener('click', onTap);
    },
  };
}
