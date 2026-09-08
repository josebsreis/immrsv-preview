/* ═══════════════════════════════════════════════════════════════════
   The homepage's scroll story: the veil that dims the mark as the hero
   leaves; the statement read a character at a time; the rule drawing
   across; the shutter's rows closing at the end of the dark half; and the
   nav following whichever ground it is over.
   ═══════════════════════════════════════════════════════════════════ */
import type { Hero } from '../hero';

export interface ScrollChoreography { update(): void; destroy(): void; }

const REVEAL_BAND = 0.2;      // how much of a passage is mid-transition at once
const ROW_STAGGER = 0.55;     // how much of the shutter's run is spent handing over
const HOLD_DRIFT = 0.22;      // how far the held half creeps up as the next one climbs, in screens
const HOLD_SHADE = 0.62;      // how far it is put out by the time it is covered

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (u: number) => u * u * (3 - 2 * u);

/** The hero is loaded late, so it is read through a getter rather than held. */
export function createScrollChoreography(getHero: () => Hero | null): ScrollChoreography {
  const veil = document.querySelector<HTMLElement>('[data-veil]');
  const readable = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal-words]'));
  const rule = document.querySelector<HTMLElement>('[data-rule]');
  const shutter = document.querySelector<HTMLElement>('[data-shutter-scroll]');
  const rows = shutter ? (Array.from(shutter.children) as HTMLElement[]) : [];
  const next = document.querySelector<HTMLElement>('[data-next]');
  const themed = document.querySelectorAll<HTMLElement>('[data-theme-follows]');
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
  const light = document.querySelector<HTMLElement>('[data-shutter-scroll]')?.parentElement ?? null;

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

    // how far the light half has climbed over the held one: 0 as its head
    // reaches the bottom of the screen, 1 once it owns the whole of it
    const over = light ? clamp01((vh - light.getBoundingClientRect().top) / vh) : 0;
    // the held half creeps up rather than standing still, and goes out
    if (hold) hold.style.top = (holdTop - over * vh * HOLD_DRIFT).toFixed(1) + 'px';
    if (scrim) scrim.style.opacity = (over * HOLD_SHADE).toFixed(3);

    // The shutter: the curtain closes while the section itself is arriving. It
    // begins the instant the band crosses the bottom of the screen and is done
    // as it clears the top, so the first slat of white shows the moment the
    // dark half starts to hold. Timing it against the band's own height meant
    // half a screen of scrolling with the shutter already on the page and
    // every row still shut — the change in scrolling with nothing to show for
    // it. The rows fill from the foot upward, so the white climbs.
    if (shutter && rows.length > 1) {
      const r = shutter.getBoundingClientRect();
      const p = clamp01((vh - r.top) / vh);
      const n = rows.length;
      for (let k = 0; k < n; k++) {
        const start = ((n - 1 - k) / (n - 1)) * ROW_STAGGER;
        const u = clamp01((p - start) / (1 - ROW_STAGGER));
        rows[k].style.transform = `scaleY(${smooth(u).toFixed(4)})`;
      }
      // the nav takes the ground it is standing on
      const onLight = r.top <= vh * 0.06 || (next ? next.getBoundingClientRect().top <= vh * 0.06 : false);
      themed.forEach((el) => { el.dataset.theme = onLight ? 'light' : 'dark'; });
    }
  }

  const onResize = () => { fitHold(); update(); };
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', onResize);
  fitHold(); setTimeout(fitHold, 120); update();

  return { update, destroy() { rising.disconnect(); removeEventListener('scroll', update); removeEventListener('resize', onResize); } };
}
