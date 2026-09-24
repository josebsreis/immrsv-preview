/* ═══════════════════════════════════════════════════════════════════
   The studios' opening: the sentence assembles, and then the mark is
   gone into.

   Two movements. The first is on time: as the screen arrives, the pieces
   of the sentence come in (the styles do it; this only says when). The
   second is on scroll: the words fall back and dim, and the large mark —
   which starts standing exactly over the small one in the line — is
   carried to the middle of the screen and grown, turning a little on the
   way, until one of its faces is bigger than the screen. That face is
   filled with the light half's ground, so what fills the screen is
   already the first studio's ground.

   How the studio itself arrives is one of two, chosen for the trial with
   `?face=` on the address:
     zoom    — the face fills the screen, and the studio rises in through
               the last part of that, so there is never a frame of empty
               white
     window  — the studio is inside the face from the start: the light
               half is clipped to the face's outline, and the face growing
               is the window opening

   Both lift the light half so that its head sits at the top of the
   screen for the whole passage, and hand it back to the page's plain flow
   the moment it owns the screen. A reader who asked for less motion gets
   the sentence, and the studio riding up as every section did.
   ═══════════════════════════════════════════════════════════════════ */

import { SYMBOL } from '../../lib/lettermark';

export interface StudiosOpening { destroy(): void }

/** the face gone into is the right-hand one of the three, `data-face="2"`
 *  in the markup: its outline, in the mark's own units, and the point of it the screen
 *  is centred on — chosen so the whole screen fits inside the face at the
 *  end, clear of the notch at its top-left */
const FACE_POINTS: [number, number][] = [
  [135.17, 105.94], [135.17, 136.45], [108.6, 151.89], [108.6, 216.06], [190.28, 168.58], [190.28, 74.38],
];
const FOCUS = { x: 160, y: 143 };
/** how far the mark turns on the way in, radians */
const TURN = 0.38;
/** how much of the passage the words take to fall back */
const WORDS_OUT = 0.3;
/** zoom: where the studio starts rising in, as a share of the passage, and
 *  how far it rises from */
const RISE_FROM = 0.72;
const RISE_PX = 40;
/** the passage runs past the point the light half begins to arrive, so the
 *  zoom is still finishing as the studio comes: this much of a screen past */
const OVERLAP = 0.6;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (t: number) => t * t * (3 - 2 * t);

