/* ═══════════════════════════════════════════════════════════════════
   The clients' row turns over: six marks stand in it, and every so
   often one of them goes out of focus and another comes in where it
   stood — the hero's word and the footer's, done to a picture.

   Which cell turns is chosen at random each time, and it takes the mark
   standing least in the row at that moment. The row stops turning while it
   is off the screen, and does not turn at all for a reader who asked
   for less motion.
   ═══════════════════════════════════════════════════════════════════ */

import { watchSight } from './inSight';

export interface BrandSwap { destroy(): void }

/** how long each mark stands before one of the six is swapped, ms */
const HOLD = 2400;
/** how long the going mark takes to leave before the next is put in */
const OUT = 760;

type Mark = { url: string; alt: string };

export function createBrandSwap(root: HTMLElement): BrandSwap {
  /* the pool is read from the template's image tags, whose paths the build
     has already put under the site's base, rather than kept as data */
  const tpl = root.querySelector<HTMLTemplateElement>('template[data-brand-pool]');
  const pool: Mark[] = tpl
    ? [...tpl.content.querySelectorAll('img')].map((i) => ({ url: i.getAttribute('src') ?? '', alt: i.getAttribute('alt') ?? '' }))
    : [];
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

  /* The mark shown least in the row right now, other than the one being
     replaced — so with fewer marks than cells each still stands at most
     twice, and never three of one mark at once. Ties are broken at random. */
  const pick = (cell: number): number => {
    const count = pool.map((_, i) => showing.filter((x) => x === i).length);
    const others = pool.map((_, i) => i).filter((i) => i !== showing[cell]);
    const least = Math.min(...others.map((i) => count[i]));
    const best = others.filter((i) => count[i] === least);
    return best[Math.floor(Math.random() * best.length)];
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
      let done = false;
      const arrive = () => { if (done) return; done = true; img.onload = img.onerror = null; img.classList.remove('out'); busy = -1; };
      if (img.complete) arrive(); else { img.onload = arrive; img.onerror = arrive; later(arrive, 600); }
    }, OUT);
    timer = window.setTimeout(turn, HOLD);
  };

  /* runs only while the row can be seen — on the screen, and not under the
     light half, which covers it for most of the page */
  const seen = watchSight(root, (in_) => {
    if (in_ && !on) { on = true; timer = window.setTimeout(turn, HOLD); }
    else if (!in_ && on) { on = false; clearTimeout(timer); }
  }, { threshold: 0.2 });

  return {
    destroy() {
      on = false; clearTimeout(timer); seen.destroy();
      timeouts.forEach(clearTimeout);
    },
  };
}
