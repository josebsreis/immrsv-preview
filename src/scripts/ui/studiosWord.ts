/* ═══════════════════════════════════════════════════════════════════
   The word STUDIOS, the width of the page, coming apart in layers as it
   is scrolled.

   The word is one SVG text, sized once so that it spans exactly the
   page's width between the margins. It is drawn N times, one copy over
   another, each on an opaque rectangle of the ground the size of the
   word — so at rest the N are one word. As the section is scrolled the
   copy at the back stays where it is and every copy in front of it
   shrinks and drops, the front one most: each copy's ground hides all
   of the copies behind it except what stands proud of it — the tops of
   the letters above, the first letter's left edge, the last letter's
   right — so the word reads as a stack of slices fanning up and out
   from the front, the way a deck pushed with a thumb does.

   Scroll drives it, not time: the section is taller than the screen and
   the word holds still while it goes by, so the fan runs with the
   reader's own hand and reverses when they scroll back. When the section
   has been scrolled through, the fan is complete, and the first studio
   rides up over it.

   Without script, or for a reader who asked for less motion, it is the
   word, whole.
   ═══════════════════════════════════════════════════════════════════ */

export interface StudiosWord { destroy(): void }

/** how many copies the word is drawn in */
const LAYERS = 8;
/** how much smaller each copy is than the one behind it, when the fan
 *  is complete */
const STEP = 0.04;
/** how far each copy drops below the one behind it, as a share of the
 *  word's height, when the fan is complete */
const DROP = 0.13;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function createStudiosWord(root: HTMLElement): StudiosWord {
  const svg = root.querySelector<SVGSVGElement>('svg[data-word]');
  const base = svg?.querySelector<SVGTextElement>('text');
  const track = root.querySelector<HTMLElement>('[data-word-track]');
  if (!svg || !base || !track) return { destroy() {} };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return { destroy() {} };
  root.dataset.live = '';

  const ns = 'http://www.w3.org/2000/svg';
  /** the copies, front first */
  let layers: SVGGElement[] = [];
  let box = { x: 0, y: 0, width: 1, height: 1 };
  let built = false;
  let frame = 0;
  let last = -1;

  /* lay the word out to the page's width, then draw it N times over its
     own ground; the original is kept only as the measure */
  const build = () => {
    for (const g of layers) g.remove();
    layers = [];

    const width = svg.clientWidth || 1;
    base.setAttribute('font-size', '100');
    const len = base.getComputedTextLength() || 1;
    const size = (100 * width) / len;
    base.setAttribute('font-size', size.toFixed(2));
    /* The ground under each copy has to be the letters' own box, not the
       font's: the em box carries empty room above the capitals, and a
       ground that tall on the copy in front covered the tops of the copy
       behind — which are the very slices this is for. The letters are
       measured on a canvas, which reports the ink's own ascent and
       descent, and the text is set on its baseline that far down. */
    const cs = getComputedStyle(base);
    const ctx = document.createElement('canvas').getContext('2d');
    let asc = size * 0.72, desc = 0;
    if (ctx) {
      ctx.font = `${cs.fontWeight} ${size}px ${cs.fontFamily}`;
      try { (ctx as CanvasRenderingContext2D & { fontStretch: string }).fontStretch = cs.fontStretch; } catch { /* older browsers */ }
      const m = ctx.measureText(base.textContent ?? '');
      if (m.actualBoundingBoxAscent) { asc = m.actualBoundingBoxAscent; desc = m.actualBoundingBoxDescent; }
    }
    base.setAttribute('dominant-baseline', 'alphabetic');
    base.setAttribute('y', asc.toFixed(2));
    const b = base.getBBox();
    box = { x: b.x, y: 0, width: b.width, height: asc + desc };
    /* the drawing is the word's own box, edge to edge: the copies that
       stand proud of it are allowed to overflow into the page's margins */
    svg.setAttribute('viewBox', `${box.x.toFixed(1)} 0 ${box.width.toFixed(1)} ${box.height.toFixed(1)}`);
    svg.style.height = `${(box.height / box.width) * width}px`;

    /* back to front in the document, so the front is drawn last */
    for (let k = LAYERS - 1; k >= 0; k--) {
      const g = document.createElementNS(ns, 'g');
      const r = document.createElementNS(ns, 'rect');
      r.setAttribute('x', box.x.toFixed(1));
      r.setAttribute('y', '0');
      r.setAttribute('width', box.width.toFixed(1));
      r.setAttribute('height', box.height.toFixed(1));
      r.setAttribute('class', 'ground');
      const t = base.cloneNode(true) as SVGTextElement;
      t.removeAttribute('data-measure');
      g.append(r, t);
      svg.append(g);
      layers[k] = g;
    }
    base.setAttribute('opacity', '0');
    built = true;
    last = -1;
  };

  /* each copy shrinks about the word's centre and drops, by how far in
     front of the back copy it stands */
  const paint = (p: number) => {
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    for (let k = 0; k < LAYERS; k++) {
      const depth = LAYERS - 1 - k;                         // 0 at the back
      const s = 1 - depth * STEP * p;
      const ty = depth * DROP * box.height * p;
      layers[k].setAttribute('transform',
        `translate(${cx.toFixed(1)} ${(cy + ty).toFixed(2)}) scale(${s.toFixed(4)}) translate(${(-cx).toFixed(1)} ${(-cy).toFixed(1)})`);
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
    /* the fan eases in: little at first, then all of it */
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
