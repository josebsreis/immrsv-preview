/** The last word of the headline cycles: letters blur out in a random
 *  order, the next word blurs in the same way. Words come from the element's
 *  `data-words` (JSON array); the first is the resting word.
 *
 *  It rotates on its own timer until something takes it over. The hero does:
 *  once the mark is making forms, the sentence names the one standing, so the
 *  headline and the cloud say the same thing at the same moment. */
export interface RotatingWord {
  /** say this word next — the caller is driving now, so the timer stands down */
  show(word: string | null): void;
  /** stop rotating on a timer and wait to be told */
  drive(): void;
  destroy(): void;
}

export function createRotatingWord(el: HTMLElement, opts: { hold?: number; firstDelay?: number } = {}): RotatingWord {
  const words: string[] = JSON.parse(el.dataset.words ?? '[]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hold = opts.hold ?? 1900, firstDelay = opts.firstDelay ?? 2600;
  let idx = 0, busy = false, driven = false, queued: string | null = null, timer = 0;
  const timeouts = new Set<number>();
  const later = (fn: () => void, ms: number) => { const id = window.setTimeout(() => { timeouts.delete(id); fn(); }, ms); timeouts.add(id); };

  const set = (word: string, hidden: boolean) => {
    el.textContent = '';
    for (const ch of word) { const i = document.createElement('i'); i.textContent = ch; if (hidden) i.className = 'out'; el.appendChild(i); }
  };
  /** blur this word out, blur the next one in */
  const goto = (word: string) => {
    if (word === words[idx] && !busy) return;
    if (busy) { queued = word; return; }
    busy = true;
    Array.from(el.children).forEach((l) => later(() => l.classList.add('out'), Math.random() * 320));
    later(() => {
      idx = Math.max(0, words.indexOf(word));
      set(word, true);
      void el.offsetWidth;                                             // paint the hidden state before releasing
      Array.from(el.children).forEach((l) => later(() => l.classList.remove('out'), 40 + Math.random() * 340));
      later(() => {
        busy = false;
        if (queued !== null) { const q = queued; queued = null; goto(q); }
        else if (!driven) arm();
      }, 1100);
    }, 900);
  };
  const next = () => { if (words.length > 1) goto(words[(idx + 1) % words.length]); };
  const arm = () => { clearTimeout(timer); if (!reduced && !driven) timer = window.setTimeout(next, hold); };

  set(words[0] ?? el.textContent ?? '', false);
  timer = window.setTimeout(arm, firstDelay);
  return {
    show(word) { driven = true; clearTimeout(timer); goto(word ?? words[0] ?? ''); },
    drive() { driven = true; clearTimeout(timer); },
    destroy() { clearTimeout(timer); timeouts.forEach(clearTimeout); },
  };
}
