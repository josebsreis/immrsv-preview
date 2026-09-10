/* ═══════════════════════════════════════════════════════════════════
   A figure forms while the page turns from dark to light.

   The frames are a baked sequence, drawn to a canvas from the scroll:
   no video element, no seeking, every frame is a still and the scrub
   is exact. She is held in a slot — a portrait, 2:3, the way a
   character stands on a select screen — and the page arrives around
   her in two openings, both rectangles, both from the middle out:
   first the mark grows into the light ground until it is the whole
   screen, then, on that ground, a slot opens and she forms in it.
   Nothing fades; things open.

   One value drives everything: progress through the track, 0 to 1.
   ═══════════════════════════════════════════════════════════════════ */

export interface Forming { update(): void; set(p: number): void; destroy(): void }

const N = 121;
const SRC = (i: number) => `/forming/${String(i + 1).padStart(3, '0')}.avif`;

/** where in the scroll each thing happens */
const T = {
  spread: [0.0, 0.2] as const,                // the mark grows into the light ground
  title: [0.12, 0.18, 0.3, 0.36] as const,    // the line: in, held, out
  slot: [0.24, 0.34] as const,                // the slot opens, on the light
  play: [0.3, 0.96] as const,                 // the frames run
  beat: 0.42,                                 // the first line lands here…
  step: 0.14,                                 // …and the rest this far apart
  hold: 0.07,                                 // how long a line stays
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ramp = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** in over [a,b], held, out over [c,d] */
const life = (p: number, [a, b, c, d]: readonly [number, number, number, number]) =>
  ramp(p, a, b) * (1 - ramp(p, c, d));

export function startForming(root: HTMLElement, onProgress?: (p: number) => void): Forming {
  const track = root.querySelector<HTMLElement>('[data-track]')!;
  const win = root.querySelector<HTMLElement>('[data-window]')!;
  const box = root.querySelector<HTMLElement>('[data-box]')!;
  const canvas = box.querySelector<HTMLCanvasElement>('canvas')!;
  const title = root.querySelector<HTMLElement>('[data-title]');
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

  /* ── the boxes ───────────────────────────────────────────────────── */
  /** the pane, and the slot's place in it — read once, the slot does not move */
  let w = 0, h = 0, sx = 0, sy = 0, sw = 0, sh = 0;
  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const pr = win.getBoundingClientRect();
    w = pr.width; h = pr.height;
    // the slot is placed by fractions of the screen; it is pinned to whole
    // pixels here so its edge and the light plane's edge are the same edge
    let br = box.getBoundingClientRect();
    box.style.width = `${Math.round(br.width)}px`; box.style.height = `${Math.round(br.height)}px`;
    box.style.left = `${Math.round(br.left - pr.left)}px`; box.style.top = `${Math.round(br.top - pr.top)}px`;
    box.style.translate = 'none';
    br = box.getBoundingClientRect();
    sx = br.left - pr.left; sy = br.top - pr.top; sw = br.width; sh = br.height;
    canvas.width = Math.round(sw * dpr); canvas.height = Math.round(sh * dpr);
    canvas.style.width = `${sw}px`; canvas.style.height = `${sh}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    last = -1;
    draw();
  };
  const draw = () => {
    const im = nearest(shown);
    if (!im) return;
    // cover: the figure is centred in the frame, so a centred crop keeps her
    const s = Math.max(sw / im.naturalWidth, sh / im.naturalHeight);
    const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
    ctx.drawImage(im, (sw - dw) / 2, (sh - dh) / 2, dw, dh);
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

    // the slot: from the mark's five pixels to its own size, both ways at
    // once, so it is a growing rectangle and not a square that then stretches
    const o = inOut(ramp(p, T.slot[0], T.slot[1]));
    const cw = 5 + (sw - 5) * o, ch = 5 + (sh - 5) * o;
    // nothing of it before its time: the mark it opens from is the light
    // ground's, not a second dot on the dark
    box.style.clipPath = o <= 0 ? 'inset(50%)' : o >= 1 ? 'none' : `inset(${((sh - ch) / 2).toFixed(1)}px ${((sw - cw) / 2).toFixed(1)}px)`;

    // the ground: the light plane starts as the mark's five pixels at the
    // middle of the screen and grows until its four edges have left it
    const g = inOut(ramp(p, T.spread[0], T.spread[1]));
    const k = 1 - g;
    const ox = (w - 5) / 2, oy = (h - 5) / 2;
    win.style.clipPath = g >= 1 ? 'none'
      : `inset(${(oy * k).toFixed(1)}px ${((w - ox - 5) * k).toFixed(1)}px ${((h - oy - 5) * k).toFixed(1)}px ${(ox * k).toFixed(1)}px)`;

    // the frame
    const f = Math.round(ramp(p, T.play[0], T.play[1]) * (N - 1));
    if (f !== shown) { shown = f; draw(); }

    // the line that names the section, and the four that follow. Each
    // carries how present it is (--v) and where it is in its life (--t),
    // so a line can pass through rather than only appear and go
    title?.style.setProperty('--v', life(p, T.title).toFixed(3));
    beats.forEach((b, i) => {
      const at = T.beat + i * T.step;
      b.style.setProperty('--v', life(p, [at - 0.04, at, at + T.hold, at + T.hold + 0.04]).toFixed(3));
      b.style.setProperty('--t', ramp(p, at - 0.04, at + T.hold + 0.04).toFixed(3));
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
