/* ═══════════════════════════════════════════════════════════════════
   The homepage's scroll story: the veil that dims the mark as the hero
   leaves; the About statement read in a word at a time; the rule drawing
   across; the pinned shutter into the next section; the theme flip; and
   the exit progress handed to the hero.
   ═══════════════════════════════════════════════════════════════════ */
import type { Hero } from '../hero';

export interface ScrollChoreography { update(): void; destroy(): void; }

export function createScrollChoreography(hero: Hero | null): ScrollChoreography {
  const veil = document.querySelector<HTMLElement>('[data-veil]');
  const h2 = document.querySelector<HTMLElement>('[data-reveal-words]');
  const rule = document.querySelector<HTMLElement>('[data-rule]');
  const pin = document.querySelector<HTMLElement>('[data-pin]');
  const spacer = document.querySelector<HTMLElement>('[data-spacer]');
  const next = document.querySelector<HTMLElement>('[data-next]');
  const shutter = document.querySelector<HTMLElement>('[data-shutter]');
  const strips = shutter ? Array.from(shutter.children) as HTMLElement[] : [];
  const themed = document.querySelectorAll<HTMLElement>('[data-theme-follows]');

  // wrap every word of the statement so each can be lit on its own
  const words: HTMLElement[] = [];
  if (h2) {
    const src = h2.textContent!.trim().split(/\s+/);
    h2.textContent = '';
    src.forEach((w) => { const s = document.createElement('span'); s.className = 'w'; s.textContent = w; h2.appendChild(s); h2.appendChild(document.createTextNode(' ')); words.push(s); });
  }

  // sticky with a negative top: the block scrolls normally until its end meets
  // the bottom of the viewport, then holds there through the spacer
  const fitPin = () => { if (pin) pin.style.top = Math.min(0, innerHeight - pin.offsetHeight) + 'px'; };

  function update() {
    const y = scrollY, vh = innerHeight;
    if (veil) veil.style.opacity = (Math.max(0, Math.min(1, (y - vh * 0.45) / (vh * 0.85))) * 0.82).toFixed(3);

    if (h2) {
      const r = h2.getBoundingClientRect();
      const p = (vh * 0.92 - r.top) / (vh * 0.6);                     // fully lit by the upper third
      const lit = Math.round(Math.max(0, Math.min(1, p)) * words.length);
      words.forEach((w, i) => w.classList.toggle('lit', i < lit));
    }
    if (rule) rule.classList.toggle('in', rule.getBoundingClientRect().top < vh * 0.88);

    if (!spacer || !next) return;
    const exitEnd = spacer.offsetTop - vh + spacer.offsetHeight;
    hero?.setExit((y - vh * 0.25) / (exitEnd - vh * 0.25));

    const sr = spacer.getBoundingClientRect();
    const sp = Math.max(0, Math.min(1, (vh - sr.top) / sr.height));
    const N = strips.length, S = 0.62;                                 // bars fill mostly one by one
    strips.forEach((strip, k) => {
      const start = ((N - 1 - k) / (N - 1)) * S;
      const u = Math.max(0, Math.min(1, (sp - start) / (1 - S)));
      strip.style.transform = `scaleY(${(u * u * (3 - 2 * u)).toFixed(4)})`;
    });
    const done = sp >= 0.985;                                          // the scroll settles just short of the limit
    next.style.visibility = done ? 'visible' : 'hidden';
    next.classList.toggle('on', done);
    themed.forEach((el) => { el.dataset.theme = done ? 'light' : 'dark'; });
    if (shutter) shutter.hidden = done;
  }

  const onResize = () => { fitPin(); update(); };
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', onResize);
  fitPin(); setTimeout(fitPin, 100); update();

  return { update, destroy() { removeEventListener('scroll', update); removeEventListener('resize', onResize); } };
}
