/* ═══════════════════════════════════════════════════════════════════
   A band that runs on its own and takes the scroll with it.

   It drifts at a walking pace when the page is still; scrolling adds to
   it, so the band races while you move and settles when you stop; and
   the direction it drifts follows the direction you are reading, so
   scrolling up turns it round. The squares between the words turn on
   their corner when it does, which is the only tell that anything has
   changed — a square rotated by anything but 45° looks like a square.

   The GSAP version of this is about 70KB of library for one element.
   This is one rAF, one transform, and no dependencies, and it stops
   entirely when the band is off screen.
   ═══════════════════════════════════════════════════════════════════ */

export interface Marquee { destroy(): void }

export function createMarquee(el: HTMLElement): Marquee {
  const track = el.querySelector<HTMLElement>('[data-marquee-track]');
  const first = track?.firstElementChild as HTMLElement | null;
  if (!track || !first) return { destroy() {} };

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** px a second at rest */
  const base = Number(el.dataset.marqueeSpeed ?? 46);
  /** how much of a scrolled pixel the band takes on top of that */
  const drag = Number(el.dataset.marqueeDrag ?? 1.5);

  /* Enough copies to cover the screen and then some: the loop works by
     sliding one run's width and starting again, so there has to be another
     run already standing where the first one was. */
  let runW = first.getBoundingClientRect().width;
  const fill = () => {
    runW = first.getBoundingClientRect().width;
    if (runW < 1) return;
    while (track.getBoundingClientRect().width < innerWidth + runW * 1.5) {
      track.appendChild(first.cloneNode(true));
    }
  };
  fill();
  // the run is as wide as the words in it, and the words are not their final
  // width until the face they are set in has arrived
  document.fonts?.ready.then(() => { x = 0; fill(); });

  let x = 0, dir = -1, pending = 0, lastY = scrollY, raf = 0, last = 0, live = false;

  const onScroll = () => {
    const dy = scrollY - lastY;
    lastY = scrollY;
    // While the band is off screen the loop is stopped, and scroll that piled
    // up in the meantime is not owed to it: handing a frame four hundred
    // pixels of arrears is exactly the jump this used to make when the band
    // came back into view.
    if (!live || Math.abs(dy) < 0.4) return;
    pending += dy;
    // reading down runs it one way, reading back up turns it round
    const next = dy > 0 ? -1 : 1;
    if (next !== dir) {
      dir = next;
      el.dataset.marqueeStatus = dir === -1 ? 'normal' : 'inverted';
    }
  };
  el.dataset.marqueeStatus = 'normal';

  function frame(now: number) {
    const dt = Math.min((now - (last || now)) / 1000, 0.05);
    last = now;
    // The drift, plus what the page scrolled since the last frame: down pushes
    // the band left, up pushes it right, so it always runs with you. The
    // borrowed motion is capped per frame — a flick of a trackpad, or a smooth
    // scroller catching up after a jump, is not a licence to teleport.
    const push = Math.max(-70, Math.min(70, pending)) * drag;
    pending = 0;
    x += base * dir * dt - push;
    if (runW > 0) { x %= runW; if (x > 0) x -= runW; }
    track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    if (live) raf = requestAnimationFrame(frame);
  }

  const start = () => {
    if (live || reduced) return;
    live = true; last = 0; pending = 0; lastY = scrollY;
    raf = requestAnimationFrame(frame);
  };
  const stop = () => { live = false; cancelAnimationFrame(raf); };

  // a band nobody can see does not need to move
  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { rootMargin: '20% 0px' });
  io.observe(el);
  addEventListener('scroll', onScroll, { passive: true });
  const onResize = () => fill();
  addEventListener('resize', onResize);
  const onVisibility = () => { if (document.hidden) stop(); else start(); };
  document.addEventListener('visibilitychange', onVisibility);

  return {
    destroy() {
      stop(); io.disconnect();
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
