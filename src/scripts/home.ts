/* The homepage's client entry: builds the hero island and wires the page
   behaviours to it. Everything is found by data attributes, so the markup
   can move between components without touching this file. */
import { createSmoothScroll } from './ui/smoothScroll';
import { createScrollChoreography } from './ui/scrollChoreography';
import { createRotatingWord } from './ui/rotatingWord';
import { createStatsReel } from './ui/statsReel';
import { createDirectionalHover } from './ui/directionalHover';
import { createMarquee } from './ui/marquee';
import { createStudioReel } from './ui/studioReel';
import { createStudioStack } from './ui/studioStack';
import { createWorkPile } from './ui/workPile';
import { createProcessRail } from './ui/processRail';
import { createForming } from './ui/forming';
import { createFormingMarks } from './ui/formingMarks';
import { createFaqs } from './ui/faqs';
import { createVideoInView } from './ui/videoInView';
import { splitChars } from './ui/splitText';
import { createCursor } from './ui/cursor';
import { createBlurIn } from './ui/blurIn';
import { createStudiosRoll } from './ui/studiosRoll';
import { createBrandSwap } from './ui/brandSwap';
import { onPage } from './lifecycle';
import type { Hero } from './hero';

/* The homepage is wired inside onPage: with the client router in, this
   module runs once for the whole visit, but the page it wires up is rebuilt
   every time it is returned to. Everything made here is handed back to be
   taken down again on the way out — the hero above all, which holds a WebGL
   context that will not be collected on its own. */
onPage('home', () => {
  const host = document.querySelector<HTMLElement>('[data-hero-canvas]');
  let hero: Hero | null = null;
  let gone = false;                       // the page left before the engine landed

  const made: { destroy(): void }[] = [];
  const add = <T extends { destroy(): void } | null | undefined>(thing: T) => {
    if (thing) made.push(thing);
    return thing;
  };

  add(createSmoothScroll());
  const choreography = add(createScrollChoreography(() => hero))!;
  // the section names come in letter by letter, before anything can be seen split
  add(createBlurIn());
  document.fonts.ready.then(() => splitChars());
  const rot = document.querySelector<HTMLElement>('[data-rotating-word]');
  if (rot) add(createRotatingWord(rot));
  /* two of them now — the statement's figures and the testimonials — and the
     same driver turns both */
  document.querySelectorAll<HTMLElement>('[data-stats]').forEach((el) => add(createStatsReel(el)));

  const forming = document.querySelector<HTMLElement>('[data-forming]');
  if (forming) { add(createForming(forming)); add(createFormingMarks(forming)); }
  const brands = document.querySelector<HTMLElement>('[data-brands]');
  if (brands) add(createBrandSwap(brands));
  const roll = document.querySelector<HTMLElement>('[data-studios-roll]');
  if (roll) add(createStudiosRoll(roll));
  const faqs = document.querySelector<HTMLElement>('[data-faqs]');
  if (faqs) add(createFaqs(faqs));
  const process = document.querySelector<HTMLElement>('[data-process]');
  if (process) add(createProcessRail(process));
  add(createDirectionalHover());
  document.querySelectorAll<HTMLElement>('[data-marquee]').forEach((el) => add(createMarquee(el)));
  document.querySelectorAll<HTMLElement>('[data-studio-reel]').forEach((el) => add(createStudioReel(el)));
  const stack = document.querySelector<HTMLElement>('[data-studio-stack]');
  if (stack) add(createStudioStack(stack));
  const pile = document.querySelector<HTMLElement>('[data-pile]');
  if (pile) add(createWorkPile(pile));
  add(createVideoInView());
  add(createCursor());

  /* No loading screen: the page arrives as soon as the fonts have settled —
     and no later than this, whatever the fonts are doing. The font is
     preloaded and swaps in, so nothing is lost by going first; a page that
     stood blank waiting on a slow connection was painting nothing that a
     first-paint measure could see. */
  const ready = () => document.body.classList.add('ready');
  document.fonts.ready.then(ready);
  setTimeout(ready, 600);

  /* The hero engine is by far the heaviest thing here, so it is not in this
     bundle: it is fetched once the page has painted and the browser is idle,
     and not at all for a reader who asked for less motion. Everything above
     works without it. */
  if (host && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const load = () =>
      import('./hero')
        .then(({ createHero }) => {
          if (gone) return;               // it arrived after the reader left
          hero = createHero({ host });
          return document.fonts.ready.then(() => { hero?.setReady(); choreography.update(); });
        })
        .catch(() => {});
    if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 1500 });
    else setTimeout(load, 200);
  }

  return [
    ...made,
    { destroy() { gone = true; hero?.destroy(); hero = null; } },
  ];
});
