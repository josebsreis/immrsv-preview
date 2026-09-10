/* ═══════════════════════════════════════════════════════════════════
   One thing read at a time: a row of names, and under it whichever one
   is chosen. The markup ships with every panel present and the first one
   shown, so a reader with no JS gets the lot rather than nothing.
   ═══════════════════════════════════════════════════════════════════ */

export interface Tabs { destroy(): void; }

export function createTabs(root: HTMLElement): Tabs {
  const tabs = Array.from(root.querySelectorAll<HTMLElement>('[data-tab]'));
  const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-panel]'));
  const box = root.querySelector<HTMLElement>('[data-panels]');
  if (tabs.length === 0) return { destroy() {} };

  /**
   * Hold the panels open at the height of the longest of them.
   *
   * Only one panel is in the document at a time, so without this the block
   * is as tall as whichever turn is being read, and everything above it —
   * the names, and in a centred column the title too — walks up and down as
   * the reader moves along the row. Each panel is measured by being shown
   * for the length of one read, which is four forced layouts once, not per
   * frame. It has to happen after the face has arrived: the same words in
   * the fallback wrap differently and would leave the box the wrong size.
   */
  function fit() {
    if (!box) return;
    box.style.minHeight = '0px';
    let tallest = 0;
    for (const panel of panels) {
      const away = panel.hidden;
      panel.hidden = false;
      tallest = Math.max(tallest, panel.offsetHeight);
      panel.hidden = away;
    }
    box.style.minHeight = `${tallest}px`;
  }

  function show(key: string) {
    for (const tab of tabs) {
      const on = tab.dataset.tab === key;
      tab.setAttribute('aria-selected', String(on));
      /* only the chosen one is a stop on the way through: the rest are
         reached with the arrow keys, which is how a tab row is walked */
      tab.tabIndex = on ? 0 : -1;
    }
    for (const panel of panels) panel.hidden = panel.dataset.panel !== key;
  }

  const onClick = (e: Event) => {
    const tab = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
    if (tab) show(tab.dataset.tab!);
  };

  /** left and right walk the row and take the focus with them */
  const onKey = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    const i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    const next = tabs[(i + step + tabs.length) % tabs.length];
    e.preventDefault();
    show(next.dataset.tab!);
    next.focus();
  };

  const onResize = () => fit();

  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  addEventListener('resize', onResize);
  show(tabs[0].dataset.tab!);
  fit();
  document.fonts?.ready.then(fit);

  return {
    destroy() {
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKey);
      removeEventListener('resize', onResize);
    },
  };
}
