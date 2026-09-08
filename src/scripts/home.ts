/* The homepage's client entry: builds the hero island and wires the page
   behaviours to it. Everything is found by data attributes, so the markup
   can move between components without touching this file. */
import { createSmoothScroll } from './ui/smoothScroll';
import { createScrollChoreography } from './ui/scrollChoreography';
import { createRotatingWord } from './ui/rotatingWord';
import { createStatsReel } from './ui/statsReel';
import { createWordmarkLetters } from './ui/wordmarkLetters';
import { createDirectionalHover } from './ui/directionalHover';
import { createVideoInView } from './ui/videoInView';
import { splitChars } from './ui/splitText';
import { createHoverAudio } from './ui/hoverAudio';
import { site } from '@lib/site';
import type { Hero } from './hero';

const host = document.querySelector<HTMLElement>('[data-hero-canvas]');
const fluidCanvas = document.querySelector<HTMLCanvasElement>('[data-fluid]');
let hero: Hero | null = null;

createSmoothScroll();
const choreography = createScrollChoreography(() => hero);
document.fonts.ready.then(() => splitChars());
const rot = document.querySelector<HTMLElement>('[data-rotating-word]');
if (rot) createRotatingWord(rot);
const reel = document.querySelector<HTMLElement>('[data-stats]');
if (reel) createStatsReel(reel);

// the letters of the name are shoved about by the cursor
const markHost = document.querySelector<HTMLElement>('[data-wordmark]');
if (markHost && markHost.dataset.outline !== 'off'
    && matchMedia('(hover: hover) and (pointer: fine)').matches
    && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  createWordmarkLetters(markHost);
}
createDirectionalHover();
createVideoInView();
createHoverAudio(site.audio.taps);

// no loading screen: the page arrives as soon as the fonts have settled
document.fonts.ready.then(() => document.body.classList.add('ready'));

/* The hero engine is by far the heaviest thing here, so it is not in this
   bundle: it is fetched once the page has painted and the browser is idle,
   and not at all for a reader who asked for less motion. Everything above
   works without it. */
if (host && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const load = () =>
    import('./hero')
      .then(({ createHero }) => {
        hero = createHero({ host, fluidCanvas });
        return document.fonts.ready.then(() => { hero?.setReady(); choreography.update(); });
      })
      .catch(() => {});
  if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 1500 });
  else setTimeout(load, 200);
}
