/* ═══════════════════════════════════════════════════════════════════
   A figure forms while the page turns from dark to light.

   The frames are a baked sequence, drawn to a canvas from the scroll:
   no video element, no seeking, every frame is a still and the scrub
   is exact. The window they are seen through starts as the site's own
   mark — a five-pixel square — and opens to the whole screen; the
   ground inside it is the video's, which is near-white, so the square
   opening is the light half of the page arriving.

   One value drives everything: progress through the track, 0 to 1.
   ═══════════════════════════════════════════════════════════════════ */

export interface Forming { update(): void; set(p: number): void; destroy(): void }

const N = 121;
const SRC = (i: number) => `/forming/${String(i + 1).padStart(3, '0')}.avif`;

/** where in the scroll each thing happens */
const T = {
  open: [0.0, 0.24] as const,     // the square grows to the screen
  play: [0.06, 0.94] as const,    // the frames run
  beat: 0.3,                      // the first line lands here…
  step: 0.17,                     // …and the rest this far apart
  hold: 0.1,                      // how long a line stays
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ramp = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function startForming(root: HTMLElement, onProgress?: (p: number) => void): Forming {
  const track = root.querySelector<HTMLElement>('[data-track]')!;
  const win = root.querySelector<HTMLElement>('[data-window]')!;
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  /** the frame the figure is drawn in — the whole window, or a box inside it */
  const box = (canvas.closest<HTMLElement>('[data-box]') ?? win);
  const beats = [...root.querySelectorAll<HTMLElement>('[data-beat]')];
  const ctx = canvas.getContext('2d')!;

  /* ── frames ──────────────────────────────────────────────────────── */
  const frames: (HTMLImageElement | null)[] = Array(N).fill(null);
  let shown = 0;
  const fetch = (i: number) => {
    if (frames[i]) return;
    const im = new Image();
    im.src = SRC(i);
    im.decode().then(() => { frames[i] = im; if (i === shown) draw(); }).catch(() => {});
  };
  // coarse first — every eighth frame, so a fast scrub finds something near
  // wherever it lands — then the rest in order
  for (let i = 0; i < N; i += 8) fetch(i);
  for (let i = 0; i < N; i++) fetch(i);

  /** the nearest frame that has arrived, when the exact one has not */
  const nearest = (i: number) => {
    if (frames[i]) return frames[i];
    for (let d = 1; d < N; d++) {
      if (frames[i - d]) return frames[i - d];
      if (frames[i + d]) return frames[i + d];
    }
    return null;
  };

  /* ── canvas ──────────────────────────────────────────────────────── */
  let w = 0, h = 0, bw = 0, bh = 0;
  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    // the pane's own box, not the window's: the two disagree under a browser
    // chrome that comes and goes, and the clip is drawn in the pane's frame
    w = win.clientWidth; h = win.clientHeight;
    bw = box.clientWidth; bh = box.clientHeight;
    canvas.width = Math.round(bw * dpr); canvas.height = Math.round(bh * dpr);
    canvas.style.width = `${bw}px`; canvas.style.height = `${bh}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    last = -1;
    draw();
  };
  const draw = () => {
    const im = nearest(shown);
    if (!im) return;
    // cover: the figure is centred in the frame, so a centred crop keeps her
    const s = Math.max(bw / im.naturalWidth, bh / im.naturalHeight);
    const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
    ctx.drawImage(im, (bw - dw) / 2, (bh - dh) / 2, dw, dh);
  };

  /* ── the scroll ──────────────────────────────────────────────────── */
  let last = -1, raf = 0, live = true;
  const update = () => {
    const r = track.getBoundingClientRect();
    const range = Math.max(1, r.height - h);
    apply(clamp01(-r.top / range));
  };
  const apply = (p: number) => {
    if (p === last) return;
    last = p;

    // the window: a square of the mark's size growing until it covers the
    // screen, eased so it leaves slowly and arrives slowly
    const o = inOut(ramp(p, T.open[0], T.open[1]));
    const side = 5 + (Math.max(w, h) - 5) * o;
    const top = (h - side) / 2, left = (w - side) / 2;
    win.style.clipPath = o >= 1 ? 'none' : `inset(${top.toFixed(1)}px ${left.toFixed(1)}px)`;

    // the frame
    const f = Math.round(ramp(p, T.play[0], T.play[1]) * (N - 1));
    if (f !== shown) { shown = f; draw(); }

    // the lines: each rises in, holds, and leaves, in its own slot
    beats.forEach((b, i) => {
      const at = T.beat + i * T.step;
      const v = ramp(p, at - 0.05, at) * (1 - ramp(p, at + T.hold, at + T.hold + 0.05));
      b.style.setProperty('--v', v.toFixed(3));
    });

    onProgress?.(p);
  };
  const loop = () => { update(); if (live) raf = requestAnimationFrame(loop); };

  size();
  addEventListener('resize', size);
  raf = requestAnimationFrame(loop);

  return {
    update() { last = -1; update(); },
    set(p) { live = false; cancelAnimationFrame(raf); last = -1; apply(clamp01(p)); },
    destroy() {
      live = false; cancelAnimationFrame(raf);
      removeEventListener('resize', size);
    },
  };
}
