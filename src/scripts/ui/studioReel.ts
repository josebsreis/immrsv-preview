/* ═══════════════════════════════════════════════════════════════════
   A studio's featured work, stepped by hand.

   The frames are links now — each one opens the project it shows — and
   that is why nothing here follows the pointer. A reel that changes
   under the cursor cannot also be clicked: the thing you were about to
   open moves as you reach for it. So the arrows and the bar drive it,
   hovering does nothing, and what is on screen is what a click opens.

   A change is a curtain, not a fade: the arriving frame is revealed by
   opening a clip from the edge the reel is travelling from, over the
   one before it, which is still sitting underneath.
   ═══════════════════════════════════════════════════════════════════ */

export interface StudioReel { destroy(): void }

const MS = 620;
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

export function createStudioReel(el: HTMLElement): StudioReel {
  const frames = [...el.querySelectorAll<HTMLElement>('[data-reel-frame]')];
  if (frames.length < 2) return { destroy() {} };
  const ticks = [...el.querySelectorAll<HTMLElement>('[data-reel-step]')];
  const fill = el.querySelector<HTMLElement>('[data-reel-fill]');
  const now = el.querySelector<HTMLElement>('[data-reel-now]');
  const prev = el.querySelector<HTMLButtonElement>('[data-reel-prev]');
  const next = el.querySelector<HTMLButtonElement>('[data-reel-next]');
  const n = frames.length;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let at = 0, top = 1;

  /* Every frame is fetched and decoded before it is asked for: a step lands
     on the next picture at once, and an image arriving undecoded paints a
     frame late — which on a curtain is a white flash inside the opening. */
  let warmed = false;
  const near = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting || warmed) return;
    warmed = true;
    near.disconnect();
    for (const f of frames) {
      f.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
        img.loading = 'eager';
        img.decode?.().catch(() => {});
      });
    }
  }, { rootMargin: '60% 0px' });
  near.observe(el);

  /** `down` is the direction the reel is travelling */
  function show(i: number, down: boolean) {
    if (i === at || i < 0 || i >= n) return;
    const frame = frames[i];
    frame.style.zIndex = String(++top);
    // the arriving frame carries the whole picture; only the window onto it
    // opens. An animation rather than a transition: a transition needs its
    // start value laid out first, and that reflow is where it blinks.
    frame.style.clipPath = 'inset(0 0 0 0)';
    if (!reduced) {
      frame.getAnimations().forEach((a) => a.cancel());
      frame.animate([{ clipPath: down ? 'inset(0 0 100% 0)' : 'inset(100% 0 0 0)' },
                     { clipPath: 'inset(0 0 0 0)' }], { duration: MS, easing: EASE });
    }
    // the frame you were on keeps its place in the stack, directly beneath
    at = i;
    mark();
  }

  /** the bar and the count: the bar is how much of the reel has been seen,
   *  so the first frame is a quarter of it rather than nothing */
  function mark() {
    ticks.forEach((t, k) => t.classList.toggle('on', k === at));
    if (fill) fill.style.transform = `scaleX(${((at + 1) / n).toFixed(4)})`;
    if (now) now.textContent = String(at + 1).padStart(2, '0');
    frames.forEach((f, k) => f.setAttribute('aria-hidden', k === at ? 'false' : 'true'));
    // only the frame on show can be reached by the keyboard: the others are
    // links to somewhere the reader cannot see
    frames.forEach((f, k) => f.setAttribute('tabindex', k === at ? '0' : '-1'));
  }

  const step = (by: number) => show((at + by + n) % n, by > 0);

  frames.forEach((f, i) => {
    f.style.clipPath = i === 0 ? 'inset(0 0 0 0)' : 'inset(0 0 100% 0)';
    f.style.zIndex = i === 0 ? '1' : '';
  });
  mark();

  const onPrev = () => step(-1);
  const onNext = () => step(1);
  prev?.addEventListener('click', onPrev);
  next?.addEventListener('click', onNext);

  /** the squares are a way through as well as a place marker */
  const offs: Array<() => void> = [];
  ticks.forEach((t, i) => {
    const go = () => show(i, i > at);
    t.addEventListener('click', go);
    offs.push(() => t.removeEventListener('click', go));
  });

  return {
    destroy() {
      near.disconnect();
      prev?.removeEventListener('click', onPrev);
      next?.removeEventListener('click', onNext);
      offs.forEach((off) => off());
    },
  };
}
