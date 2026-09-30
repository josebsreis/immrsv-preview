/* ═══════════════════════════════════════════════════════════════════
   The Work page's studio filter. The chosen studio lives in the URL
   (`/work?studio=media`), so a filtered page can be linked to and the
   browser's back button steps through the choices. With JS off, or before
   this runs, every project is shown — the filter only ever takes things
   away.
   ═══════════════════════════════════════════════════════════════════ */

export interface WorkFilter { destroy(): void; }

const ALL = 'all';

export function createWorkFilter(root: ParentNode = document): WorkFilter {
  const bar = root.querySelector<HTMLElement>('[data-filter]');
  const grid = root.querySelector<HTMLElement>('[data-filter-grid]');
  if (!bar || !grid) return { destroy() {} };

  const buttons = Array.from(bar.querySelectorAll<HTMLButtonElement>('[data-filter-key]'));
  const items = Array.from(grid.querySelectorAll<HTMLElement>('[data-studios]'));
  const empty = root.querySelector<HTMLElement>('[data-filter-empty]');
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
  /* The fill travels: it slides out of the pill that was chosen towards the
     new one, and into the new one from that same side — left to right when
     the choice moves right, right to left when it moves left. */
  const SLIDE = 420, EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current: string | null = null;
  function mark(key: string) {
    const from = buttons.findIndex((b) => b.dataset.filterKey === current);
    const to = buttons.findIndex((b) => b.dataset.filterKey === key);
    const right = to > from;
    for (const b of buttons) {
      const on = b.dataset.filterKey === key;
      b.setAttribute('aria-pressed', String(on));
      b.toggleAttribute('data-on', on);
    }
    if (current !== null && current !== key && from >= 0 && to >= 0 && !reduce) {
      const fillOf = (i: number) => buttons[i].querySelector<HTMLElement>('[data-filter-fill]');
      // out of the old one, towards the new
      fillOf(from)?.animate([
        { clipPath: 'inset(0 0 0 0)' },
        { clipPath: right ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)' },
      ], { duration: SLIDE, easing: EASE });
      // into the new one, from the side it came from
      fillOf(to)?.animate([
        { clipPath: right ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)' },
        { clipPath: 'inset(0 0 0 0)' },
      ], { duration: SLIDE, delay: SLIDE * 0.35, easing: EASE, fill: 'backwards' });
    }
    current = key;
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
   * The change, as one movement rather than a blink.
   *
   * The cards that stay never go: each glides from where it was to where
   * the new set puts it. The ones that leave fade where they stand — lifted
   * out of the grid first, so the rest can close up round them while they
   * go. The ones that arrive come up in their places, a beat apart. The grid
   * eases to its new height, so what is under it slides rather than jumps.
   * (Measured first, then last, then played back from the one to the other:
   * the cards are moved with `translate`, which the hover's `transform` does
   * not touch.)
   *
   * A reader who asked for less motion gets the change and nothing else.
   */
  const MOVE = 620, LEAVE = 260, ARRIVE = 520, STAGGER = 45;
  const glide = 'cubic-bezier(0.65, 0, 0.25, 1)';
  let running: Animation[] = [];
  let tidy: ReturnType<typeof setTimeout> | undefined;

  function change(apply: () => void) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return apply();

    /* A card still fading out from the last change is put away first — its
       fade cancelled, not finished: finished, its 'gone' held on after it,
       and the next change that brought it back brought it back invisible.
       Everything else still moving lands where it was going. */
    clearTimeout(tidy);
    running.forEach((a) => a.finish());
    running = [];
    putAway();

    const box = grid!.getBoundingClientRect();
    const before = new Map<HTMLElement, DOMRect>();
    for (const el of items) if (!el.hasAttribute('data-off')) before.set(el, el.getBoundingClientRect());
    const oldH = box.height;

    apply();

    const after = new Set(items.filter((el) => !el.hasAttribute('data-off')));
    const leaving = [...before.keys()].filter((el) => !after.has(el));

    /* the leaving, lifted out where they stood, so the grid closes up
       round them as they fade */
    for (const el of leaving) {
      const r = before.get(el)!;
      el.removeAttribute('data-off');
      el.dataset.leaving = '';
      el.style.position = 'absolute';
      el.style.left = `${r.left - box.left}px`;
      el.style.top = `${r.top - box.top}px`;
      el.style.width = `${r.width}px`;
      el.style.height = `${r.height}px`;
      el.style.pointerEvents = 'none';
    }

    const newH = grid!.getBoundingClientRect().height;

    for (const el of leaving) {
      running.push(el.animate([{ opacity: 1, scale: '1' }, { opacity: 0, scale: '0.96' }],
        { duration: LEAVE, easing: 'ease-in', fill: 'forwards' }));
    }
    let n = 0;
    for (const el of items) {
      if (!after.has(el)) continue;
      // whatever it was doing before this change, it starts clean
      el.getAnimations().forEach((a) => a.cancel());
      const was = before.get(el);
      if (was) {
        // stays: from its old place to its new one
        const now = el.getBoundingClientRect();
        const dx = was.left - now.left, dy = was.top - now.top;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          running.push(el.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }],
            { duration: MOVE, easing: glide }));
        }
      } else {
        // arrives: up in its place, a beat after the one before it
        running.push(el.animate([{ opacity: 0, scale: '0.94' }, { opacity: 1, scale: '1' }],
          { duration: ARRIVE, delay: LEAVE * 0.6 + Math.min(n, 6) * STAGGER, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'backwards' }));
        n++;
      }
    }
    if (Math.abs(newH - oldH) > 0.5) {
      running.push(grid!.animate([{ height: `${oldH}px` }, { height: `${newH}px` }],
        { duration: MOVE, easing: glide }));
    }

    // the leaving go back to being simply filtered out once they have faded
    tidy = setTimeout(putAway, LEAVE + 20);
  }

  /** every card lifted out to fade: its fade dropped, its place given back,
   *  and filtered out as it should be */
  function putAway() {
    for (const el of items) {
      if (el.dataset.leaving === undefined) continue;
      delete el.dataset.leaving;
      el.getAnimations().forEach((a) => a.cancel());
      el.style.position = el.style.left = el.style.top = el.style.width = el.style.height = el.style.pointerEvents = '';
      el.setAttribute('data-off', '');
    }
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
      clearTimeout(tidy);
      bar.removeEventListener('click', onClick);
      removeEventListener('popstate', onPop);
    },
  };
}
