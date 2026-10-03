/* ═══════════════════════════════════════════════════════════════════
   The selected work, as a pile of cards fanned out on the table.

   One card lies square in the middle with the rest tipped away to either
   side of it, and a card is changed by throwing it: drag the pile sideways
   and every card travels part of the way to where it would be one step
   over, let go past a tenth of the width and they finish the move with a
   little overshoot, let go short of it and they fall back. It loops — the
   card thrown off the top goes round to the far side of the pile.

   The layout and the feel are Osmo's flick cards (osmo.supply), rebuilt
   without GSAP: the table of poses starts from theirs (see poseFor), and
   the ease is theirs, written out below. Nothing else on this site runs on a library, and one section
   is not worth one.

   Two things it must not do. It never takes the page's scroll: only a
   drag that sets off sideways is the pile's, and the list is `pan-y`, so a
   thumb moving up the page moves the page. And a drag is never a click —
   the cards are links, and a link that opens when you meant to throw it
   is the whole interaction broken.
   ═══════════════════════════════════════════════════════════════════ */

export interface WorkPile { destroy(): void }

export interface Pose {
  /** across and down, in percent of the card's own size */
  x: number; y: number;
  rot: number; s: number; o: number;
  z: number;
}

/** how far a card sits from the one on show, the short way round the loop */
export function offset(i: number, at: number, n: number): number {
  let d = i - at;
  if (d > n / 2) d -= n;
  else if (d < -n / 2) d += n;
  return d;
}

/** Where a card lies for its distance from the middle. Osmo's table, with
 *  the cards behind made smaller and set lower: at their size and tilt the
 *  raised corner of each one stood above the top edge of the card in the
 *  middle, a sliver of another picture over the one on show. Smaller, they
 *  sit wholly behind it at the top, and they are spread further out so as
 *  much of each still shows at the sides. */
export function poseFor(d: number): Pose {
  switch (d) {
    case 0: return { x: 0, y: 0, rot: 0, s: 1, o: 1, z: 5 };
    case 1: return { x: 32, y: 4, rot: 10, s: 0.78, o: 1, z: 4 };
    case -1: return { x: -32, y: 4, rot: -10, s: 0.78, o: 1, z: 4 };
    case 2: return { x: 58, y: 8, rot: 15, s: 0.64, o: 1, z: 3 };
    case -2: return { x: -58, y: 8, rot: -15, s: 0.64, o: 1, z: 3 };
    default: {
      const dir = d > 0 ? 1 : -1;
      return { x: 70 * dir, y: 8, rot: 20 * dir, s: 0.5, o: 0, z: 2 };
    }
  }
}

/** what the stylesheet is told about a card: how bright it is and whether
 *  its frame is out */
export function statusFor(d: number): 'active' | 'near' | 'far' | 'gone' {
  const a = Math.abs(d);
  return a === 0 ? 'active' : a === 1 ? 'near' : a === 2 ? 'far' : 'gone';
}

export const transformOf = (p: Pose) =>
  `translate(${p.x.toFixed(3)}%, ${p.y.toFixed(3)}%) rotate(${p.rot.toFixed(3)}deg) scale(${p.s.toFixed(4)})`;

/** a pile smaller than this has a card that is both one to the left and one
 *  to the right of the middle, and a throw has nowhere sensible to send it;
 *  it is still laid out, but it cannot be thrown */
const MIN = 7;
/** a tenth of the width, and the throw goes through */
const THRESHOLD = 0.1;
const MS = 600;

/* GSAP's elastic.out(1.2, 1): one overshoot past the mark and back, which is
   the card landing rather than bouncing */
const AMP = 1.2, PERIOD = 1;
const PHASE = (PERIOD / (Math.PI * 2)) * Math.asin(1 / AMP);
const elastic = (t: number) =>
  t <= 0 ? 0 : t >= 1 ? 1 : AMP * 2 ** (-10 * t) * Math.sin((t - PHASE) * ((Math.PI * 2) / PERIOD)) + 1;

/* The stacking order travels with the move rather than being switched at
   its end: the card coming forward passes the one going back half-way
   through, where the two are the same size and their overlap is smallest.
   Switched on release, the one still drawn large jumped behind the one
   still drawn small — a flash where they overlapped. */
const mix = (a: Pose, b: Pose, k: number): Pose => ({
  x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k,
  rot: a.rot + (b.rot - a.rot) * k, s: a.s + (b.s - a.s) * k,
  o: a.o + (b.o - a.o) * k, z: Math.round(a.z + (b.z - a.z) * k),
});

