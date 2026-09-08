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
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** px a second at rest */
  const base = Number(el.dataset.marqueeSpeed ?? 46);
  /** how much of a scrolled pixel the band takes on top of that */
  const drag = Number(el.dataset.marqueeDrag ?? 1.5);

  /* Every track in the band runs off one clock. The words take one direction
     and the squares on the rails take the other, at their own rate, which is
     what gives a flat band a near side and a far one. */
  interface Track { el: HTMLElement; first: HTMLElement; dir: number; rate: number; runW: number; x: number }
  const tracks: Track[] = [];
  el.querySelectorAll<HTMLElement>('[data-marquee-track]').forEach((t) => {
    const first = t.firstElementChild as HTMLElement | null;
    if (!first) return;
    tracks.push({
      el: t, first, x: 0, runW: 0,
      dir: t.dataset.marqueeDir === 'right' ? 1 : -1,
      rate: Number(t.dataset.marqueeRate ?? 1),
    });
  });
  if (!tracks.length) return { destroy() {} };

  /* Enough copies to cover the screen and then some: the loop works by sliding
     one run's width and starting again, so there has to be another run already
     standing where the first one was. */
  const fill = () => {
    for (const t of tracks) {
      t.runW = t.first.getBoundingClientRect().width;
      if (t.runW < 1) continue;
      let guard = 40;
      while (t.el.getBoundingClientRect().width < innerWidth + t.runW * 1.5 && guard-- > 0) {
        t.el.appendChild(t.first.cloneNode(true));
      }
    }
  };
  fill();
  // the runs are as wide as what is in them, and type is not its final width
  // until the face it is set in has arrived
  document.fonts?.ready.then(() => { for (const t of tracks) t.x = 0; fill(); });

  let pending = 0, lastY = scrollY, raf = 0, last = 0, live = false;

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
    const next = dy > 0 ? 1 : -1;
    if (String(next) !== el.dataset.marqueeWay) {
      el.dataset.marqueeWay = String(next);
      el.dataset.marqueeStatus = next === 1 ? 'normal' : 'inverted';
    }
  };
  el.dataset.marqueeStatus = 'normal';
  el.dataset.marqueeWay = '1';

  function frame(now: number) {
    const dt = Math.min((now - (last || now)) / 1000, 0.05);
    last = now;
    // The drift, plus what the page scrolled since the last frame: down pushes
    // the band one way, up the other, so it always runs with you. The borrowed
    // motion is capped per frame — a flick of a trackpad, or a smooth scroller
    // catching up after a jump, is not a licence to teleport.
    const way = el.dataset.marqueeStatus === 'inverted' ? -1 : 1;
    const push = Math.max(-70, Math.min(70, pending)) * drag;
    pending = 0;
    for (const t of tracks) {
      const sign = t.dir * way;
      // the drift follows the way you are reading; the borrowed scroll follows
      // the track's own direction, so the rails always run against the words
      t.x += base * t.rate * sign * dt + push * t.dir * t.rate;
      if (t.runW > 0) { t.x %= t.runW; if (t.x > 0) t.x -= t.runW; }
      t.el.style.transform = `translate3d(${t.x.toFixed(2)}px,0,0)`;
    }
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
