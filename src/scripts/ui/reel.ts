/* ═══════════════════════════════════════════════════════════════════
   A reel of stills that changes on its own.

   Every frame is in the DOM from the start and only its opacity moves,
   so a change costs the compositor a crossfade and nothing else — no
   layout, no decode at the moment it matters. The next frame is asked
   for one step ahead, which is the only reason the first change is not
   a flash of nothing.

   It runs only while it is on screen and only if the reader has not
   asked for less motion; a still reel still shows its first frame.
   ═══════════════════════════════════════════════════════════════════ */

export interface Reel { destroy(): void }

export function createReel(el: HTMLElement): Reel {
  const frames = [...el.querySelectorAll<HTMLElement>('[data-reel-frame]')];
  const caption = el.querySelector<HTMLElement>('[data-reel-caption]');
  if (frames.length < 2) return { destroy() {} };

  const hold = Number(el.dataset.reelHold ?? 4200);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let at = 0, timer = 0, live = false;

  /** ask for the frame after this one, so its turn is not spent decoding */
  const warm = (i: number) => {
    const next = frames[(i + 1) % frames.length];
    next.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
      if (img.loading === 'lazy') img.loading = 'eager';
    });
  };

  const show = (i: number) => {
    at = i;
    frames.forEach((f, k) => f.classList.toggle('on', k === i));
    if (caption) caption.textContent = frames[i].dataset.reelFrame ?? '';
    warm(i);
  };

  const tick = () => {
    show((at + 1) % frames.length);
    timer = window.setTimeout(tick, hold);
  };
  const start = () => { if (live || reduced) return; live = true; timer = window.setTimeout(tick, hold); };
  const stop = () => { live = false; clearTimeout(timer); };

  show(0);
  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { rootMargin: '10% 0px' });
  io.observe(el);
  const onVisibility = () => { if (document.hidden) stop(); else start(); };
  document.addEventListener('visibilitychange', onVisibility);

  return {
    destroy() {
      stop(); io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
