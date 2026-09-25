/* ═══════════════════════════════════════════════════════════════════
   A screen height that holds still.

   On a phone the browser's own bars come and go as the page is scrolled
   up and down, and the window's height changes with them — so anything
   laid out or driven by `innerHeight` jumps every time the reader turns
   round. This is the height with the bars gone (the `lvh` unit), which
   the bars do not change: it is re-read on every resize, so a desktop
   window made taller or shorter is answered, and a bar sliding in on a
   phone — which leaves it where it was — is not.
   ═══════════════════════════════════════════════════════════════════ */

let height = 0;
let width = 0;
let probe: HTMLElement | null = null;

function measure(): void {
  if (!probe) {
    probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100vh;height:100lvh;visibility:hidden;pointer-events:none;';
    document.body.appendChild(probe);
  }
  height = probe.getBoundingClientRect().height || innerHeight;
  width = innerWidth;
}
addEventListener('resize', () => { if (probe) measure(); }, { passive: true });

/** the screen's height, steady while the browser's bars come and go */
export function stableHeight(): number {
  if (!height) measure();
  return height;
}

/** true when the screen really changed size — a window resized, a phone
 *  turned — and not only by a browser bar sliding in or out */
export function sizeChanged(lastW: number, lastH: number): boolean {
  stableHeight();
  return width !== lastW || Math.abs(height - lastH) > 0.5;
}
