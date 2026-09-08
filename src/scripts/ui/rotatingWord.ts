/** The last word of the headline cycles: letters blur out in a random
 *  order, the next word blurs in the same way. Words come from the element's
 *  `data-words` (JSON array); the first is the resting word. */
export function createRotatingWord(el: HTMLElement, opts: { hold?: number; firstDelay?: number } = {}): { destroy(): void } {
  const words: string[] = JSON.parse(el.dataset.words ?? '[]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hold = opts.hold ?? 1900, firstDelay = opts.firstDelay ?? 2600;
  let idx = 0, busy = false, timer = 0;
  const timeouts = new Set<number>();
  const later = (fn: () => void, ms: number) => { const id = window.setTimeout(() => { timeouts.delete(id); fn(); }, ms); timeouts.add(id); };

  const set = (word: string, hidden: boolean) => {
    el.textContent = '';
    for (const ch of word) { const i = document.createElement('i'); i.textContent = ch; if (hidden) i.className = 'out'; el.appendChild(i); }
  };
  const next = () => {
    if (busy || words.length < 2) return; busy = true;
    Array.from(el.children).forEach((l) => later(() => l.classList.add('out'), Math.random() * 320));
    later(() => {
      idx = (idx + 1) % words.length;
      set(words[idx], true);
      void el.offsetWidth;                                             // paint the hidden state before releasing
      Array.from(el.children).forEach((l) => later(() => l.classList.remove('out'), 40 + Math.random() * 340));
      later(() => { busy = false; arm(); }, 1100);
    }, 900);
  };
  const arm = () => { clearTimeout(timer); if (!reduced) timer = window.setTimeout(next, hold); };

  set(words[0] ?? el.textContent ?? '', false);
  timer = window.setTimeout(arm, firstDelay);
  return { destroy() { clearTimeout(timer); timeouts.forEach(clearTimeout); } };
}
