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

const FADE = 280, BUILD = 480, STAGGER = 60, HOLD = 40, APART = 380, REVEAL = 420;
const snap = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const inOut = 'cubic-bezier(0.65, 0, 0.35, 1)';
/** where each face comes from and goes to, in the mark's own units: the top
 *  one from above, the two lower ones from their own sides */
const FROM = [[0, -26], [-23, 14], [23, 14]];
/** how far each face is turned as it flies in, about its own middle */
const SPIN = [-120, 140, -140];

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
  const tone = (c: HTMLElement) => {
    const b = getComputedStyle(document.body);
    c.style.setProperty('--c-ground', b.backgroundColor);
    c.style.setProperty('--c-ink', b.color);
  };
  let covered = false;

  document.addEventListener('astro:before-preparation', (e) => {
    const ev = e as Event & { loader: () => Promise<void> };
    const load = ev.loader;
    ev.loader = async () => {
      const c = el();
      if (!c) return load();
      c.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      tone(c);
      c.classList.add('on');
      // 1. the page goes
      const fade = c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE, easing: 'ease-out', fill: 'forwards' });
      /* 2. the mark locks together, like a key turned: the whole of it
            swings round a quarter-turn and more as its faces fly in, each
            spinning into its place on its own; it overshoots a touch, and
            clicks — a small pulse — as it locks */
      const svg = c.querySelector<SVGSVGElement>('svg')!;
      const start = FADE * 0.5;
      const turn = svg.animate([
        { transform: 'rotate(-150deg) scale(0.7)' },
        { transform: 'rotate(8deg) scale(1)', offset: 0.78 },
        { transform: 'rotate(0deg) scale(1)' },
      ], { duration: BUILD + STAGGER * 2, delay: start, easing: 'cubic-bezier(0.3, 0, 0.2, 1)', fill: 'forwards' });
      const build = faces(c).map((f, i) => f.animate([
        { opacity: 0, transform: `translate(${FROM[i][0]}px, ${FROM[i][1]}px) rotate(${SPIN[i]}deg)` },
        { opacity: 1, transform: 'translate(0, 0) rotate(0deg)' },
      ], { duration: BUILD, delay: start + i * STAGGER, easing: snap, fill: 'forwards' }));
      const click = turn.finished.then(() => svg.animate([
        { transform: 'rotate(0deg) scale(1)' },
        { transform: 'rotate(0deg) scale(1.1)', offset: 0.35 },
        { transform: 'rotate(0deg) scale(1)' },
      ], { duration: 220, easing: 'ease-out', fill: 'forwards' }).finished);
      await Promise.all([fade.finished, ...build.map((b) => b.finished), click, load()]);
      covered = true;
    };
  });

  document.addEventListener('astro:page-load', async () => {
    const c = el();
    if (!c || !covered) return;
    covered = false;
    // the ground takes the new page's, under the mark, before it goes
    tone(c);
    await wait(HOLD);
    /* 3. unlocked: the mark turns on, and its faces spin off the way they
          came and fade, as the new page comes up */
    const svg = c.querySelector<SVGSVGElement>('svg')!;
    svg.animate([{ transform: 'rotate(0deg) scale(1)' }, { transform: 'rotate(70deg) scale(0.85)' }],
      { duration: APART + STAGGER, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' });
    const apart = faces(c).map((f, i) => f.animate([
      { opacity: 1, transform: 'translate(0, 0) rotate(0deg)' },
      { opacity: 0, transform: `translate(${FROM[i][0] * 0.8}px, ${FROM[i][1] * 0.8}px) rotate(${-SPIN[i] * 0.6}deg)` },
    ], { duration: APART, delay: i * STAGGER * 0.6, easing: inOut, fill: 'forwards' }));
    const reveal = c.animate([{ opacity: 1 }, { opacity: 0 }],
      { duration: REVEAL, delay: APART * 0.4, easing: 'ease-in-out', fill: 'forwards' });
    await Promise.all([reveal.finished, ...apart.map((a) => a.finished)]);
    c.classList.remove('on');
    c.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  });
}
