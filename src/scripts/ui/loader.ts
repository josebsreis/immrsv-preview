/** The loader waits for everything real (scripts, images, fonts) plus a
 *  minimum hold so it never flashes, then closes and calls back — the page
 *  starts its intro at that instant. */
export function runLoader(el: HTMLElement | null, onDone: () => void, minMs = 1400): void {
  if (!el) { onDone(); return; }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t0 = performance.now();
  const finish = () => { el.classList.add('done'); document.body.classList.add('ready'); onDone(); };
  const reveal = () => {
    if (reduced) { el.style.transition = 'opacity .3s ease'; el.style.opacity = '0'; setTimeout(finish, 320); return; }
    el.classList.add('closing');
    const ms = parseFloat(getComputedStyle(el).getPropertyValue('--loader-close-ms')) || 960;
    setTimeout(finish, ms);
  };
  Promise.all([
    new Promise<void>((r) => (document.readyState === 'complete' ? r() : addEventListener('load', () => r(), { once: true }))),
    document.fonts.ready,
  ]).then(() => setTimeout(reveal, Math.max(0, minMs - (performance.now() - t0))));
}
