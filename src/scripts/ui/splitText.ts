/** Split a label into per-character spans (each with `--i`) so the button
 *  hover can move them one after another. Idempotent. */
export function splitChars(root: ParentNode = document, selector = '[data-split]'): void {
  root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    if (el.dataset.splitDone) return;
    const txt = el.textContent ?? ''; el.textContent = '';
    [...txt].forEach((c, i) => { const s = document.createElement('span'); s.className = 'ch'; s.style.setProperty('--i', String(i)); s.textContent = c; el.appendChild(s); });
    el.dataset.splitDone = '1';
  });
}
