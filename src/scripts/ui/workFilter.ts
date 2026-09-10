/* ═══════════════════════════════════════════════════════════════════
   The Work page's studio filter. The chosen studio lives in the URL
   (`/work?studio=media`), so a filtered page can be linked to and the
   browser's back button steps through the choices. With JS off, or before
   this runs, every project is shown — the filter only ever takes things
   away.
   ═══════════════════════════════════════════════════════════════════ */

export interface WorkFilter { destroy(): void; }

const ALL = 'all';
/* How the wave is timed. The stylesheet holds the same three numbers: a card
   leaves in OUT, each one starts STEP after the one before it, and no card
   waits longer than CAP steps — without that ceiling a full grid would take
   half a second just to clear. */
const OUT = 300;
const STEP = 30;
const CAP = 5;

export function createWorkFilter(root: ParentNode = document): WorkFilter {
  const bar = root.querySelector<HTMLElement>('[data-filter]');
  const grid = root.querySelector<HTMLElement>('[data-filter-grid]');
  if (!bar || !grid) return { destroy() {} };

  const buttons = Array.from(bar.querySelectorAll<HTMLButtonElement>('[data-filter-key]'));
  /* the stand-in line when a studio is empty: one thing, so it goes as a
     block rather than joining the wave */
  const veiled: HTMLElement[] = [];
  const items = Array.from(grid.querySelectorAll<HTMLElement>('[data-studios]'));
  const empty = root.querySelector<HTMLElement>('[data-filter-empty]');
  if (empty) veiled.push(empty);
  const count = root.querySelector<HTMLElement>('[data-filter-count]');
  const keys = new Set(buttons.map((b) => b.dataset.filterKey!));

  const read = (): string => {
    const asked = new URLSearchParams(location.search).get('studio') ?? ALL;
    return keys.has(asked) ? asked : ALL;
  };

  /**
   * The control answers at once, and the set follows.
   *
   * Which pill is lit is not part of the wave: a reader has just pressed it
   * and it has to say so in that frame, or the press reads as having missed.
   * Only the cards wait for their turn.
   */
  function mark(key: string) {
    for (const b of buttons) {
      const on = b.dataset.filterKey === key;
      b.setAttribute('aria-pressed', String(on));
      b.toggleAttribute('data-on', on);
    }
  }

  /** show what matches; the label under the bar says how many */
  function paint(key: string) {
    let shown = 0;
    for (const item of items) {
      const mine = (item.dataset.studios ?? '').split(' ');
      const on = key === ALL || mine.includes(key);
      item.toggleAttribute('data-off', !on);
      /* out of the tab order as well as out of sight — a hidden card that
         can still be tabbed into is a card the reader cannot see */
      item.querySelectorAll<HTMLElement>('a, button').forEach((el) => {
        if (on) el.removeAttribute('tabindex');
        else el.setAttribute('tabindex', '-1');
      });
      if (on) shown++;
    }
    if (empty) empty.toggleAttribute('hidden', shown > 0);
    if (count) count.textContent = `${shown} ${shown === 1 ? 'project' : 'projects'}`;
  }

  /**
   * The change, made card by card.
   *
   * The set does not blur as one sheet — each card goes out for itself, a
   * beat after the one before it, softening and shrinking as it leaves; the
   * filter is applied while none of them can be seen, which is also when the
   * rows close up and the page changes height; then the new set arrives the
   * same way. The wave is capped, so fourteen cards do not take fourteen
   * beats to go.
   *
   * A reader who asked for less motion gets the change and nothing else.
   */
  let swap: ReturnType<typeof setTimeout> | undefined;

  /** deal the cards their place in the wave, in the order they are read */
  function order(list: HTMLElement[]) {
    list.forEach((el, i) => el.style.setProperty('--n', String(i)));
  }
  const here = () => items.filter((el) => !el.hasAttribute('data-off'));

  function change(apply: () => void) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return apply();

    clearTimeout(swap);
    const leaving = here();
    order(leaving);
    for (const el of leaving) el.setAttribute('data-swap', '');
    for (const el of veiled) el.setAttribute('data-swap', '');

    swap = setTimeout(() => {
      apply();
      order(here());
      /* one frame with the new set still veiled, so nothing is seen arriving
         at the wrong opacity before the grid has settled at its new height */
      requestAnimationFrame(() => requestAnimationFrame(() => {
        /* every card, not only the ones arriving: one left blurred while it
           was filtered out would come back invisible the next time round */
        for (const el of items) el.removeAttribute('data-swap');
        for (const el of veiled) el.removeAttribute('data-swap');
      }));
    }, OUT + STEP * CAP);
  }

  function go(key: string, push: boolean) {
    const url = new URL(location.href);
    if (key === ALL) url.searchParams.delete('studio');
    else url.searchParams.set('studio', key);
    if (push && url.href !== location.href) history.pushState({ studio: key }, '', url);
    mark(key);
    change(() => paint(key));
  }

  const onClick = (e: Event) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-filter-key]');
    if (b) go(b.dataset.filterKey!, true);
  };
  const onPop = () => { const key = read(); mark(key); change(() => paint(key)); };

  bar.addEventListener('click', onClick);
  addEventListener('popstate', onPop);
  mark(read());
  paint(read());

  return {
    destroy() {
      clearTimeout(swap);
      bar.removeEventListener('click', onClick);
      removeEventListener('popstate', onPop);
    },
  };
}
