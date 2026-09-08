/** Shared pointer state in 0..1 viewport coordinates (y up). Raw target
 *  (tx, ty) for collisions; eased (x, y) for parallax. */
export interface Pointer { x: number; y: number; tx: number; ty: number; moved: boolean; }

export function createPointer(): { pointer: Pointer; destroy(): void } {
  const P: Pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, moved: false };
  const set = (cx: number, cy: number) => { P.tx = cx / innerWidth; P.ty = 1 - cy / innerHeight; P.moved = true; };
  const onMove = (e: PointerEvent) => set(e.clientX, e.clientY);
  const onTouch = (e: TouchEvent) => { const t = e.touches[0]; if (t) set(t.clientX, t.clientY); };
  const onLeave = () => { P.moved = false; };
  addEventListener('pointermove', onMove);
  addEventListener('touchmove', onTouch, { passive: true });
  document.addEventListener('mouseleave', onLeave);
  return {
    pointer: P,
    destroy() { removeEventListener('pointermove', onMove); removeEventListener('touchmove', onTouch); document.removeEventListener('mouseleave', onLeave); },
  };
}
