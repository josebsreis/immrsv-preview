/* ═══════════════════════════════════════════════════════════════════
   The handover from the dark half of the page to the light one: a
   figure built the way the practice builds, while the ground changes
   under it.

   Everything is one rectangle opening from the middle. The mark grows
   into the light ground until the screen is white; the practice's
   argument lands on it as two lines; the two lines part, one up and one
   down, and she is built in the gap they make. The sentence does not
   leave — it stands above and below her for the whole passage, which is
   the point: the claim is held while the proof is made. Her four steps
   then pass at either side, in the room the lines are no longer using.

   The frames are a baked sequence drawn to a canvas from the scroll:
   no video element and no seeking, so the scrub is exact and costs the
   same on a phone as on a desk. They are fetched only once the section
   is near, and nothing is read or drawn while it is off screen.

   One value drives all of it: progress through the track, 0 to 1.
   ═══════════════════════════════════════════════════════════════════ */

export interface Forming { update(): void; destroy(): void }

/** how many frames were baked, and where they live */
const N = 121;
const SRC = (i: number) => `/forming/${String(i + 1).padStart(3, '0')}.avif`;
/** the air the two lines keep from her once they have parted */
const CLEAR = 26;
/** and the air between the lower line and the thread that leaves the pane */
const TAIL = 22;
/** when the thread draws — after she is finished, before the section ends */
const DRAW = [0.9, 0.99] as const;

/** where in the scroll each thing happens */
const T = {
  spread: [0.0, 0.16] as const,               // the mark grows into the light ground
  title: [0.1, 0.17] as const,                // the two lines land, and stay
  part: [0.22, 0.36] as const,                // they part, and she opens in the gap
  play: [0.3, 0.9] as const,                  // the frames run
  beat: 0.44,                                 // the first step begins its pass here…
  step: 0.095,                                // …and the rest this far apart
  life: 0.2,                                  // how long one takes to cross — longer
                                              // than the step, so two are always going
};
/* Which leaves the last twelfth of the track to her, finished, with the
   sentence still standing around her and nothing else moving. A section this
   long has to land rather than stop. */
/** how far a card travels up the screen, and how far it leans in at the middle */
const TRAVEL = 0.46, LEAN = 0.07;
/** the air a card keeps from her at its innermost */
const SHY = 24;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ramp = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);


