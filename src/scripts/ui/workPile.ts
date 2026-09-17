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
/** how far the dial behind the pile turns for one card thrown */
const TURN = 4;
/** the dial at rest: degrees a second, the inner ring one way and the outer
 *  the other; under the hand it is this many times faster, and a throw
 *  kicks it and lets it run down */
const DRIFT = 0.9, HELD = 6, KICK = 40, RUNDOWN = 0.7;

/* GSAP's elastic.out(1.2, 1): one overshoot past the mark and back, which is
   the card landing rather than bouncing */
const AMP = 1.2, PERIOD = 1;
const PHASE = (PERIOD / (Math.PI * 2)) * Math.asin(1 / AMP);
const elastic = (t: number) =>
  t >= 1 ? 1 : AMP * 2 ** (-10 * t) * Math.sin((t - PHASE) * ((Math.PI * 2) / PERIOD)) + 1;

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
  /** every card the pile has moved on by, both ways, so the dial behind it
   *  keeps turning the way the pile went rather than running back round when
   *  the count wraps */
  let turns = 0;
  /* the two rings: each has its own angle, and both take the pile's turn —
     the inner one with it and the outer one against it — on top of their
     own slow drift, which runs the whole time the section is on screen */
  const rings = [...root.querySelectorAll<SVGElement>('[data-pile-ring]')];
  let hand = 0, spin = [0, 0], kick = 0, dialRaf = 0, dialLast = 0, seen = false;
  const turnDial = (by: number) => { hand = by * TURN; };
  const dialFrame = (t: number) => {
    dialRaf = 0;
    const dt = Math.min(0.05, (t - (dialLast || t)) / 1000);
    dialLast = t;
    const rate = DRIFT * (root.dataset.drag ? HELD : 1) + kick;
    kick *= Math.exp(-dt / RUNDOWN);
    spin = [spin[0] + rate * dt, spin[1] - rate * dt];
    rings.forEach((r, i) => { r.style.transform = `rotate(${(spin[i] + (i ? hand : -hand)).toFixed(2)}deg)`; });
    if (seen) dialRaf = requestAnimationFrame(dialFrame);
  };
  const dialIo = new IntersectionObserver(([e]) => {
    seen = e.isIntersecting;
    if (seen && !dialRaf && !still) { dialLast = 0; dialRaf = requestAnimationFrame(dialFrame); }
  });
  if (rings.length) dialIo.observe(root);
  let now: Pose[] = cards.map((_, i) => poseFor(offset(i, 0, n)));
  let from: Pose[] = now, to: Pose[] = now;
  let start = 0, raf = 0;

  const paint = (i: number) => {
    const card = cards[i], p = now[i];
    card.style.transform = transformOf(p);
    card.style.opacity = p.o.toFixed(3);
    card.style.zIndex = String(p.z);
  };

  function tick(t: number) {
    raf = 0;
    const k = Math.min(1, (t - start) / MS);
    const e = elastic(k);
    now = cards.map((_, i) => mix(from[i], to[i], e));
    cards.forEach((_, i) => paint(i));
    if (k < 1) raf = requestAnimationFrame(tick);
  }

  /** lay the pile out around card `index`, from wherever the cards are now */
  function settle(index: number) {
    const target = ((index % n) + n) % n;
    const by = offset(target, at, n);
    turns += by;
    at = target;
    turnDial(turns);
    // a throw kicks the dial, and it runs down again
    if (by) kick = KICK;
    cards.forEach((card, i) => {
      const d = offset(i, at, n);
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
     the pile; followed, it is smoothed out. */
  const FOLLOW = still ? 1 : 0.3;
  let aim: Pose[] | null = null, followRaf = 0;
  const follow = () => {
    followRaf = 0;
    if (!aim) return;
    const a = aim;
    now = now.map((p, i) => ({
      x: p.x + (a[i].x - p.x) * FOLLOW, y: p.y + (a[i].y - p.y) * FOLLOW,
      rot: p.rot + (a[i].rot - p.rot) * FOLLOW, s: p.s + (a[i].s - p.s) * FOLLOW,
      o: p.o + (a[i].o - p.o) * FOLLOW,
      // the order is not eased: a stacking order is whole numbers, and one
      // half-way between two of them is just noise
      z: a[i].z,
    }));
    cards.forEach((_, i) => paint(i));
    followRaf = requestAnimationFrame(follow);
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
    if (!followRaf) followRaf = requestAnimationFrame(follow);
    turnDial(turns + (next - at) * k);
  };

  const onUp = () => {
    if (!down) return;
    down = false;
    delete root.dataset.drag;
    // the hand has let go: nothing to follow, and the throw takes over from
    // wherever the cards have got to
    aim = null; cancelAnimationFrame(followRaf); followRaf = 0;
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
      cancelAnimationFrame(raf); cancelAnimationFrame(followRaf);
      cancelAnimationFrame(dialRaf); dialIo.disconnect();
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
