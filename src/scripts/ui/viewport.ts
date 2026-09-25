/* ═══════════════════════════════════════════════════════════════════
   A screen height that holds still.

   On a phone the browser's own bars come and go as the page is scrolled
   up and down, and the window's height changes with them — so anything
   laid out or driven by `innerHeight` jumps every time the reader turns
   round. This is the height with the bars gone (the `lvh` unit), measured
   once and measured again only when the width changes: a turn of the
   phone, or a desktop window being resized, but never a bar sliding in.
   ═══════════════════════════════════════════════════════════════════ */

let height = 0;
let width = 0;
let probe: HTMLElement | null = null;

function measure(): number {
  if (!probe) {
    probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100vh;height:100lvh;visibility:hidden;pointer-events:none;';
    document.body.appendChild(probe);
  }
  return probe.getBoundingClientRect().height || innerHeight;
}

/** the screen's height, steady while the browser's bars come and go */
export function stableHeight(): number {
  if (!height || innerWidth !== width) {
    width = innerWidth;
    height = measure();
  }
  return height;
}

/** true when a resize is worth answering: the width changed, not only the
 *  height a browser bar took or gave back */
export function widthChanged(): boolean {
  const before = width;
  stableHeight();
  return before !== width;
}
