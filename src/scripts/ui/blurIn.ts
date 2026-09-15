/* ═══════════════════════════════════════════════════════════════════
   A heading that comes in as the headline's last word does: its letters
   are out of focus and gone until the heading is scrolled to, then each
   sharpens and appears on its own, in no order, over a short spread — so
   the name of a section arrives the way the name of the site did, and
   quickly, rather than fading in as one slab.

   Only what is marked `data-blur-in` gets this. Everything else that
   arrives on scroll keeps its plain fade: a page where every line does
   this is a page doing a trick.

   Each word is kept whole in its own span so the split never changes
   where the heading wraps. A reader who asked for less motion gets the
   heading as set, untouched.
   ═══════════════════════════════════════════════════════════════════ */

export interface BlurIn { destroy(): void }

/** the longest any one letter waits before coming in, ms */
const SPREAD = 300;

export function createBlurIn(root: ParentNode = document): BlurIn {
  const heads = Array.from(root.querySelectorAll<HTMLElement>('[data-blur-in]'));
  if (heads.length === 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) return { destroy() {} };

  const timeouts = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timeouts.delete(id); fn(); }, ms);
    timeouts.add(id);
  };

  /* one span a word, one <i> a letter, all out — set once, before the
     heading can be seen, so nothing is on screen and then split */
  for (const h of heads) {
    if (h.dataset.blurInDone) continue;
    const text = h.textContent ?? '';
    h.textContent = '';
    const words = text.split(/(\s+)/);
    for (const w of words) {
      if (!w) continue;
      if (/^\s+$/.test(w)) { h.append(' '); continue; }
      const span = document.createElement('span');
      span.className = 'w';
      for (const ch of w) {
        const i = document.createElement('i');
        i.className = 'ch out';
        i.textContent = ch;
        span.append(i);
      }
      h.append(span);
    }
    h.dataset.blurInDone = '1';
  }

  /* as each heading crosses into the lower part of the screen — the same
     line the fades use — its letters come in, and it is not watched again */
  const seen = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      seen.unobserve(e.target);
      e.target.querySelectorAll<HTMLElement>('.ch').forEach((ch) => {
        later(() => ch.classList.remove('out'), Math.random() * SPREAD);
      });
    }
  }, { rootMargin: '0px 0px -14% 0px' });
  heads.forEach((h) => seen.observe(h));

  return {
    destroy() {
      seen.disconnect();
      timeouts.forEach(clearTimeout);
    },
  };
}
