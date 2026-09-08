/* ═══════════════════════════════════════════════════════════════════
   Directional hover: a tile that enters a cell from whichever edge the
   cursor crossed, and leaves by the edge it exits. Wired by attributes:

     [data-dhover]                 the container (optionally data-axis="x|y|all")
     [data-dhover-item]            each cell — carries data-status for CSS
     [data-dhover-tile]            the thing that slides, inside the cell

   The tile's transition lives in CSS; this only decides which side it
   starts and ends on.
   ═══════════════════════════════════════════════════════════════════ */

type Edge = 'top' | 'right' | 'bottom' | 'left';
type Axis = 'x' | 'y' | 'all';

const OFF: Record<Edge, string> = {
  top: 'translateY(-100%)',
  bottom: 'translateY(100%)',
  left: 'translateX(-100%)',
  right: 'translateX(100%)',
};

export interface DirectionalHover { destroy(): void; }

function edgeFrom(e: PointerEvent, el: HTMLElement, axis: Axis): Edge {
  const { left, top, width: w, height: h } = el.getBoundingClientRect();
  const x = e.clientX - left, y = e.clientY - top;
  if (axis === 'y') return y < h / 2 ? 'top' : 'bottom';
  if (axis === 'x') return x < w / 2 ? 'left' : 'right';
  const d: Record<Edge, number> = { top: y, right: w - x, bottom: h - y, left: x };
  return (Object.keys(d) as Edge[]).reduce((a, b) => (d[a] <= d[b] ? a : b));
}

export function createDirectionalHover(root: ParentNode = document): DirectionalHover {
  const cleanup: Array<() => void> = [];

  root.querySelectorAll<HTMLElement>('[data-dhover]').forEach((container) => {
    const axis = (container.dataset.axis as Axis) ?? 'all';

    container.querySelectorAll<HTMLElement>('[data-dhover-item]').forEach((item) => {
      const tile = item.querySelector<HTMLElement>('[data-dhover-tile]');
      if (!tile) return;

      const enter = (e: PointerEvent) => {
        const edge = edgeFrom(e, item, axis);
        tile.style.transition = 'none';             // park it outside on that side…
        tile.style.transform = OFF[edge];
        void tile.offsetHeight;                     // …commit the jump…
        tile.style.transition = '';                 // …then let CSS bring it in
        tile.style.transform = 'translate(0, 0)';
        item.dataset.status = `enter-${edge}`;
      };
      const leave = (e: PointerEvent) => {
        const edge = edgeFrom(e, item, axis);
        tile.style.transform = OFF[edge];
        item.dataset.status = `leave-${edge}`;
      };

      item.addEventListener('pointerenter', enter);
      item.addEventListener('pointerleave', leave);
      cleanup.push(() => {
        item.removeEventListener('pointerenter', enter);
        item.removeEventListener('pointerleave', leave);
      });
    });
  });

  return { destroy() { cleanup.forEach((fn) => fn()); } };
}
