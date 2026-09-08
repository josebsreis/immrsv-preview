/* The homepage's client entry: builds the hero island and wires the page
   behaviours to it. Everything is found by data attributes, so the markup
   can move between components without touching this file. */
import { createHero } from './hero';
import { createSmoothScroll } from './ui/smoothScroll';
import { createScrollChoreography } from './ui/scrollChoreography';
import { createRotatingWord } from './ui/rotatingWord';
import { createStatsReel } from './ui/statsReel';
import { createWordmarkLetters } from './ui/wordmarkLetters';
import { createDirectionalHover } from './ui/directionalHover';
import { splitChars } from './ui/splitText';
import { createHoverAudio } from './ui/hoverAudio';
import { runLoader } from './ui/loader';
import { site } from '@lib/site';

const host = document.querySelector<HTMLElement>('[data-hero-canvas]');
const fluidCanvas = document.querySelector<HTMLCanvasElement>('[data-fluid]');
const hero = host ? createHero({ host, fluidCanvas }) : null;

createSmoothScroll();
createScrollChoreography(hero);
document.fonts.ready.then(() => splitChars());
const rot = document.querySelector<HTMLElement>('[data-rotating-word]');
if (rot) createRotatingWord(rot);
const reel = document.querySelector<HTMLElement>('[data-stats]');
if (reel) createStatsReel(reel);

// the letters of the name are shoved about by the cursor
const markHost = document.querySelector<HTMLElement>('[data-wordmark]');
if (markHost && matchMedia('(hover: hover) and (pointer: fine)').matches
    && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  createWordmarkLetters(markHost);
}
createDirectionalHover();
createHoverAudio(site.audio.taps);

runLoader(document.querySelector<HTMLElement>('[data-loader]'), () => hero?.setReady());
