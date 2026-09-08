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
  const readable = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal-words]'));
  const REVEAL_BAND = 0.2;      // how much of a passage is mid-transition at once
  const rule = document.querySelector<HTMLElement>('[data-rule]');
  const pin = document.querySelector<HTMLElement>('[data-pin]');
  const spacer = document.querySelector<HTMLElement>('[data-spacer]');
  const next = document.querySelector<HTMLElement>('[data-next]');
  const shutter = document.querySelector<HTMLElement>('[data-shutter]');
  const strips = shutter ? Array.from(shutter.children) as HTMLElement[] : [];
  const themed = document.querySelectorAll<HTMLElement>('[data-theme-follows]');
  const rising = Array.from(document.querySelectorAll<HTMLElement>('[data-rise]'));

  /* Every character gets its own span so the text can be lit through, a
     soft band at a time. Elements sharing a [data-reveal-group] are one
     passage: the light crosses all of them as a single sweep, in reading
     order, rather than each paragraph starting again. */
  interface Passage { host: HTMLElement; units: HTMLElement[]; last: number[]; }
  const passages: Passage[] = [];
  const byHost = new Map<HTMLElement, Passage>();

  for (const el of readable) {
    const host = el.closest<HTMLElement>('[data-reveal-group]') ?? el;
    let passage = byHost.get(host);
    if (!passage) { passage = { host, units: [], last: [] }; byHost.set(host, passage); passages.push(passage); }

    const text = el.textContent!.trim();
    el.textContent = '';
    for (const ch of text) {
      if (ch === ' ') { el.appendChild(document.createTextNode(' ')); continue; }
      const span = document.createElement('span');
      span.className = 'rv';
      span.textContent = ch;
      el.appendChild(span);
      passage.units.push(span);
      passage.last.push(-1);
    }
  }

  // sticky with a negative top: the block scrolls normally until its end meets
  // the bottom of the viewport, then holds there through the spacer
  const fitPin = () => { if (pin) pin.style.top = Math.min(0, innerHeight - pin.offsetHeight) + 'px'; };

  function update() {
    const y = scrollY, vh = innerHeight;
    if (veil) veil.style.opacity = (Math.max(0, Math.min(1, (y - vh * 0.45) / (vh * 0.85))) * 0.82).toFixed(3);

    for (const { host, units, last } of passages) {
      const r = host.getBoundingClientRect();
      // the sweep runs while the passage crosses the middle of the screen
      const p = Math.max(0, Math.min(1, (vh * 0.85 - r.top) / (r.height + vh * 0.25)));
      const band = Math.max(16, units.length * REVEAL_BAND);
      const head = p * (units.length + band);
      for (let i = 0; i < units.length; i++) {
        const v = Math.max(0, Math.min(1, (head - i) / band));
        const q = Math.round(v * 50) / 50;                    // only write when it actually moves
        if (q === last[i]) continue;
        last[i] = q;
        units[i].style.setProperty('--l', String(q));
        units[i].classList.toggle('on', q > 0.5);             // for browsers without color-mix
      }
    }
    if (rule) rule.classList.toggle('in', rule.getBoundingClientRect().top < vh * 0.88);
    // once lifted, elements stay lifted — nothing re-animates on the way back
    for (const el of rising) if (!el.classList.contains('in') && el.getBoundingClientRect().top < vh * 0.86) el.classList.add('in');

    if (!spacer || !next) return;
    const exitEnd = spacer.offsetTop - vh + spacer.offsetHeight;
    hero?.setExit((y - vh * 0.25) / (exitEnd - vh * 0.25));

    const sr = spacer.getBoundingClientRect();
    // the first slice of the spacer is a hold: the pinned block sits still and
    // its last block can be read before the shutter starts closing
    const HOLD = 0.3;
    const raw = Math.max(0, Math.min(1, (vh - sr.top) / sr.height));
    const sp = Math.max(0, (raw - HOLD) / (1 - HOLD));
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
