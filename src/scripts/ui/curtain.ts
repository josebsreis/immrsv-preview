/* The page change, in three beats:
     1. the page fades away under the nav (which persists and stays put), and
        the mark in the nav turns, like a key, as the next page loads;
     2. the next page's name comes up in the middle, letter by letter out of
        a blur — the site's own way of bringing a word in;
     3. the new page is swapped in behind; the name blurs away, the mark
        finishes its turn, and the new page comes up through the ground.

   It wraps the router's own loader rather than racing it, so the swap only
   ever happens behind a covered screen. The layer takes the ground and ink
   of the section in the middle of the screen, and a change of ground is the
   new page dissolving up through the old one, slowly, once the name has
   gone. Registered once; the layer persists, so it is found afresh. */
import { groundAt, holdNav } from '../lifecycle';

const FADE = 280, LETTERS = 520, SPREAD = 260, READ = 260, OUT = 380, REVEAL = 420, REVEAL_TURN = 820;
/** the nav's mark: the first three shapes of the wordmark, turned together
 *  about their own middle (in the wordmark's units) */
const MARK_CENTRE = '102px 116px';

let wired = false;

export function createCurtain() {
  if (wired) return;
  wired = true;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* the router's own crossfade is not wanted under the curtain; the swap
     copies the new page's attributes onto <html>, so it is set again after */
  const flag = () => { document.documentElement.dataset.curtained = ''; };
  flag();
  document.addEventListener('astro:after-swap', flag);

  const el = () => document.querySelector<HTMLElement>('[data-curtain]');
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const markPaths = () => [...document.querySelectorAll<SVGPathElement>('nav .home svg path, .home svg path')].slice(0, 3);

  /* the ground and ink of the section in the middle of the screen, set
     outright: blended, it came up from the last colour it was used on */
  const tone = (c: HTMLElement) => {
    const { ground, ink } = groundAt();
    c.style.setProperty('--c-ground', ground);
    c.style.setProperty('--c-ink', ink);
  };

  /** what a page is called: its own title, less the site's name; the home
   *  page's title is the tagline, so it is simply Home */
  const nameOf = (doc: Document | undefined, to: URL) => {
    const path = to.pathname.replace(/^\/immrsv-preview[^/]*/, '').replace(/\/$/, '') || '/';
    if (path === '/') return 'Home';
    const t = (doc?.title ?? '').split('|').map((x) => x.trim()).filter((x) => x && x !== 'IMMRSV');
    return t[0] || path.split('/').pop()!.replace(/-/g, ' ');
  };

  const spell = (c: HTMLElement, text: string) => {
    const p = c.querySelector<HTMLElement>('[data-curtain-name]')!;
    p.textContent = '';
    for (const w of text.split(/(\s+)/)) {
      if (!w) continue;
      if (/^\s+$/.test(w)) { p.append(' '); continue; }
      const span = document.createElement('span');
      span.className = 'w';
      for (const ch of w) {
        const i = document.createElement('i');
        i.className = 'ch out';
        i.textContent = ch;
        span.append(i);
      }
      p.append(span);
    }
    return [...p.querySelectorAll<HTMLElement>('.ch')];
  };

  let covered = false, turn: Animation[] = [];

  document.addEventListener('astro:before-preparation', (e) => {
    const ev = e as Event & { loader: () => Promise<void>; newDocument?: Document; to: URL };
    const load = ev.loader;
    ev.loader = async () => {
      const c = el();
      if (!c) return load();
      c.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      tone(c);
      spell(c, '');
      // the nav keeps the ground it has until the new page comes up — and is
      // let go regardless if the page never does
      holdNav(true);
      setTimeout(() => holdNav(false), 6000);
      c.classList.add('on');
      // 1. the page goes, and the nav's mark turns the first half of its turn
      const fade = c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE, easing: 'ease-out', fill: 'forwards' });
      turn.forEach((a) => a.cancel());
      turn = markPaths().map((p) => {
        p.style.transformBox = 'view-box';
        p.style.transformOrigin = MARK_CENTRE;
        return p.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(180deg)' }],
          { duration: FADE + LETTERS, easing: 'cubic-bezier(0.5, 0, 0.3, 1)', fill: 'forwards' });
      });
      await Promise.all([fade.finished, load()]);
      // 2. the new page's name, out of a blur, a letter at a time
      const letters = spell(c, nameOf(ev.newDocument, ev.to));
      void c.offsetWidth;
      // in from the left, a letter after the one before it
      const step = SPREAD / Math.max(1, letters.length - 1);
      letters.forEach((ch, i) => setTimeout(() => ch.classList.remove('out'), i * step));
      await wait(LETTERS + READ);
      covered = true;
    };
  });

  document.addEventListener('astro:page-load', async () => {
    const c = el();
    if (!c || !covered) return;
    covered = false;
    /* The ground is not changed under the name: a change of colour is the
       new page coming up through the old one, after the name has gone. */
    const from = getComputedStyle(c).backgroundColor;
    const probe = document.createElement('i');
    probe.style.color = groundAt().ground;
    document.body.append(probe);
    const to = getComputedStyle(probe).color;
    probe.remove();
    const changes = from.replace(/\s/g, '') !== to.replace(/\s/g, '');
    // 3. the name goes back into its blur, the mark finishes its turn, and
    //    the page comes up
    // and back out from the right, the way it came
    const gone = [...c.querySelectorAll<HTMLElement>('.ch')];
    const back = (SPREAD * 0.6) / Math.max(1, gone.length - 1);
    gone.forEach((ch, i) => setTimeout(() => ch.classList.add('out'), (gone.length - 1 - i) * back));
    const finish = markPaths().map((p) => {
      p.style.transformBox = 'view-box';
      p.style.transformOrigin = MARK_CENTRE;
      return p.animate([{ transform: 'rotate(180deg)' }, { transform: 'rotate(360deg)' }],
        { duration: OUT + REVEAL, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' });
    });
    turn.forEach((a) => a.cancel());
    turn = [];
    /* the nav turns with the page: as the new page is a third of the way
       up through the ground, with its own colour transition carrying it */
    const upAt = OUT + SPREAD * 0.6 + 60;
    setTimeout(() => holdNav(false), upAt + (changes ? REVEAL_TURN : REVEAL) * 0.3);
    const reveal = c.animate([{ opacity: 1 }, { opacity: 0 }],
      // only once the name has blurred right away
      changes
        ? { duration: REVEAL_TURN, delay: OUT + SPREAD * 0.6 + 60, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'forwards' }
        : { duration: REVEAL, delay: OUT + SPREAD * 0.6 + 60, easing: 'ease-in-out', fill: 'forwards' });
    await Promise.all([reveal.finished, ...finish.map((a) => a.finished)]);
    c.classList.remove('on');
    c.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    spell(c, '');
    holdNav(false);
  });
}
