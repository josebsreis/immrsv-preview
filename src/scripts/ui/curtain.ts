/* The page change: the curtain comes up, the mark closes, the next page is
   loaded behind it, and the curtain lifts off the top.

   It wraps the router's own loader rather than racing it, so the new page
   is never swapped in until the screen is covered, and never shown until
   it has been swapped. Registered once, at module level; the curtain
   element persists, so it is found afresh each time rather than kept. */

const UP = 480, CLOSE = 380, OFF = 520, HOLD = 60;
const ease = 'cubic-bezier(0.76, 0, 0.24, 1)';

let wired = false;

export function createCurtain() {
  if (wired) return;
  wired = true;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  /* the router's own crossfade is not wanted under a curtain; the swap
     copies the new page's attributes onto <html>, so it is set again after */
  const mark = () => { document.documentElement.dataset.curtained = ''; };
  mark();
  document.addEventListener('astro:after-swap', mark);

  const el = () => document.querySelector<HTMLElement>('[data-curtain]');
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let covered = false;

  document.addEventListener('astro:before-preparation', (e) => {
    const ev = e as Event & { loader: () => Promise<void> };
    const load = ev.loader;
    ev.loader = async () => {
      const c = el();
      if (!c) return load();
      c.classList.add('on');
      c.classList.remove('closed');
      const up = c.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }],
        { duration: UP, easing: ease, fill: 'forwards' });
      // the faces close a beat after the panel sets off
      setTimeout(() => c.classList.add('closed'), UP * 0.35);
      await Promise.all([up.finished, load()]);
      await wait(Math.max(0, CLOSE - UP * 0.65));
      covered = true;
    };
  });

  document.addEventListener('astro:page-load', async () => {
    const c = el();
    if (!c || !covered) return;
    covered = false;
    await wait(HOLD);
    const off = c.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }],
      { duration: OFF, easing: ease, fill: 'forwards' });
    await off.finished;
    c.classList.remove('on', 'closed');
    c.getAnimations().forEach((a) => a.cancel());
  });
}
