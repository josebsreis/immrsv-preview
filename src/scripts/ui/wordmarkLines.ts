/* ═══════════════════════════════════════════════════════════════════
   The name at the foot of the page, drawn as a set of horizontal lines
   and combed by the cursor.

   Each row follows the pointer sideways, and how much it follows falls
   away with its distance from the pointer's own height — so the mark
   answers where it is touched and holds still everywhere else. One rAF
   for the whole thing, writing one number per row.

   A screen with no pointer gets the other half of the idea: the rows
   arrive one after another the first time the mark is scrolled to, and
   then stay. Nothing is left running.
   ═══════════════════════════════════════════════════════════════════ */

export interface WordmarkLines { destroy(): void; }

/** how far a row can be pulled, in the mark's own grid units */
const REACH = 3.4;
/** how quickly the pull dies away with vertical distance, in rows */
const FALLOFF = 5.5;
/** how fast a row catches up with where it should be */
const EASE = 0.12;

export function createWordmarkLines(root: HTMLElement): WordmarkLines {
  const rows = Array.from(root.querySelectorAll<SVGGElement>('[data-line]'));
  if (rows.length === 0) return { destroy() {} };

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* the arrival, for a screen that cannot hover — and for anyone who asked
     for less motion, the mark is simply there */
  if (!fine || still) {
    if (!still) {
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        rows.forEach((row, i) => { row.style.transitionDelay = `${i * 0.022}s`; });
        root.dataset.in = '';
        io.disconnect();
      }, { threshold: 0.2 });
      io.observe(root);
      return { destroy() { io.disconnect(); } };
    }
    root.dataset.in = '';
    return { destroy() {} };
  }

  /* where the pointer is, in the mark's own grid, and where each row has
     got to on its way there */
  let px = 0, py = -999, live = false, raf = 0;
  const at = new Float32Array(rows.length);

  const onEnter = () => { live = true; };
  const onLeave = () => { live = false; py = -999; };
  const onMove = (e: PointerEvent) => {
    const box = root.getBoundingClientRect();
    if (box.width === 0) return;
    /* the mark's box is the ink only, so a row's number is counted from the
       first inked row rather than from the top of the original artwork */
    const grid = Number(root.dataset.rows ?? rows.length);
    const first = Number(root.dataset.top ?? 0);
    px = ((e.clientX - box.left) / box.width - 0.5) * 2;      // −1 … 1
    py = first + ((e.clientY - box.top) / box.height) * grid;  // in rows
  };

  function frame() {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const y = Number(row.dataset.line);
      let want = 0;
      if (live && py > -900) {
        const d = Math.abs(y - py) / FALLOFF;
        want = px * REACH * Math.exp(-d * d);                  // a soft bell
      }
      at[i] += (want - at[i]) * EASE;
      if (Math.abs(at[i]) < 0.001) at[i] = 0;
      row.style.setProperty('--dx', at[i].toFixed(3));
    }
    raf = requestAnimationFrame(frame);
  }

  root.dataset.in = '';
  root.addEventListener('pointerenter', onEnter);
  root.addEventListener('pointerleave', onLeave);
  root.addEventListener('pointermove', onMove);

  /* it only runs while it is on screen; a footer is off screen most of the
     time and a loop down there costs the whole page */
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !raf) raf = requestAnimationFrame(frame);
    else if (!e.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; }
  }, { threshold: 0 });
  io.observe(root);

  return {
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      root.removeEventListener('pointerenter', onEnter);
      root.removeEventListener('pointerleave', onLeave);
      root.removeEventListener('pointermove', onMove);
    },
  };
}