export function createForming(root: HTMLElement): Forming {
  const track = root.querySelector<HTMLElement>('[data-forming-track]');
  const win = root.querySelector<HTMLElement>('[data-forming-ground]');
  const box = root.querySelector<HTMLElement>('[data-forming-slot]');
  const canvas = box?.querySelector<HTMLCanvasElement>('canvas');
  if (!track || !win || !box || !canvas) return { update() {}, destroy() {} };
  const halves = [...root.querySelectorAll<HTMLElement>('[data-forming-half]')];
  const thread = root.querySelector<HTMLElement>('[data-forming-thread]');
  const beats = [...root.querySelectorAll<HTMLElement>('[data-forming-beat]')];
  const ctx = canvas.getContext('2d');
  if (!ctx) return { update() {}, destroy() {} };

  /* A scroll-driven scene is the thing a reader who asked for less motion is
     asking to be spared, so for them the section is simply the line, on the
     light, at one screen tall — see the component's own styles. */
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return { update() {}, destroy() {} };
  root.dataset.live = '';

  /* ── frames ──────────────────────────────────────────────────────────
     Three megabytes of stills is not something to fetch while the reader
     is still in the hero, so nothing is asked for until the section is
     within a screen or so of arriving. Coarse first — every eighth frame,
     so a fast scrub always finds something near where it landed — then the
     rest in order. */
  const frames: (HTMLImageElement | null)[] = Array(N).fill(null);
  let shown = 0, warmed = false;
  const fetch = (i: number) => {
    if (frames[i]) return;
    const im = new Image();
    im.src = SRC(i);
    im.decode().then(() => { frames[i] = im; if (i === shown) draw(); }).catch(() => {});
  };
  const warm = () => {
    if (warmed) return;
    warmed = true;
    for (let i = 0; i < N; i += 8) fetch(i);
    for (let i = 0; i < N; i++) fetch(i);
  };

  /** the nearest frame that has arrived, when the exact one has not */
  const nearest = (i: number) => {
    if (frames[i]) return frames[i];
    for (let d = 1; d < N; d++) {
      if (frames[i - d]) return frames[i - d];
      if (frames[i + d]) return frames[i + d];
    }
    return null;
  };

  /* ── the boxes ───────────────────────────────────────────────────────
     The slot is placed in fractions of the screen and then pinned to whole
     pixels, because its edge and the light ground's edge have to be the
     same edge: half a pixel of disagreement is a grey hairline. */
  let w = 0, h = 0, sx = 0, sy = 0, sw = 0, sh = 0, leanMax = 0;
  /** where each of the two lines stands, joined and parted */
  const joined = [0, 0], apart = [0, 0];
  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const pr = win.getBoundingClientRect();
    w = pr.width; h = pr.height;
    box.style.width = box.style.height = box.style.left = box.style.top = '';
    box.style.translate = '';
    let br = box.getBoundingClientRect();
    box.style.width = `${Math.round(br.width)}px`;
    box.style.height = `${Math.round(br.height)}px`;
    box.style.left = `${Math.round(br.left - pr.left)}px`;
    box.style.top = `${Math.round(br.top - pr.top)}px`;
    box.style.translate = 'none';
    br = box.getBoundingClientRect();
    sx = br.left - pr.left; sy = br.top - pr.top; sw = br.width; sh = br.height;

    canvas.width = Math.round(sw * dpr); canvas.height = Math.round(sh * dpr);
    canvas.style.width = `${sw}px`; canvas.style.height = `${sh}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* Where each line sits when the two are still one sentence, and where it
       sits once they have parted — half a line either side of the middle, and
       then clear of her head and her foot. Both are measured: a line's height
       is the face's business, her height is the screen's, and she does not
       always stand at the middle of it — on a phone she is lifted to leave
       the foot of the screen to the card that is passing. */
    if (halves.length === 2) {
      const mid = sy + sh / 2 - h / 2;
      for (let i = 0; i < 2; i++) {
        const el = halves[i], sign = i ? 1 : -1;
        const lh = el.getBoundingClientRect().height;
        joined[i] = sign * lh * 0.55;
        apart[i] = mid + sign * (sh / 2 + CLEAR + lh / 2);
      }
    }

    /* The thread starts under the sentence and runs to the foot of the pane,
       so the studios section below continues the same line. */
    if (thread && halves[1]) {
      const lh = halves[1].getBoundingClientRect().height;
      const top = h / 2 + apart[1] + lh / 2 + TAIL;
      thread.style.top = `${top.toFixed(1)}px`;
      thread.style.height = `${Math.max(0, h - top).toFixed(1)}px`;
    }

    /* How far a card may lean in before it would touch her — measured, not
       assumed, because the slot's width answers to the screen's height and a
       short wide screen leaves far less room than a tall one. */
    const card = beats[0];
    if (card) {
      card.style.setProperty('--ax', '0px');
      const cr = card.getBoundingClientRect();
      leanMax = Math.max(0, sx - (cr.left - pr.left) - cr.width - SHY);
    }

    last = -1;
    draw();
  };
  const draw = () => {
    const im = nearest(shown);
    if (!im || sw < 1) return;
    // cover: the figure is centred in the frame, so a centred crop keeps her
    const s = Math.max(sw / im.naturalWidth, sh / im.naturalHeight);
    const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
    ctx.drawImage(im, (sw - dw) / 2, (sh - dh) / 2, dw, dh);
  };

  /* ── the scroll ──────────────────────────────────────────────────── */
  let last = -1;
  /** held at one moment by the dev hook below, and then not scroll-driven */
  let pinned = false;
  const update = () => {
    if (pinned) return;
    const r = track.getBoundingClientRect();
    if (r.height < 1) return;
    apply(clamp01(-r.top / Math.max(1, r.height - h)));
  };
  const apply = (p: number) => {
    if (p === last) return;
    last = p;

    // the ground: the mark's five pixels at the middle of the screen, opened
    // until its four edges have left it
    const g = inOut(ramp(p, T.spread[0], T.spread[1]));
    const k = 1 - g;
    const gx = (w - 5) / 2, gy = (h - 5) / 2;
    win.style.clipPath = g >= 1 ? 'none'
      : `inset(${(gy * k).toFixed(1)}px ${(gx * k).toFixed(1)}px ${(gy * k).toFixed(1)}px ${(gx * k).toFixed(1)}px)`;
    // the nav takes the ground it stands on, and this section changes its own
    const ground = g > 0.5 ? 'light' : 'dark';
    if (root.dataset.theme !== ground) root.dataset.theme = ground;

    // she opens in the gap the two lines make: a sliver at the middle, grown
    // to her full height. Nothing of her before her time
    const o = inOut(ramp(p, T.part[0], T.part[1]));
    box.style.clipPath = o <= 0 ? 'inset(50% 0)' : o >= 1 ? 'none'
      : `inset(${((sh / 2) * (1 - o)).toFixed(1)}px 0)`;

    // the two lines: they arrive together, part one up and one down, and stay
    const v = ramp(p, T.title[0], T.title[1]).toFixed(3);
    halves.forEach((el, i) => {
      el.style.setProperty('--v', v);
      el.style.setProperty('--dy', `${(joined[i] + (apart[i] - joined[i]) * o).toFixed(1)}px`);
    });

    // the frame
    const f = Math.round(ramp(p, T.play[0], T.play[1]) * (N - 1));
    if (f !== shown) { shown = f; draw(); }

    // and the thread she is left standing on, drawn once she is finished
    thread?.style.setProperty('--v', ramp(p, DRAW[0], DRAW[1]).toFixed(3));

    /* Her four steps, passing where the halves of the line stood: each rises
       through its own half circle — in towards her at the middle of the pass,
       out again as it goes — and they overlap, so one is always arriving
       while another leaves. */
    /* Narrow, they come one at a time and barely move: there is only one place
       for a card to be, and two of them in it is a pile. */
    const narrow = w <= 719;
    const span = narrow ? T.step * 0.95 : T.life;
    const rise = h * (narrow ? 0.06 : TRAVEL);
    const lean = narrow ? 0 : Math.min(w * LEAN, 96, leanMax);
    beats.forEach((b, i) => {
      const at = T.beat + i * T.step;
      const t = ramp(p, at, at + span);
      const v = Math.min(1, ramp(p, at, at + span * 0.2), 1 - ramp(p, at + span * 0.78, at + span));
      b.style.setProperty('--v', v.toFixed(3));
      b.style.setProperty('--ay', `${((0.5 - t) * rise).toFixed(1)}px`);
      b.style.setProperty('--ax', `${(Math.sin(t * Math.PI) * lean * (i % 2 ? -1 : 1)).toFixed(1)}px`);
    });
  };

  /* One read and one write a frame, and none at all while the section is
     away: the page is scrolled by a smooth scroller, which sends many more
     scroll events than there are frames to draw. */
  let raf = 0, live = false;
  const schedule = () => { if (!raf && live) raf = requestAnimationFrame(() => { raf = 0; update(); }); };
  const near = new IntersectionObserver(([e]) => { if (e.isIntersecting) { warm(); near.disconnect(); } },
                                        { rootMargin: '100% 0px' });
  const seen = new IntersectionObserver(([e]) => { live = e.isIntersecting; if (live) { size(); update(); } });
  near.observe(root); seen.observe(root);

  /* Dev only, and stripped from a build: `?f=0.4` pins the pane and holds the
     scene at that point, so a still of any moment can be taken without
     scrolling there. */
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search);
    if (q.has('f')) {
      const pane = box.parentElement!;
      pane.style.position = 'fixed'; pane.style.inset = '0'; pane.style.zIndex = '99';
      const at = clamp01(Number(q.get('f')));
      pinned = true;
      warm();
      const hold = () => { size(); last = -1; apply(at); };
      setTimeout(hold, 400); setTimeout(hold, 1500); setTimeout(hold, 3000);
    }
  }

  const onResize = () => { size(); update(); };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', onResize);
  size(); update();

  return {
    update() { last = -1; update(); },
    destroy() {
      near.disconnect(); seen.disconnect();
      cancelAnimationFrame(raf);
      removeEventListener('scroll', schedule);
      removeEventListener('resize', onResize);
    },
  };
}
