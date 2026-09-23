/* ═══════════════════════════════════════════════════════════════════
   The word STUDIOS, the width of the page, cut into bands as it is
   scrolled.

   The word is one SVG text, sized once so that it spans exactly the
   page's width. Over it stand K copies, each clipped to one horizontal
   band of the word's box, and as the section is scrolled each band's
   letters slide sideways — the bands nearest the middle barely, the top
   and foot ones furthest, and neighbouring letters in opposite
   directions — so the word shears apart into slices, the way a thing
   cut and pushed does, rather than fading or moving as one.

   Scroll drives it, not time: the section is taller than the screen and
   the word holds still while it goes by, so the slicing runs with the
   reader's own hand and reverses when they scroll back. When the section
   has been scrolled through, the word is fully cut, and the first studio
   rides up over it.

   Without script, or for a reader who asked for less motion, it is the
   word, whole.
   ═══════════════════════════════════════════════════════════════════ */

export interface StudiosWord { destroy(): void }

/** how many bands the word is cut into */
const BANDS = 9;
/** how far a letter in the outermost band travels, as a share of the
 *  word's height, when the cut is complete */
const THROW = 0.55;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function createStudiosWord(root: HTMLElement): StudiosWord {
  const svg = root.querySelector<SVGSVGElement>('svg[data-word]');
  const base = svg?.querySelector<SVGTextElement>('text');
  const track = root.querySelector<HTMLElement>('[data-word-track]');
  if (!svg || !base || !track) return { destroy() {} };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return { destroy() {} };
  root.dataset.live = '';

  const word = base.textContent ?? '';
  const n = word.length;
  const ns = 'http://www.w3.org/2000/svg';
  let copies: SVGTextElement[] = [];
  let boxH = 1;
  let built = false;
  let frame = 0;
  let last = -1;

  /* lay the word out to the page's width, then cut it: one clipped copy a
     band, the original kept only as the measure */
  const build = () => {
    for (const c of copies) c.remove();
    svg.querySelectorAll('clipPath').forEach((c) => c.remove());
    copies = [];

    const width = svg.clientWidth || 1;
    base.setAttribute('font-size', '100');
    base.removeAttribute('dx');
    const len = base.getComputedTextLength() || 1;
    const size = (100 * width) / len;
    base.setAttribute('font-size', size.toFixed(2));
    const box = base.getBBox();
    boxH = box.height;
    /* the box is the word, and the drawing is the box plus room at either
       side for the slices to travel into */
    const pad = box.height * THROW;
    svg.setAttribute('viewBox', `${(box.x - pad).toFixed(1)} ${box.y.toFixed(1)} ${(box.width + pad * 2).toFixed(1)} ${box.height.toFixed(1)}`);
    svg.style.height = `${(box.height / (box.width + pad * 2)) * svg.clientWidth}px`;

    const defs = document.createElementNS(ns, 'defs');
    for (let k = 0; k < BANDS; k++) {
      const clip = document.createElementNS(ns, 'clipPath');
      const id = `sw-${k}`;
      clip.setAttribute('id', id);
      const r = document.createElementNS(ns, 'rect');
      /* each band overlaps the next by a hair, so no seam shows while
         two bands stand together */
      r.setAttribute('x', (box.x - pad * 2).toFixed(1));
      r.setAttribute('y', (box.y + (box.height * k) / BANDS - 0.3).toFixed(2));
      r.setAttribute('width', (box.width + pad * 4).toFixed(1));
      r.setAttribute('height', (box.height / BANDS + 0.6).toFixed(2));
      clip.append(r);
      defs.append(clip);

      const t = base.cloneNode(true) as SVGTextElement;
      t.removeAttribute('data-measure');
      t.setAttribute('clip-path', `url(#${id})`);
      svg.append(t);
      copies.push(t);
    }
    svg.prepend(defs);
    base.setAttribute('opacity', '0');
    built = true;
    last = -1;
  };

  /* the offset of each letter in each band, written as per-glyph dx —
     which SVG reads as a step from the previous glyph, so each is the
     difference from the one before */
  const paint = (p: number) => {
    const mid = (BANDS - 1) / 2;
    for (let k = 0; k < BANDS; k++) {
      const reach = ((k - mid) / mid) * THROW * boxH * p;
      const dx: string[] = [];
      let prev = 0;
      for (let i = 0; i < n; i++) {
        /* neighbours go opposite ways; the middle letters a little less */
        const dir = i % 2 ? -1 : 1;
        const off = reach * dir;
        dx.push((off - prev).toFixed(2));
        prev = off;
      }
      copies[k].setAttribute('dx', dx.join(' '));
    }
  };

  const update = () => {
    frame = 0;
    if (!built) return;
    const r = track.getBoundingClientRect();
    const run = Math.max(1, r.height - innerHeight);
    const p = clamp01(-r.top / run);
    const q = Math.round(p * 200) / 200;
    if (q === last) return;
    last = q;
    /* the cut eases in: little at first, then all of it */
    paint(q * q * (3 - 2 * q));
  };
  const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
  const onResize = () => { build(); update(); };

  document.fonts.ready.then(() => { build(); update(); });
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onResize);

  return {
    destroy() {
      delete root.dataset.live;
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onResize);
      if (frame) cancelAnimationFrame(frame);
    },
  };
}
