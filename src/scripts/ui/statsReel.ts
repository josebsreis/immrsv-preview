/* ═══════════════════════════════════════════════════════════════════
   The stats reel: one figure at a time, a bar that fills for the life of
   the slide and hands over to the next, and arrows to step through by
   hand. It only runs while it is on screen, and it doesn't run at all for
   a reader who asked for less motion — they get every slide as a list.
   ═══════════════════════════════════════════════════════════════════ */

export interface StatsReel { destroy(): void; }

const pad = (n: number) => String(n).padStart(2, '0');

export function createStatsReel(root: HTMLElement): StatsReel {
  const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-stat]'));
  if (slides.length === 0) return { destroy() {} };

  const bar = root.querySelector<HTMLElement>('[data-stats-bar]');
  const readout = root.querySelector<HTMLElement>('[data-stats-index]');
  const prev = root.querySelector<HTMLElement>('[data-stats-prev]');
  const next = root.querySelector<HTMLElement>('[data-stats-next]');
  const period = Number(root.dataset.statsInterval ?? 6000);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let i = 0, t = 0, last = performance.now(), visible = false, raf = 0;

  function show(n: number) {
    i = (n + slides.length) % slides.length;
    t = 0;
    slides.forEach((s, k) => { s.classList.toggle('on', k === i); s.setAttribute('aria-hidden', String(k !== i)); });
    if (readout) readout.textContent = pad(i + 1);
  }

  function frame(now: number) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));   // a hidden tab can hand back a huge gap
    last = now;
    if (visible && slides.length > 1) {
      t += (dt * 1000) / period;
      if (t >= 1) show(i + 1);
    }
    if (bar) bar.style.transform = `scaleX(${t.toFixed(4)})`;
    raf = requestAnimationFrame(frame);
  }

  const step = (d: number) => { show(i + d); last = performance.now(); };
  const onPrev = () => step(-1);
  const onNext = () => step(1);
  prev?.addEventListener('click', onPrev);
  next?.addEventListener('click', onNext);

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; last = performance.now(); }, { threshold: 0.35 });
  io.observe(root);

  show(0);
  if (!still) raf = requestAnimationFrame(frame);
  else root.dataset.statsStill = '';                                 // CSS shows every slide instead

  return {
    destroy() {
      cancelAnimationFrame(raf); io.disconnect();
      prev?.removeEventListener('click', onPrev);
      next?.removeEventListener('click', onNext);
    },
  };
}
