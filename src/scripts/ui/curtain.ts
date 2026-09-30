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

const FADE = 320, BUILD = 460, STAGGER = 70, HOLD = 90, APART = 420, REVEAL = 460;
const snap = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const inOut = 'cubic-bezier(0.65, 0, 0.35, 1)';
/** where each face comes from and goes to, in the mark's own units: the top
 *  one from above, the two lower ones from their own sides */
const FROM = [[0, -26], [-23, 14], [23, 14]];

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
      // 2. the mark comes together, a face at a time, as the page goes
      const build = faces(c).map((f, i) => f.animate([
        { opacity: 0, transform: `translate(${FROM[i][0]}px, ${FROM[i][1]}px)` },
        { opacity: 1, transform: 'translate(0, 0)' },
      ], { duration: BUILD, delay: FADE * 0.55 + i * STAGGER, easing: snap, fill: 'forwards' }));
      await Promise.all([fade.finished, ...build.map((b) => b.finished), load()]);
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
    // 3. the mark comes apart — each face on out the way it came — and the
    //    new page comes up as it does
    const apart = faces(c).map((f, i) => f.animate([
      { opacity: 1, transform: 'translate(0, 0)' },
      { opacity: 0, transform: `translate(${FROM[i][0] * 0.6}px, ${FROM[i][1] * 0.6}px)` },
    ], { duration: APART, delay: i * STAGGER * 0.6, easing: inOut, fill: 'forwards' }));
    const reveal = c.animate([{ opacity: 1 }, { opacity: 0 }],
      { duration: REVEAL, delay: APART * 0.4, easing: 'ease-in-out', fill: 'forwards' });
    await Promise.all([reveal.finished, ...apart.map((a) => a.finished)]);
    c.classList.remove('on');
    c.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  });
}
