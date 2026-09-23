/* ═══════════════════════════════════════════════════════════════════
   The homepage's scroll story: the veil that dims the mark as the hero
   leaves; the statement read a character at a time; the rule drawing
   across; the thread that carries the handover down into the studios; and
   the nav following whichever ground it is over.
   ═══════════════════════════════════════════════════════════════════ */
import type { Hero } from '../hero';

export interface ScrollChoreography { update(): void; destroy(): void; }

const REVEAL_BAND = 0.2;      // how much of a passage is mid-transition at once
const HOLD_DRIFT = 0;         // how far the held half creeps up as the next one arrives, in screens
const HOLD_SHADE = 0.72;      // how far it is put out by the time it is covered
/* The light half does not climb up over the dark one: it arrives as the
   first studio, small, in the middle of the screen — over the word that
   has just come apart — and grows until it is the screen. These are how
   small it starts, how far its corners are rounded while it is a card,
   and how much of the arrival it spends coming into view. */
const GROW_FROM = 0.42;
const GROW_RADIUS = 28;
const GROW_FADE = 0.12;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** The hero is loaded late, so it is read through a getter rather than held. */
export function createScrollChoreography(getHero: () => Hero | null): ScrollChoreography {
  const veil = document.querySelector<HTMLElement>('[data-veil]');
  const readable = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal-words]'));
  const rule = document.querySelector<HTMLElement>('[data-rule]');
  /* The hairline that runs from under the figure down through the studios'
     name to the first studio. It is drawn from the scroll rather than lifted
     into place on arrival: a line that appears all at once is a divider, and
     one that draws downward as you go is the page carrying on. */
  const threads = Array.from(document.querySelectorAll<HTMLElement>('[data-thread]'));
  const drawn: string[] = threads.map(() => '');
  const next = document.querySelector<HTMLElement>('[data-next]');
  /* Anything that lifts into place is watched by the browser rather than
     measured on every scroll: it reports the moment an element crosses the
     lower part of the screen, whether or not a scroll event ever reached us,
     and it costs nothing between times. Once lifted, an element stays lifted. */
  const rising = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); rising.unobserve(e.target); }
  }, { rootMargin: '0px 0px -14% 0px' });
  document.querySelectorAll<HTMLElement>('[data-rise]').forEach((el) => rising.observe(el));
  const hold = document.querySelector<HTMLElement>('[data-hold]');
  const scrim = document.querySelector<HTMLElement>('[data-scrim]');
  /* the light half of the page: its head is where the handover begins, and
     how far it has climbed is what puts the dark half out */
  const light = document.querySelector<HTMLElement>('[data-light]');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // sticky with a negative top: the block scrolls normally until its end meets
  // the bottom of the screen, then holds there while the next half rides over
  let holdTop = 0;
  const fitHold = () => {
    if (!hold) return;
    holdTop = Math.min(0, innerHeight - hold.offsetHeight);
    hold.style.top = holdTop + 'px';
  };

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

  function update() {
    const y = scrollY, vh = innerHeight;
    if (veil) veil.style.opacity = (clamp01((y - vh * 0.45) / (vh * 0.85)) * 0.22).toFixed(3);

    // the mark belongs to the hero and to nothing after it: as the first
    // screen goes by it comes apart, and it is gone before the name arrives
    const hero = getHero();
    hero?.setExit(y / (vh * 0.5));
    hero?.setOut(clamp01((y - vh * 0.3) / (vh * 0.45)));

    for (const { host, units, last } of passages) {
      const r = host.getBoundingClientRect();
      // the sweep runs while the passage crosses the middle of the screen
      const p = clamp01((vh * 0.85 - r.top) / (r.height + vh * 0.25));
      const band = Math.max(16, units.length * REVEAL_BAND);
      const head = p * (units.length + band);
      for (let i = 0; i < units.length; i++) {
        const v = clamp01((head - i) / band);
        const q = Math.round(v * 50) / 50;                    // only write when it actually moves
        if (q === last[i]) continue;
        last[i] = q;
        units[i].style.setProperty('--l', String(q));
        units[i].classList.toggle('on', q > 0.5);             // for browsers without color-mix
      }
    }

    if (rule) rule.classList.toggle('in', rule.getBoundingClientRect().top < vh * 0.88);

    // each thread is full by the time its foot reaches the same line the rule
    // answers to, and empty until its head gets there
    for (let i = 0; i < threads.length; i++) {
      const el = threads[i];
      const p = clamp01((vh * 0.88 - el.getBoundingClientRect().top) / Math.max(1, el.offsetHeight));
      const q = (Math.round(p * 100) / 100).toFixed(2);
      if (q !== drawn[i]) { drawn[i] = q; el.style.setProperty('--draw', q); }
    }

    // how far the light half has arrived over the held one: 0 as its head
    // would reach the bottom of the screen, 1 once it owns the whole of it.
    // Measured from the layout, not the drawn box — the drawn box is moved
    // by the very transform this number drives.
    const over = light ? clamp01((vh - (light.offsetTop - y)) / vh) : 0;
    // the held half creeps up rather than standing still, and goes out
    if (hold) hold.style.top = (holdTop - over * vh * HOLD_DRIFT).toFixed(1) + 'px';
    // …and the light half is told, for the thread it carries over the seam
    if (light) light.style.setProperty('--over', over.toFixed(3));
    if (scrim) scrim.style.opacity = (over * HOLD_SHADE).toFixed(3);

    /* The arrival. While it is arriving the light half is lifted so that
       its head sits at the top of the screen from the first moment, and
       then scaled about the middle of the screen — which is the middle of
       the first studio — from a card to the full screen, clipped to that
       first screen so nothing under the panel shows beneath the card. The
       moment it owns the screen every one of these is taken off, and the
       page is in plain flow again. A reader who asked for less motion has
       the half simply ride up, as it did. */
    if (light && !still) {
      if (over < 1) {
        const e = over * over * (3 - 2 * over);
        const s = GROW_FROM + (1 - GROW_FROM) * e;
        light.style.transformOrigin = `50% ${vh / 2}px`;
        light.style.transform = `translateY(${(-(1 - over) * vh).toFixed(1)}px) scale(${s.toFixed(4)})`;
        light.style.clipPath = `inset(0 0 calc(100% - ${vh}px) 0 round ${((1 - e) * GROW_RADIUS).toFixed(1)}px)`;
        light.style.opacity = clamp01(over / GROW_FADE).toFixed(3);
      } else if (light.style.transform) {
        light.style.transform = ''; light.style.transformOrigin = '';
        light.style.clipPath = ''; light.style.opacity = '';
      }
    }

    /* the nav's colour is not decided here: it reads the section under it,
       wherever it is, which is the only way it can also answer to the black
       footer at the end of a white page (scripts/lifecycle) */
  }

  const onResize = () => { fitHold(); update(); };
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', onResize);
  fitHold(); setTimeout(fitHold, 120); update();

  return { update, destroy() { rising.disconnect(); removeEventListener('scroll', update); removeEventListener('resize', onResize); } };
}
