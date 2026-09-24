/* ═══════════════════════════════════════════════════════════════════
   The clients' row turns over: six marks stand in it, and every so
   often one of them goes out of focus and another comes in where it
   stood — the hero's word and the footer's, done to a picture.

   Which cell turns, and to which mark, is chosen at random each time:
   a mark not standing anywhere in the row if there is one, otherwise
   any other than the one it replaces. The row stops turning while it
   is off the screen, and does not turn at all for a reader who asked
   for less motion.
   ═══════════════════════════════════════════════════════════════════ */

export interface BrandSwap { destroy(): void }

/** how long each mark stands before one of the six is swapped, ms */
const HOLD = 2400;
/** how long the going mark takes to leave before the next is put in */
const OUT = 760;

type Mark = { name: string; url: string; alt: string };

export function createBrandSwap(root: HTMLElement): BrandSwap {
  let pool: Mark[] = [];
  try { pool = JSON.parse(root.dataset.pool ?? '[]'); } catch { pool = []; }
  const cells = [...root.querySelectorAll<HTMLElement>('[data-brand-cell]')];
  if (pool.length < 2 || cells.length === 0) return { destroy() {} };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return { destroy() {} };

  const showing = cells.map((c) => Number(c.dataset.brand) || 0);
  const timeouts = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timeouts.delete(id); fn(); }, ms);
    timeouts.add(id);
  };
  let busy = -1;             // the cell mid-swap, so two never turn at once
  let on = false;
  let timer = 0;

  const pick = (cell: number): number => {
    const here = new Set(showing);
    const fresh = pool.map((_, i) => i).filter((i) => !here.has(i));
    if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)];
    const others = pool.map((_, i) => i).filter((i) => i !== showing[cell]);
    return others[Math.floor(Math.random() * others.length)];
  };

  const turn = () => {
    if (!on) return;
    let cell = Math.floor(Math.random() * cells.length);
    if (cell === busy) cell = (cell + 1) % cells.length;
    const next = pick(cell);
    const img = cells[cell].querySelector<HTMLImageElement>('img');
    if (!img) return;
    busy = cell;
    img.classList.add('out');
    later(() => {
      const m = pool[next];
      img.src = m.url; img.alt = m.alt;
      showing[cell] = next;
      cells[cell].dataset.brand = String(next);
      /* in once the file is there, so a slow one does not blink in half-drawn */
      const arrive = () => { img.classList.remove('out'); busy = -1; };
      if (img.complete) arrive(); else { img.onload = arrive; later(arrive, 600); }
    }, OUT);
    timer = window.setTimeout(turn, HOLD);
  };

  /* runs only while the row is on the screen */
  const seen = new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !on) { on = true; timer = window.setTimeout(turn, HOLD); }
    else if (!e.isIntersecting && on) { on = false; clearTimeout(timer); }
  }, { threshold: 0.2 });
  seen.observe(root);

  return {
    destroy() {
      on = false; clearTimeout(timer); seen.disconnect();
      timeouts.forEach(clearTimeout);
    },
  };
}