export function createWorkPile(root: HTMLElement): WorkPile {
  const list = root.querySelector<HTMLElement>('[data-pile-list]');
  const cards = [...root.querySelectorAll<HTMLElement>('[data-pile-card]')];
  const n = cards.length;
  if (!list || n === 0) return { destroy() {} };
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let at = 0;
  /* The dial behind the pile stands still, as Osmo's does. It turned —
     two rings of some three hundred ticks, against each other, the whole
     time the section was on screen — and a rotating drawing is drawn
     again from scratch every frame: nothing a Mac's GPU notices, but in
     Firefox, Safari and on a Windows laptop it was most of what made the
     pile heavy. */

  /* Stacked, the dial is fitted to the section rather than to the screen.
     Sized by the screen it bore no relation to the room it had: on a phone
     the card sits nearer the section's foot than its head, so both rings
     showed above the card and one below. Here the foot is let out until the
     card's middle is the section's middle, and the dial is drawn so its
     outer ring runs just off the section's head and foot — cut by the edge
     at the middle and curving back into view towards the sides — with the
     inner ring whole inside it, above and below alike. A desktop keeps the
     large dial that runs off the sides. */
  const dial = root.querySelector<SVGElement>('.dial');
  const stacked = matchMedia('(max-width: 859px)');
  /** the middle of the outer ring's ticks, in the drawing's units (its box
   *  is 2000), and how far past the section's edge that lands */
  const OUTER = 546, FIT = 1.04;
  const fitDial = () => {
    if (!dial) return;
    root.style.paddingBottom = '';
    dial.style.width = dial.style.height = '';
    if (!stacked.matches) return;
    const box = root.getBoundingClientRect();
    const d = dial.getBoundingClientRect();
    const cy = d.top + d.height / 2;
    const above = cy - box.top, below = box.bottom - cy;
    if (below < above) {
      const pad = parseFloat(getComputedStyle(root).paddingBottom) || 0;
      root.style.paddingBottom = `${Math.round(pad + above - below)}px`;
    }
    const half = Math.max(above, below);
    const size = Math.round(((half * FIT) / OUTER) * 2000);
    dial.style.width = dial.style.height = `${size}px`;
  };
  fitDial();
  document.fonts?.ready.then(fitDial);
  addEventListener('resize', fitDial);
  /* The covers are fetched and decoded while the section is still a couple
     of screens away. Lazy and decoded on demand, a card coming back from the
     hidden edge could show its dark ground for a frame before its picture. */
  const warmIo = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    warmIo.disconnect();
    root.querySelectorAll<HTMLImageElement>('.media img').forEach((im) => {
      im.loading = 'eager';
      im.decode?.().catch(() => {});
    });
  }, { rootMargin: '200% 0px' });
  warmIo.observe(root);

  let now: Pose[] = cards.map((_, i) => poseFor(offset(i, 0, n)));
  let from: Pose[] = now, to: Pose[] = now;
  let start = 0, raf = 0;

  /* What a card shows is read off where it is drawn, every frame — its
     frame, its name and how dim its picture is — not switched by a class
     and left to a CSS transition of its own. Two clocks drove one handover:
     the stacking swapped some thirty milliseconds into a throw while the
     frame of the card going back was still closing on its own half second,
     so the card coming in cut most of a white frame away in one frame —
     the flash. Read off the pose, the frame going back is gone before the
     swap and the one coming in opens only once its card is in front, under
     the hand as well as in a throw. */
  const parts = cards.map((c) => ({
    plate: c.querySelector<HTMLElement>('.plate'),
    bar: c.querySelector<HTMLElement>('.bar'),
    dim: c.querySelector<HTMLElement>('.dim'),
  }));
  /** what was last written, so a frame where nothing changed writes nothing */
  const wrote = cards.map(() => new Map<string, string>());
  const put = (i: number, el: HTMLElement | null, prop: string, v: string) => {
    if (!el) return;
    const key = prop + (el === cards[i] ? '' : el.className);
    if (wrote[i].get(key) === v) return;
    wrote[i].set(key, v);
    el.style.setProperty(prop, v);
  };
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  /** The frame is open within a fifth of a step of the middle and gone by
   *  three-eighths — before the stacking swaps, at a half — and only on a
   *  card drawn near its full size: a card two over crosses the middle on
   *  its way, small and behind, and must not open as it passes. */
  const frameAt = (p: Pose) => Math.min(clamp01((12 - Math.abs(p.x)) / 6), clamp01((p.s - 0.86) / 0.08));
  const paint = (i: number) => {
    const card = cards[i], p = now[i], f = frameAt(p);
    put(i, card, 'transform', transformOf(p));
    put(i, card, 'opacity', p.o.toFixed(3));
    put(i, card, 'z-index', String(p.z));
    const { plate, bar, dim } = parts[i];
    put(i, plate, 'opacity', f.toFixed(3));
    put(i, plate, 'transform', `scale(${(0.96 + 0.04 * f).toFixed(4)})`);
    // the name and the studio a beat behind the frame
    put(i, bar, 'opacity', Math.min(f, clamp01((9 - Math.abs(p.x)) / 4)).toFixed(3));
    // by how far the card has shrunk: a quarter darker one step out, half by two
    put(i, dim, 'opacity', Math.min(0.5, ((1 - p.s) / 0.22) * 0.25).toFixed(3));
  };

  /* In a throw the stacking follows what is drawn: the larger card in front.
     Taken from the move's progress instead, a throw two cards over tied
     three of them for a few frames and let the order of the list decide —
     the wrong picture on top, then a jump. The card that was in front when
     the throw began keeps the front until it is passed, so a short throw
     settling back, or one let go after the hand had already swapped them,
     cannot flip twice. */
  let keep = -1;
  const rankZ = () => {
    const order = now.map((_, i) => i).sort((a, b) =>
      Number(b === keep) - Number(a === keep) || now[b].s - now[a].s
      || Math.abs(now[a].x) - Math.abs(now[b].x) || a - b);
    order.forEach((i, r) => { now[i] = { ...now[i], z: Math.max(2, 5 - r) }; });
  };

  function tick(t: number) {
    raf = 0;
    // a throw's first frame can be stamped a moment before the throw itself;
    // read as a negative time, the ease ran backwards for that frame
    const k = Math.max(0, Math.min(1, (t - start) / MS));
    const e = elastic(k);
    now = cards.map((_, i) => mix(from[i], to[i], e));
    // the kept card holds the front only until the card coming in is larger
    if (keep >= 0 && keep !== at && now[at].s > now[keep].s) keep = -1;
    rankZ();
    cards.forEach((_, i) => paint(i));
    if (k < 1) raf = requestAnimationFrame(tick);
  }

  /** lay the pile out around card `index`, from wherever the cards are now */
  function settle(index: number) {
    const target = ((index % n) + n) % n;
    // whichever card is in front as the move begins
    keep = now.reduce((b, p, i) => (p.z >= now[b].z ? i : b), 0);
    at = target;
    cards.forEach((card, i) => {
      const d = offset(i, at, n);
      // the status no longer draws anything moving: it says which card can
      // be pressed and reached, at once
      card.dataset.pileStatus = statusFor(d);
      // only the card on show can be reached from the keyboard: the others
      // are brought to the middle first
      card.querySelectorAll<HTMLElement>('a').forEach((a) => a.setAttribute('tabindex', d === 0 ? '0' : '-1'));
      card.setAttribute('aria-hidden', String(d !== 0));
    });
    from = now.map((p) => ({ ...p }));
    to = cards.map((_, i) => poseFor(offset(i, at, n)));
    cancelAnimationFrame(raf); raf = 0;
    // a hidden page is painted no frames, and a move it never sees finish
    // would leave the pile halfway; there is nothing to watch, so it lands
    if (still || document.visibilityState !== 'visible') {
      now = to;
      cards.forEach((_, i) => paint(i));
      return;
    }
    start = performance.now();
    raf = requestAnimationFrame(tick);
  }

  /* ── the throw ─────────────────────────────────────────────────────── */
  let down = false, axis: 'x' | 'y' | null = null;
  let x0 = 0, y0 = 0, dx = 0, width = 1, dragged = false;

  /* Under the hand the cards are not put where the pointer says: they are
     given somewhere to be and close on it a share of the way each frame.
     Two flickers came from setting them outright. A pile grabbed again while
     it was still landing from the last throw jumped from mid-flight to its
     rest poses in one frame; followed, it is simply caught where it is. And
     a pointer never holds still, so every tremor of the hand was a tremor of
     the pile; followed, it is smoothed out.
     The closing is by time, not a share a frame: a share a frame trailed
     twice as far behind the hand on a 60Hz screen as on a 120Hz one, and
     further with every frame dropped — the pile felt heaviest exactly where
     the machine was slowest. Once the cards have caught up the loop rests
     until the hand moves again. */
  const TAU = 0.023;              // s: what 0.3 a frame was at 120Hz
  let aim: Pose[] | null = null, followRaf = 0, followLast = 0;
  const follow = (t: number) => {
    followRaf = 0;
    if (!aim) return;
    const dt = followLast ? Math.min(0.05, (t - followLast) / 1000) : 1 / 60;
    followLast = t;
    const F = still ? 1 : 1 - Math.exp(-dt / TAU);
    const a = aim;
    let gap = 0;
    now = now.map((p, i) => {
      gap = Math.max(gap, Math.abs(a[i].x - p.x), Math.abs(a[i].rot - p.rot), Math.abs(a[i].s - p.s) * 100);
      return {
        x: p.x + (a[i].x - p.x) * F, y: p.y + (a[i].y - p.y) * F,
        rot: p.rot + (a[i].rot - p.rot) * F, s: p.s + (a[i].s - p.s) * F,
        o: p.o + (a[i].o - p.o) * F,
        // the order is not eased: a stacking order is whole numbers, and one
        // half-way between two of them is just noise
        z: a[i].z,
      };
    });
    cards.forEach((_, i) => paint(i));
    if (gap > 0.01) followRaf = requestAnimationFrame(follow);
    else followLast = 0;
  };
  /* Which card is in front swaps in the middle of a drag, where the two
     overlap most — so a hand resting near the middle flipped it back and
     forth with every tremor. It swaps at the middle and swaps back only
     well before it; between the two it stays as it was. (The drag goes
     heavy past half the width, so a hand seldom gets much beyond 0.55 —
     the swap cannot wait for more than the middle.) */
  const SWAP_ON = 0.5, SWAP_OFF = 0.38;
  let front = false, way = 0;

  const onDown = (e: PointerEvent) => {
    if (n < MIN || e.button !== 0) return;
    down = true; axis = null; dragged = false;
    front = false; way = 0;
    x0 = e.clientX; y0 = e.clientY; dx = 0;
    width = root.clientWidth || 1;
  };

  const onMove = (e: PointerEvent) => {
    if (!down) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!axis) {
      if (Math.hypot(mx, my) < 4) return;
      // whichever way it set off decides whose drag it is, once
      axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
      if (axis === 'x') {
        dragged = true;
        root.dataset.drag = 'grabbing';
        // a pointer that has already gone (or was never a real one) cannot be
        // captured, and says so by throwing; the drag works without it
        try { list.setPointerCapture(e.pointerId); } catch { /* not ours to keep */ }
        cancelAnimationFrame(raf); raf = 0;
      }
    }
    if (axis !== 'x') return;
    // half the width either way, and it gets heavy past that
    const half = width / 2, over = Math.abs(mx) - half;
    dx = over <= 0 ? mx : Math.sign(mx) * (half + over * 0.2);
    const raw = dx / width;
    const k = Math.min(1, Math.abs(raw));
    const step = raw > 0 ? -1 : 1;
    const next = at + step;
    // dragged back through the start and out the other side: a new pass
    if (step !== way) { way = step; front = false; }
    if (k > SWAP_ON) front = true; else if (k < SWAP_OFF) front = false;
    aim = cards.map((_, i) => {
      const a = poseFor(offset(i, at, n)), b = poseFor(offset(i, next, n));
      return { ...mix(a, b, k), z: front ? b.z : a.z };
    });
    if (!followRaf) { followLast = 0; followRaf = requestAnimationFrame(follow); }
  };

  const onUp = () => {
    if (!down) return;
    down = false;
    delete root.dataset.drag;
    // the hand has let go: nothing to follow, and the throw takes over from
    // wherever the cards have got to
    aim = null; cancelAnimationFrame(followRaf); followRaf = 0; followLast = 0;
    if (axis !== 'x') return;
    const raw = dx / width;
    settle(at + (raw > THRESHOLD ? -1 : raw < -THRESHOLD ? 1 : 0));
  };

  /* A drag ends in a click on whatever it let go over, and that click is
     swallowed. A tap on a card at the side brings it to the middle rather
     than opening it — you have to see a project before you are taken to
     it. A tap on the card in the middle is a link, and goes. */
  const onClick = (e: MouseEvent) => {
    if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; return; }
    const card = (e.target as Element).closest<HTMLElement>('[data-pile-card]');
    if (!card) return;
    const i = cards.indexOf(card);
    if (i !== at) { e.preventDefault(); e.stopPropagation(); settle(i); }
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    settle(at + (e.key === 'ArrowRight' ? 1 : -1));
    cards[at].querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
  };

  // an image or a link dragged natively takes the pointer away from us
  const onNativeDrag = (e: DragEvent) => e.preventDefault();

  list.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);
  list.addEventListener('click', onClick, true);
  list.addEventListener('dragstart', onNativeDrag);
  root.addEventListener('keydown', onKey);

  root.dataset.live = '';
  settle(0);

  return {
    destroy() {
      cancelAnimationFrame(raf); cancelAnimationFrame(followRaf); warmIo.disconnect();
      removeEventListener('resize', fitDial);
      list.removeEventListener('pointerdown', onDown);
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
      removeEventListener('pointercancel', onUp);
      list.removeEventListener('click', onClick, true);
      list.removeEventListener('dragstart', onNativeDrag);
      root.removeEventListener('keydown', onKey);
    },
  };
}
