/* ═══════════════════════════════════════════════════════════════════
   The questions, opened one at a time.

   An answer opens on its own height rather than on a guess, so a long
   one and a short one take the same easing and neither is clipped. The
   height is measured and animated with the Web Animations API — a CSS
   transition would need the end value laid out first, and that reflow
   is a frame of the answer at full height before it moves.

   Only one stands open. Letting them all open turns the section into a
   wall of text and loses the list, which is the thing a reader came
   here to scan.
   ═══════════════════════════════════════════════════════════════════ */

export interface Faqs { destroy(): void }

const MS = 460;
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

export function createFaqs(root: HTMLElement): Faqs {
  const items = [...root.querySelectorAll<HTMLElement>('.item')];
  if (!items.length) return { destroy() {} };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  type Row = { item: HTMLElement; q: HTMLElement; a: HTMLElement };
  const rows: Row[] = [];
  for (const item of items) {
    const q = item.querySelector<HTMLElement>('[data-faq-q]');
    const a = item.querySelector<HTMLElement>('[data-faq-a]');
    if (q && a) rows.push({ item, q, a });
  }
  /* the panels are closed from here rather than in the styles: without this
     script every answer is simply open, which is the fallback the section is
     written to survive */
  root.dataset.live = '';
  for (const { a } of rows) a.style.height = '0px';

  let open: Row | null = null;
  /* a row the markup marks `open` starts that way — standing, not animated
     into place: the project page opens on the brief */
  const first = rows.find((r) => r.item.classList.contains('open'));
  if (first) { open = first; first.q.setAttribute('aria-expanded', 'true'); first.a.style.height = 'auto'; }

  /** from wherever it is now to wherever it should be, and then let go of the
   *  height so the answer can reflow with the page */
  function move(row: Row, to: number) {
    const from = row.a.getBoundingClientRect().height;
    row.a.getAnimations().forEach((x) => x.cancel());
    row.a.style.height = to ? 'auto' : '0px';
    if (reduced) return;
    row.a.animate([{ height: `${from}px` }, { height: to ? `${to}px` : '0px' }],
                  { duration: MS, easing: EASE });
  }

  function set(row: Row, want: boolean) {
    if (want === (open === row)) return;
    if (open && open !== row) {
      const was = open;
      open = null;
      was.item.classList.remove('open');
      was.q.setAttribute('aria-expanded', 'false');
      move(was, 0);
    }
    if (!want) { open = null; row.item.classList.remove('open'); row.q.setAttribute('aria-expanded', 'false'); move(row, 0); return; }
    open = row;
    row.item.classList.add('open');
    row.q.setAttribute('aria-expanded', 'true');
    // measured against the page it will land in, not against nothing
    row.a.style.height = 'auto';
    const to = row.a.getBoundingClientRect().height;
    row.a.style.height = '0px';
    move(row, to);
  }

  const offs: Array<() => void> = [];
  for (const row of rows) {
    const onClick = () => set(row, open !== row);
    row.q.addEventListener('click', onClick);
    offs.push(() => row.q.removeEventListener('click', onClick));
  }

  /* an answer that was open when the page was resized is measured again:
     its height is the width's business */
  const onResize = () => { if (open) { open.a.style.height = 'auto'; } };
  addEventListener('resize', onResize);

  return {
    destroy() {
      offs.forEach((off) => off());
      removeEventListener('resize', onResize);
    },
  };
}
