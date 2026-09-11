/* ═══════════════════════════════════════════════════════════════════
   The selected work, as a pile of cards fanned out on the table.

   One card lies square in the middle with the rest tipped away to either
   side of it, and a card is changed by throwing it: drag the pile sideways
   and every card travels part of the way to where it would be one step
   over, let go past a tenth of the width and they finish the move with a
   little overshoot, let go short of it and they fall back. It loops — the
   card thrown off the top goes round to the far side of the pile.

   The layout and the feel are Osmo's flick cards (osmo.supply), rebuilt
   without GSAP: the table of poses is theirs, and so is the ease, written
   out below. Nothing else on this site runs on a library, and one section
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

/** where a card lies for its distance from the middle — Osmo's table */
export function poseFor(d: number): Pose {
  switch (d) {
    case 0: return { x: 0, y: 0, rot: 0, s: 1, o: 1, z: 5 };
    case 1: return { x: 25, y: 1, rot: 10, s: 0.9, o: 1, z: 4 };
    case -1: return { x: -25, y: 1, rot: -10, s: 0.9, o: 1, z: 4 };
    case 2: return { x: 45, y: 5, rot: 15, s: 0.8, o: 1, z: 3 };
    case -2: return { x: -45, y: 5, rot: -15, s: 0.8, o: 1, z: 3 };
    default: {
      const dir = d > 0 ? 1 : -1;
      return { x: 55 * dir, y: 5, rot: 20 * dir, s: 0.6, o: 0, z: 2 };
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
  t >= 1 ? 1 : AMP * 2 ** (-10 * t) * Math.sin((t - PHASE) * ((Math.PI * 2) / PERIOD)) + 1;

const mix = (a: Pose, b: Pose, k: number): Pose => ({
  x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k,
  rot: a.rot + (b.rot - a.rot) * k, s: a.s + (b.s - a.s) * k,
  o: a.o + (b.o - a.o) * k, z: a.z,
});

export function createWorkPile(root: HTMLElement): WorkPile {
  const list = root.querySelector<HTMLElement>('[data-pile-list]');
  const cards = [...root.querySelectorAll<HTMLElement>('[data-pile-card]')];
  const n = cards.length;
  if (!list || n === 0) return { destroy() {} };
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let at = 0;
  let now: Pose[] = cards.map((_, i) => poseFor(offset(i, 0, n)));
  let from: Pose[] = now, to: Pose[] = now;
  let start = 0, raf = 0;

  const paint = (i: number) => {
    const card = cards[i], p = now[i];
    card.style.transform = transformOf(p);
    card.style.opacity = p.o.toFixed(3);
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
    at = ((index % n) + n) % n;
    cards.forEach((card, i) => {
      const d = offset(i, at, n);
      card.dataset.pileStatus = statusFor(d);
      card.style.zIndex = String(poseFor(d).z);
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

  const onDown = (e: PointerEvent) => {
    if (n < MIN || e.button !== 0) return;
    down = true; axis = null; dragged = false;
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
    const next = at + (raw > 0 ? -1 : 1);
    now = cards.map((_, i) => mix(poseFor(offset(i, at, n)), poseFor(offset(i, next, n)), k));
    cards.forEach((_, i) => paint(i));
  };

  const onUp = () => {
    if (!down) return;
    down = false;
    delete root.dataset.drag;
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
      cancelAnimationFrame(raf);
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