/** is the point inside the polygon — the usual ray cast */
function inside(px: number, py: number, poly: [number, number][]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export function createStudiosOpening(root: HTMLElement): StudiosOpening {
  const track = root.querySelector<HTMLElement>('[data-opening-track]');
  const pane = root.querySelector<HTMLElement>('[data-opening-pane]');
  const line = root.querySelector<HTMLElement>('[data-opening-line]');
  const small = root.querySelector<SVGSVGElement>('[data-opening-inline]');
  const slot = root.querySelector<HTMLElement>('[data-opening-slot]');
  const big = root.querySelector<SVGSVGElement>('[data-opening-mark]');
  const light = document.querySelector<HTMLElement>('[data-light]');
  if (!track || !pane || !line || !small || !slot || !big || !light) return { destroy() {} };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return { destroy() {} };
  root.dataset.live = '';

  const mode = new URLSearchParams(location.search).get('face') === 'window' ? 'window' : 'zoom';

  /* the assembly plays once, when the screen is half in view */
  const seen = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { root.classList.add('in'); seen.disconnect(); }
  }, { threshold: 0.5 });
  seen.observe(pane);

  /* the scale at which the whole screen, turned by the final turn, sits
     inside the face: found by halving, against the face's own outline */
  let endScale = 1;
  const fit = () => {
    const vw = innerWidth, vh = innerHeight;
    const c = Math.cos(-TURN), s = Math.sin(-TURN);
    const fits = (k: number) => {
      for (const [dx, dy] of [[-vw / 2, -vh / 2], [vw / 2, -vh / 2], [vw / 2, vh / 2], [-vw / 2, vh / 2]]) {
        const x = FOCUS.x + (c * dx - s * dy) / k, y = FOCUS.y + (s * dx + c * dy) / k;
        if (!inside(x, y, FACE_POINTS)) return false;
      }
      return true;
    };
    let lo = 1, hi = 400;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    endScale = hi * 1.03;
  };

  let frame = 0;
  let lastKey = '';
  let held = false;                 // the light half is being carried

  /* The nav reads its ground from whichever themed section is under it,
     and the light half's box is under it from the first moment it is
     carried — long before its ground has filled the screen. So while the
     face is still small every themed thing in the light half is told to
     say dark, and given back its own word once the face has all but taken
     the screen. The panels' own script may take a theme away meanwhile;
     only what still carries one is given back. */
  const said = new Map<HTMLElement, string>();
  const sayDark = () => {
    if (said.size) return;
    for (const el of light.querySelectorAll<HTMLElement>('[data-theme]')) {
      said.set(el, el.dataset.theme ?? 'light');
      el.dataset.theme = 'dark';
    }
  };
  const sayOwn = () => {
    for (const [el, was] of said) if (el.dataset.theme === 'dark') el.dataset.theme = was;
    said.clear();
  };

  const release = () => {
    if (!held) return;
    held = false;
    light.style.transform = ''; light.style.clipPath = ''; light.style.opacity = '';
    sayOwn();
  };

  const paint = (p: number, y: number) => {
    const vw = innerWidth, vh = innerHeight;
    /* where the small mark's room in the line is — the slot, which no
       transform of the mark's own arrival moves — and so where the large
       one starts */
    const ir = slot.getBoundingClientRect();
    const pr = pane.getBoundingClientRect();
    const s0 = ir.width / SYMBOL.box.w;
    const cx0 = ir.left - pr.left + (FOCUS.x - SYMBOL.box.x) * s0;
    const cy0 = ir.top - pr.top + (FOCUS.y - SYMBOL.box.y) * s0;
    const e = smooth(p);
    /* the scale grows by ratio, not by difference, so the zoom keeps one
       speed to the eye from the small mark to the screen */
    const sc = s0 * Math.pow(endScale / s0, e);
    const cx = cx0 + (vw / 2 - cx0) * e, cy = cy0 + (vh / 2 - cy0) * e, r = TURN * e;
    big.style.transform = `translate(${cx.toFixed(2)}px, ${cy.toFixed(2)}px) rotate(${r.toFixed(4)}rad) scale(${sc.toFixed(4)}) translate(${-FOCUS.x}px, ${-FOCUS.y}px)`;
    big.style.visibility = 'visible';
    small.style.visibility = 'hidden';

    const w = clamp01(p / WORDS_OUT);
    line.style.opacity = (1 - w).toFixed(3);
    line.style.transform = `scale(${(1 - 0.06 * w).toFixed(4)})`;

    /* the light half, carried: its head at the top of the screen */
    held = true;
    const lift = -(light.offsetTop - y);
    if (mode === 'window') {
      const c = Math.cos(r), s = Math.sin(r);
      const pts = FACE_POINTS.map(([x, yy]) => {
        const dx = x - FOCUS.x, dy = yy - FOCUS.y;
        return `${(cx + sc * (c * dx - s * dy)).toFixed(1)}px ${(cy + sc * (s * dx + c * dy)).toFixed(1)}px`;
      });
      light.style.transform = `translateY(${lift.toFixed(1)}px)`;
      light.style.clipPath = `polygon(${pts.join(', ')})`;
      light.style.opacity = '';
    } else {
      const f = smooth(clamp01((p - RISE_FROM) / (1 - RISE_FROM)));
      light.style.transform = `translateY(${(lift + (1 - f) * RISE_PX).toFixed(1)}px)`;
      light.style.opacity = f.toFixed(3);
      light.style.clipPath = '';
    }
    if (p < 0.9) sayDark(); else sayOwn();
  };

  const update = () => {
    frame = 0;
    const y = scrollY, vh = innerHeight;
    const top = light.offsetTop - track.offsetHeight;      // the track's own place
    const run = Math.max(1, track.offsetHeight - vh);
    const p = clamp01((y - top) / (run + vh * OVERLAP));
    const owned = y >= light.offsetTop;                     // the studio owns the screen
    const key = `${p.toFixed(3)}:${owned ? 1 : 0}`;
    if (key === lastKey) return;
    lastKey = key;
    if (p <= 0) {
      big.style.visibility = ''; small.style.visibility = '';
      line.style.opacity = ''; line.style.transform = '';
      release();
    } else if (owned) {
      release();
    } else {
      paint(p, y);
    }
  };

  const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
  const onResize = () => { fit(); lastKey = ''; update(); };
  fit();
  document.fonts.ready.then(() => { fit(); lastKey = ''; update(); });
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onResize);

  return {
    destroy() {
      seen.disconnect();
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onResize);
      if (frame) cancelAnimationFrame(frame);
      release();
      delete root.dataset.live;
    },
  };
}
