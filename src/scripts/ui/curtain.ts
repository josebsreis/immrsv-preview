/* The page change, in three beats:
     1. the page fades away under the nav (which persists and stays put);
     2. the mark assembles in the middle — its three faces coming in from a
        little way off and closing into one — while the next page loads;
     3. the new page is swapped in behind, and as the mark comes apart again
        the ground fades off and the new page appears.

   It wraps the router's own loader rather than racing it, so the swap only
   ever happens behind a covered screen. The layer takes the ground and ink
   of whichever page is under it, so going from the dark home to a light
   project is dark-then-light rather than a flash of the wrong one.
   Registered once; the layer persists, so it is found afresh each time. */

import { groundAt } from '../lifecycle';

const FADE = 280, BUILD = 480, STAGGER = 60, HOLD = 40, APART = 380, REVEAL = 420;
const snap = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const inOut = 'cubic-bezier(0.65, 0, 0.35, 1)';
/** where each face comes from and goes to, in the mark's own units: the top
 *  one from above, the two lower ones from their own sides */
const FROM = [[0, -26], [-23, 14], [23, 14]];
/** how much of that the faces are apart at the ends of the move: a hair,
 *  so the mark reads as one thing turning, not three pieces */
const GAP = 0.3;

let wired = false;

export function createCurtain() {
  if (wired) return;
  wired = true;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* the router's own crossfade is not wanted under the curtain; the swap
     copies the new page's attributes onto <html>, so it is set again after */
  const mark = () => { document.documentElement.dataset.curtained = ''; };
  mark();
  document.addEventListener('astro:after-swap', mark);

  const el = () => document.querySelector<HTMLElement>('[data-curtain]');
  const faces = (c: HTMLElement) => [...c.querySelectorAll<SVGPathElement>('path')];
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  /** the ground and the ink of the page as it is now */
  /* the ground and ink of whatever section is in the middle of the screen
     — not the page's base, which on the home page is dark under light
     sections — so a light section going to a light page stays light */
  const tone = (c: HTMLElement, blend: boolean) => {
    const { ground, ink } = groundAt();
    // set outright as it starts: blended, it came up from whatever colour it
    // was last used on — the dark home under a light page, as a grey flash
    if (!blend) { c.style.transition = 'none'; c.querySelectorAll('path').forEach((p) => { p.style.transition = 'none'; }); }
    c.style.setProperty('--c-ground', ground);
    c.style.setProperty('--c-ink', ink);
    if (!blend) {
      void c.offsetWidth;
      c.style.transition = '';
      c.querySelectorAll('path').forEach((p) => { p.style.transition = ''; });
    }
  };
  let covered = false;

  document.addEventListener('astro:before-preparation', (e) => {
    const ev = e as Event & { loader: () => Promise<void> };
    const load = ev.loader;
    ev.loader = async () => {
      const c = el();
      if (!c) return load();
      c.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      tone(c, false);
      c.classList.add('on');
      // 1. the page goes
      const fade = c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE, easing: 'ease-out', fill: 'forwards' });
      /* 2. the mark turns into place like a key in a lock, whole: it swings
            round from a quarter-turn and more, a touch past, and settles —
            its three faces, a hair apart as it starts, closing up as it turns */
      const svg = c.querySelector<SVGSVGElement>('svg')!;
      const start = FADE * 0.5;
      const turn = svg.animate([
        { transform: 'rotate(-120deg) scale(0.85)', opacity: 0 },
        { transform: 'rotate(-60deg) scale(0.95)', opacity: 1, offset: 0.35 },
        { transform: 'rotate(6deg) scale(1)', offset: 0.8 },
        { transform: 'rotate(0deg) scale(1)', opacity: 1 },
      ], { duration: BUILD, delay: start, easing: 'cubic-bezier(0.3, 0, 0.2, 1)', fill: 'forwards' });
      const build = faces(c).map((f, i) => f.animate([
        { opacity: 1, transform: `translate(${FROM[i][0] * GAP}px, ${FROM[i][1] * GAP}px)` },
        { opacity: 1, transform: 'translate(0, 0)' },
      ], { duration: BUILD * 0.8, delay: start + BUILD * 0.15, easing: snap, fill: 'forwards' }));
      await Promise.all([fade.finished, turn.finished, ...build.map((b) => b.finished), load()]);
      covered = true;
    };
  });

  document.addEventListener('astro:page-load', async () => {
    const c = el();
    if (!c || !covered) return;
    covered = false;
    // the ground takes the new page's, under the mark, before it goes
    tone(c, true);
    await wait(HOLD);
    /* 3. unlocked: the mark turns on and fades, still whole — its faces
          opening a hair as it goes — as the new page comes up */
    const svg = c.querySelector<SVGSVGElement>('svg')!;
    svg.animate([{ transform: 'rotate(0deg) scale(1)', opacity: 1 }, { transform: 'rotate(60deg) scale(0.9)', opacity: 0 }],
      { duration: APART, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' });
    const apart = faces(c).map((f, i) => f.animate([
      { transform: 'translate(0, 0)' },
      { transform: `translate(${FROM[i][0] * GAP}px, ${FROM[i][1] * GAP}px)` },
    ], { duration: APART, easing: inOut, fill: 'forwards' }));
    const reveal = c.animate([{ opacity: 1 }, { opacity: 0 }],
      { duration: REVEAL, delay: APART * 0.4, easing: 'ease-in-out', fill: 'forwards' });
    await Promise.all([reveal.finished, ...apart.map((a) => a.finished)]);
    c.classList.remove('on');
    c.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  });
}
