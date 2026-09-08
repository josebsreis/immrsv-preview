/* ═══════════════════════════════════════════════════════════════════
   The name inks in. The mark is drawn as a hairline outline with a solid
   copy over it, masked by a row of columns. Moving across the mark turns
   the columns under the cursor on; leaving the panel drains them again,
   left to right, so the next visitor gets the same blank sheet.
   ═══════════════════════════════════════════════════════════════════ */

export interface WordmarkInk { destroy(): void; }

export interface WordmarkInkOptions {
  brush?: number;      // how many columns either side of the cursor are inked
  drainStep?: number;  // ms between columns as the ink drains
  drainWait?: number;  // ms of stillness before draining starts
}

export function createWordmarkInk(host: HTMLElement, opts: WordmarkInkOptions = {}): WordmarkInk | null {
  const columns = Array.from(host.querySelectorAll<SVGRectElement>('.col'));
  const rule = host.querySelector<HTMLElement>('[data-wordmark-rule]');
  if (columns.length === 0) return null;

  const brush = opts.brush ?? 1;
  const drainStep = opts.drainStep ?? 12;
  const drainWait = opts.drainWait ?? 260;
  const N = columns.length;

  let drain = 0, wait = 0;

  const stopDrain = () => { clearInterval(drain); clearTimeout(wait); drain = 0; wait = 0; };

  function ink(atX: number) {
    const i = Math.round(atX * (N - 1));
    for (let k = i - brush; k <= i + brush; k++) columns[k]?.classList.add('on');
  }

  /** the ink runs off the way it went on: one column at a time, left to right */
  function startDrain() {
    stopDrain();
    let i = 0;
    drain = window.setInterval(() => {
      columns[i]?.classList.remove('on');
      if (++i >= N) stopDrain();
    }, drainStep);
  }

  const onMove = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    const pad = r.height * 0.9;                      // the mark answers a little before the cursor arrives
    const inside = e.clientX >= r.left - pad && e.clientX <= r.right + pad
                && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
    if (!inside) { if (host.dataset.inking !== undefined) leave(); return; }

    stopDrain();
    host.dataset.inking = '';
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    ink(x);
    if (rule) rule.style.setProperty('--x', `${(x * r.width).toFixed(1)}px`);
  };

  function leave() {
    delete host.dataset.inking;
    stopDrain();
    wait = window.setTimeout(startDrain, drainWait);
  }

  addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('mouseleave', leave);

  return {
    destroy() {
      stopDrain();
      removeEventListener('pointermove', onMove);
      document.removeEventListener('mouseleave', leave);
    },
  };
}
