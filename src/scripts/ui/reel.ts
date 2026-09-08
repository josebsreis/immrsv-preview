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

export function createReel(el: HTMLElement): Reel {
  const frames = [...el.querySelectorAll<HTMLElement>('[data-reel-frame]')];
  if (frames.length < 2) return { destroy() {} };

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let at = 0, top = 1;

  /** `down` is the direction the reel is travelling, not the cursor */
  function show(i: number, down: boolean) {
    if (i === at || i < 0 || i >= frames.length) return;
    const next = frames[i];
    next.style.zIndex = String(++top);
    // the frame that is arriving carries the whole picture; it is only the
    // window onto it that opens, so nothing about the image itself moves
    if (!reduced) {
      next.style.transition = 'none';
      next.style.clipPath = down ? 'inset(0 0 100% 0)' : 'inset(100% 0 0 0)';
      void next.offsetWidth;                      // let that land before releasing
      next.style.transition = '';
    }
    next.style.clipPath = 'inset(0 0 0 0)';
    frames[at].style.zIndex = '';
    at = i;
    // ask for the neighbours, so a scrub does not stall on a decode
    for (const k of [i + 1, i - 1]) {
      const img = frames[k]?.querySelector<HTMLImageElement>('img');
      if (img && img.loading === 'lazy') img.loading = 'eager';
    }
  }

  frames.forEach((f, i) => { f.style.clipPath = i === 0 ? 'inset(0 0 0 0)' : 'inset(0 0 100% 0)'; });
  frames[0].style.zIndex = '1';

  const onMove = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    if (r.height < 1) return;
    const t = (e.clientY - r.top) / r.height;
    const i = Math.min(frames.length - 1, Math.max(0, Math.floor(t * frames.length)));
    show(i, i > at);
  };
  const onTap = () => show((at + 1) % frames.length, true);

  // the pointer drives it wherever there is one — a stylus and a trackpad
  // both report themselves differently and both work here — and a tap takes
  // the next frame for anything that only ever taps
  el.addEventListener('pointermove', onMove, { passive: true });
  if (!fine) el.addEventListener('click', onTap);

  return {
    destroy() {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('click', onTap);
    },
  };
}
