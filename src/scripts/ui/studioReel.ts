/* ═══════════════════════════════════════════════════════════════════
   A studio's featured work: one project at a time, a bar that fills for
   the life of the slide and hands over to the next, and arrows to step
   through by hand — the same instrument as the statement panel and the
   client stories, with a curtain instead of a fade.

   The frames are links; each one opens the project it shows. That is
   why the reel holds still while the pointer is over it: a link that
   moves as you reach for it is a link you cannot click. It also only
   runs while it is on screen, and not at all for a reader who asked for
   less motion — they get the first frame and the arrows.

   A change is a curtain, not a fade: the arriving frame is revealed by
   opening a clip from the side the reel is travelling from — the next
   one comes in from the right, the one before from the left, the way
   the arrows point — over the one before it, still sitting underneath.
   ═══════════════════════════════════════════════════════════════════ */

export interface StudioReel { destroy(): void }

/* The curtain: over a second, and eased at both ends — it gathers itself,
   crosses, and settles — rather than snapping open and coasting. A change of
   picture here is a thing to watch, not a thing to get out of the way. */
const MS = 1100;
const EASE = 'cubic-bezier(0.65, 0, 0.2, 1)';
const pad = (n: number) => String(n).padStart(2, '0');

export function createStudioReel(el: HTMLElement): StudioReel {
  const frames = [...el.querySelectorAll<HTMLElement>('[data-reel-frame]')];
  if (frames.length < 2) return { destroy() {} };
  const band = frames[0].parentElement ?? el;
  const bar = el.querySelector<HTMLElement>('[data-reel-fill]');
  const readout = el.querySelector<HTMLElement>('[data-reel-now]');
  const name = el.querySelector<HTMLElement>('[data-reel-name]');
  const prev = el.querySelector<HTMLButtonElement>('[data-reel-prev]');
  const next = el.querySelector<HTMLButtonElement>('[data-reel-next]');
  const n = frames.length;
  const period = Number(el.dataset.reelInterval ?? 6000);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let at = 0, top = 1, t = 0, last = performance.now(), visible = false, held = false, raf = 0;

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
    i = (i + n) % n;
    t = 0;
    if (i === at) return;
    const frame = frames[i];
    frame.style.zIndex = String(++top);
    // the arriving frame carries the whole picture; only the window onto it
    // opens. An animation rather than a transition: a transition needs its
    // start value laid out first, and that reflow is where it blinks.
    frame.style.clipPath = 'inset(0 0 0 0)';
    if (!still) {
      frame.getAnimations().forEach((a) => a.cancel());
      frame.animate([{ clipPath: down ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)' },
                     { clipPath: 'inset(0 0 0 0)' }], { duration: MS, easing: EASE });
    }
    // the frame you were on keeps its place in the stack, directly beneath
    at = i;
    mark();
  }

  function mark() {
    if (readout) readout.textContent = pad(at + 1);
    if (name) name.textContent = frames[at].dataset.reelFrameName ?? '';
    frames.forEach((f, k) => {
      f.setAttribute('aria-hidden', String(k !== at));
      // only the frame on show can be reached by the keyboard: the others are
      // links to somewhere the reader cannot see
      f.setAttribute('tabindex', k === at ? '0' : '-1');
    });
  }

  function frame(now: number) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));   // a hidden tab can hand back a huge gap
    last = now;
    if (visible && !held) {
      t += (dt * 1000) / period;
      if (t >= 1) show(at + 1, true);
    }
    if (bar) bar.style.transform = `scaleX(${t.toFixed(4)})`;
    raf = requestAnimationFrame(frame);
  }

  /** a step by hand gives the frame it lands on a full turn */
  const step = (by: number) => { show(at + by, by > 0); last = performance.now(); };
  const onPrev = () => step(-1);
  const onNext = () => step(1);
  const hold = () => { held = true; };
  const release = () => { held = false; last = performance.now(); };
  prev?.addEventListener('click', onPrev);
  next?.addEventListener('click', onNext);
  band.addEventListener('pointerenter', hold);
  band.addEventListener('pointerleave', release);
  band.addEventListener('focusin', hold);
  band.addEventListener('focusout', release);

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; last = performance.now(); }, { threshold: 0.35 });
  io.observe(el);

  frames.forEach((f, i) => {
    f.style.clipPath = i === 0 ? 'inset(0 0 0 0)' : 'inset(0 0 0 100%)';
    f.style.zIndex = i === 0 ? '1' : '';
  });
  mark();
  if (!still) raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      near.disconnect(); io.disconnect();
      prev?.removeEventListener('click', onPrev);
      next?.removeEventListener('click', onNext);
      band.removeEventListener('pointerenter', hold);
      band.removeEventListener('pointerleave', release);
      band.removeEventListener('focusin', hold);
      band.removeEventListener('focusout', release);
    },
  };
}
