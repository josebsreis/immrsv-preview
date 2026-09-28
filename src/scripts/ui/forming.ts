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

/** where in the scroll each thing happens */
const T = {
  team: [-0.085, -0.045] as const,              // your team: four dots, 'YOUR TEAM,' — while
                                              // the section is still rising over the logos
  join: [-0.045, 0.0] as const,                // they part and ours falls into the gap,
                                              // gathering speed, 'EXTENDED.'
  impact: [0.0, 0.035] as const,              // it lands with weight: a squash, and the
                                              // knock runs out through the others
  lit: [0.03, 0.085] as const,                // the light passes from ours out through
                                              // the team, the nearest first
  merge: [0.085, 0.125] as const,             // the five draw together into one
  spread: [0.13, 0.3] as const,               // and that one opens into the light, she
                                              // standing in it, pushing the lines off
  play: [0.31, 1.0] as const,                   // the frames run, once the light is open
  beat: 0.34,                                  // the first step begins its pass here…
  last: 0.87,                                 // …and the last is gone by here, the rest
                                              // spread evenly between, however many
  life: 0.17,                                 // how long one takes to cross — longer
                                              // than the gap, so two are always going
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
  const squares = [...root.querySelectorAll<HTMLElement>('[data-forming-team] i')];
  const note = root.querySelector<HTMLElement>('.note');
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
  let w = 0, h = 0, sx = 0, sy = 0, sw = 0, sh = 0, leanMax = 0, sq = 40;
  /** where each of the two lines stands, joined and parted */
  const joined = [0, 0], apart = [0, 0], heights = [0, 0];
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
    if (squares[2]) {
      squares[2].style.transform = 'none';
      sq = squares[2].getBoundingClientRect().width || sq;
      squares[2].style.transform = '';
    }
    if (halves.length === 2) {
      const mid = sy + sh / 2 - h / 2;
      for (let i = 0; i < 2; i++) {
        const el = halves[i], sign = i ? 1 : -1;
        const lh = el.getBoundingClientRect().height;
        heights[i] = lh;
        // over the row and under it, clear of the squares
        joined[i] = sign * (sq / 2 + lh / 2 + 22);
        apart[i] = mid + sign * (sh / 2 + CLEAR + lh / 2);
      }
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

    /* the sheet that rides over her is see-through above the studios' tab,
       so she goes under the tab rather than under a wall: its ground starts
       where the tab ends */
    const head = document.querySelector<HTMLElement>('.studios .head');
    head?.closest<HTMLElement>('[data-next]')?.style.setProperty('--lip', `${head.offsetHeight}px`);

    last = -1;
    draw();
  };
  const draw = () => {
    const im = nearest(shown);
    if (!im || sw < 1) return;
    ctx.clearRect(0, 0, sw, sh);
    // cover: the figure is centred in the frame, so a centred crop keeps her
    const s = Math.max(sw / im.naturalWidth, sh / im.naturalHeight);
    const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
    ctx.drawImage(im, (sw - dw) / 2, (sh - dh) / 2, dw, dh);
  };

  /* ── the scroll ──────────────────────────────────────────────────── */
  let last = -1;
  let riseFrom = 1;
  /** held at one moment by the dev hook below, and then not scroll-driven */
  let pinned = false;
  const update = () => {
    if (pinned) return;
    const r = track.getBoundingClientRect();
    if (r.height < 1) return;
    /* below 0 while the section is still coming up the screen: the row is
       already telling its story then, so there is no empty dark between */
    /* where the studios' sheet starts up over the last screen: from here
       she sinks back under it */
    riseFrom = Math.max(0, (r.height - 2 * h) / Math.max(1, r.height - h));
    apply(Math.max(-0.25, Math.min(1, -r.top / Math.max(1, r.height - h))));
  };
  const apply = (p: number) => {
    if (p === last) return;
    last = p;

    /* The row: four of yours come in, one after another; then they step
       apart from the middle and ours grows into the gap.
       (Dots; `sq` is a dot's width.) */
    const slot = sq * 1.5;
    const t = ramp(p, T.team[0], T.team[1]), j = inOut(ramp(p, T.join[0], T.join[1]));
    const home = [-1.5, -0.5, 0, 0.5, 1.5], parted = [-2, -1, 0, 1, 2];
    /* the others hold together until ours is almost down, and are pushed
       apart by it as it goes in — not a gap waiting for it */
    const dFall = ramp(p, T.join[0], T.join[1]);
    const make = 1 - Math.pow(1 - ramp(dFall, 0.72, 1), 3);
    /* the knock of the landing: out and back, a little past, and still */
    const knock = (u: number) => (u <= 0 || u >= 1 ? 0 : Math.sin(u * Math.PI * 1.6) * Math.exp(-u * 3.2));
    const im = ramp(p, T.impact[0], T.impact[1]);
    /* the five drawing together, and the grey-to-light of each */
    const mg = inOut(ramp(p, T.merge[0], T.merge[1]));
    const DARK = [44, 44, 48], LIGHT = [245, 245, 247];
    const tone = (k: number) => `rgb(${DARK.map((c, n) => Math.round(c + (LIGHT[n] - c) * k)).join(' ')})`;
    squares.forEach((el, i) => {
      if (i === 2) {
        /* ours comes down from the top of the screen, gathering speed, into
           the gap the others open for it — and lands with weight */
        const d = ramp(p, T.join[0], T.join[1]);
        const fall = d * d;
        const dotY = -(1 - fall) * (h / 2 + sq);
        const sqz = knock(im) * 0.9;
        el.style.setProperty('--o', d > 0 ? '1' : '0');
        el.style.setProperty('--s', '1');
        el.style.setProperty('--y', `${(dotY + sqz * sq * 0.12).toFixed(1)}px`);
        el.style.transform = `translate(var(--x, 0px), var(--y, 0px)) scale(${(1 + sqz * 0.22).toFixed(3)}, ${(1 - sqz * 0.22).toFixed(3)})`;
        return;
      }
      const n = i < 2 ? i : i - 1;
      const a = clamp01(t * 4 - n * 0.9);
      /* nearest first: the two beside ours, then the two at the ends */
      const ring = Math.abs(i - 2);
      const push = knock(clamp01((im - (ring - 1) * 0.18) / 0.82)) * sq * 0.35 * Math.sign(i - 2);
      const lit = inOut(ramp(p, T.lit[0] + (ring - 1) * 0.022, T.lit[1] - (2 - ring) * 0.022));
      const x = (home[i] + (parted[i] - home[i]) * make) * slot * (1 - mg) + push;
      el.style.setProperty('--o', inOut(a).toFixed(3));
      el.style.setProperty('--x', `${x.toFixed(1)}px`);
      el.style.setProperty('--y', `${((1 - inOut(a)) * sq * 0.6).toFixed(1)}px`);
      el.style.background = tone(lit);
    });

    // the ground: our dot, opened until it has covered the screen
    const g = inOut(ramp(p, T.spread[0], T.spread[1]));
    // the merged five hide under the light as it opens
    squares.forEach((el) => { if (g > 0) el.style.setProperty('--o', '0'); });
    root.style.setProperty('--g', g.toFixed(3));
    win.style.visibility = g > 0 ? '' : 'hidden';
    note?.style.setProperty('--nv', inOut(ramp(p, T.team[0] - 0.04, T.team[0] + 0.03)).toFixed(3));
    // a circle, our dot, widening until it has covered the far corners
    const R = sq / 2 + (Math.hypot(w, h) / 2 + 2 - sq / 2) * g;
    win.style.clipPath = g >= 1 ? 'none' : `circle(${R.toFixed(1)}px at 50% 50%)`;
    // the nav takes the ground it stands on, and this section changes its
    // own — only once the light has filled the screen, not while the nav
    // is still over the dark
    const ground = g >= 1 ? 'light' : 'dark';
    if (root.dataset.theme !== ground) root.dataset.theme = ground;

    /* She is seen only inside the light: the same circle, cut out of her
       slot, so it opens from our dot with her already standing in it. */
    box.style.clipPath = g >= 1 ? 'none'
      : `circle(${R.toFixed(1)}px at ${(w / 2 - sx).toFixed(1)}px ${(h / 2 - sy).toFixed(1)}px)`;
    /* as the studios' sheet rides over her she sinks back a little under
       it — down and a touch smaller — still turning until she is covered */
    /* …and she comes up the same way as the light opens: from a little
       lower and a touch smaller, into her place — the leaving, backwards */
    const sink = inOut(ramp(p, riseFrom, 1));
    const arrive = 1 - inOut(ramp(g, 0.05, 0.75));
    const off = Math.max(sink, arrive);
    box.style.transformOrigin = '50% 100%';
    box.style.transform = off > 0 ? `translateY(${(off * h * 0.06).toFixed(1)}px) scale(${(1 - off * 0.05).toFixed(4)})` : '';
    // she comes up in the light as it opens, not as a dark patch in a square
    box.style.opacity = inOut(ramp(g, 0.06, 0.3)).toFixed(3);

    /* The two lines are there from the start, one sentence on the dark, and
       part as the light opens — pushed up and down by it and off the screen. */
    /* Each rides just outside the light's edge, so it is never over her,
       and is carried off the top and the foot of the screen with it: once
       the light is open she stands alone. */
    const edge = R;
    halves.forEach((el, i) => {
      const lh = heights[i];
      const m = Math.max(Math.abs(joined[i]), edge + lh * 0.6 + CLEAR * 0.6);
      // 'YOUR TEAM,' with the four; 'EXTENDED.' as ours joins
      el.style.setProperty('--v', (i === 0 ? inOut(ramp(p, T.team[0], T.team[0] + 0.05)) : j).toFixed(3));
      el.style.setProperty('--dy', `${(Math.sign(apart[i]) * m).toFixed(1)}px`);
    });

    // the frame
    const f = Math.round(ramp(p, T.play[0], T.play[1]) * (N - 1));
    if (f !== shown) { shown = f; draw(); }

    /* Her four steps, passing where the halves of the line stood: each rises
       through its own half circle — in towards her at the middle of the pass,
       out again as it goes — and they overlap, so one is always arriving
       while another leaves. */
    /* Narrow, there is no beside her for a card to pass through, so it
       passes over her: from under the foot of the screen to over its head,
       nearly the whole height, at the same overlap as on a desktop — which
       at that travel keeps two cards most of half a screen apart, never a
       pile. */
    const narrow = w <= 719;
    /* On a desktop they go by in pairs, one each side at once — the first
       two together, then the next two — so there are half as many passes
       and each is given longer. Narrow, one after another, as ever. */
    const pairs = !narrow;
    const passes = pairs ? Math.ceil(beats.length / 2) : beats.length;
    const span = pairs ? T.life * 1.55 : T.life;
    const rise = h * (narrow ? 0.92 : TRAVEL);
    const lean = narrow ? 0 : Math.min(w * LEAN, 96, leanMax);
    beats.forEach((b, i) => {
      const step = passes > 1 ? (T.last - T.beat - span) / (passes - 1) : 0;
      const at = T.beat + (pairs ? Math.floor(i / 2) : i) * step;
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
      const at = Math.max(-0.25, Math.min(1, Number(q.get("f"))));
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
