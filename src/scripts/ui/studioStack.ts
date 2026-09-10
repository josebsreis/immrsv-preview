/* ═══════════════════════════════════════════════════════════════════
   Three panels on one screen, and the top one leaves.

   The usual stack has each panel ride up over the one before it. This
   is the other way round: all three are pinned to the top of the screen
   with the first one covering, and scrolling lifts it — the whole panel,
   as one piece — up and off the top of the screen, so the one that was
   underneath all along is simply there. Nothing arrives; something is
   taken away, like the top card off a deck.

   Each panel arrives by ordinary scrolling, sits whole for a moment
   once it has hit the top, and then goes. It moves as a unit rather
   than being masked: a mask leaves half of one panel over half of the
   next, and the page reads as two studios at once.

   One value drives it: how far the stack has been scrolled, 0 to 1.
   ═══════════════════════════════════════════════════════════════════ */

export interface StudioStack { destroy(): void }

/** how much of each panel's turn is spent standing whole, once it has hit
 *  the top of the screen, before it is lifted away */
const HOLD = 0.2;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function createStudioStack(root: HTMLElement): StudioStack {
  const panels = [...root.querySelectorAll<HTMLElement>('[data-studio-panel]')];
  const n = panels.length;
  if (n < 2) return { destroy() {} };

  /* Stacking is a desktop idea. On a phone a panel is not a screen with a
     void in it — the void is just a blank screen — so the panels run at
     their own height in the flow and nothing here applies. */
  const wide = matchMedia('(min-width: 860px)');
  const still = matchMedia('(prefers-reduced-motion: reduce)');

  let on = false;
  let last = -1, current = -1;

  /* A panel that is pinned behind another never scrolls into view, so the
     watcher that lifts everything else into place never sees it arrive and
     its content stays at nothing. It is unfolded from here instead, the
     moment the panel above it starts to lift — so it is settling as it is
     exposed, not after. Once each; the class is the same one the watcher
     would have given it. */
  const unfolded = new Set<HTMLElement>();
  const unfold = (panel: HTMLElement) => {
    if (unfolded.has(panel)) return;
    unfolded.add(panel);
    panel.querySelectorAll<HTMLElement>('[data-rise]').forEach((el) => el.classList.add('in'));
  };

  const clear = () => {
    for (const el of panels) el.style.transform = '';
    root.removeAttribute('data-live');
    root.removeAttribute('data-theme');
  };

  const update = () => {
    if (!on) return;
    const r = root.getBoundingClientRect();
    const range = r.height - innerHeight;
    if (range <= 0) return;
    const p = clamp01(-r.top / range);
    if (p === last) return;
    last = p;

    /* Each panel but the last has a turn: it stands, then it is lifted off
       the top of the screen, whole. The turns are laid end to end across the
       stack's travel, so the handovers are evenly spaced however many there
       are. The last panel never goes — the page scrolls on past it. */
    let top = n - 1;
    for (let i = 0; i < n - 1; i++) {
      const local = clamp01(p * (n - 1) - i);
      const leave = clamp01((local - HOLD) / (1 - HOLD));
      panels[i].style.transform = leave <= 0 ? '' : `translateY(${(-leave * 100).toFixed(2)}%)`;
      if (leave > 0) unfold(panels[i + 1]);
      if (leave < 1 && top === n - 1) top = i;
    }
    // whichever is showing tells the nav what it is standing on: all three
    // cover the nav's probe at once, so none of them can answer for itself
    if (top !== current) {
      current = top;
      const ground = panels[top].dataset.panel ?? 'light';
      if (root.dataset.theme !== ground) root.dataset.theme = ground;
    }
  };

  const sync = () => {
    const want = wide.matches && !still.matches;
    if (want === on) return;
    on = want;
    last = -1; current = -1;
    if (on) { root.dataset.live = ''; update(); } else clear();
  };

  /* One settle a frame. A hidden document is painted no frames, so a request
     made while it was visible never arrives — and a pending request that can
     never arrive would hold the flag down and swallow every scroll after it.
     So the flag is released the moment the page goes away, and the settle is
     taken on the spot instead. */
  let raf = 0;
  const run = () => { raf = 0; update(); };
  const schedule = () => {
    if (raf) return;
    if (document.visibilityState !== 'visible') { update(); return; }
    raf = requestAnimationFrame(run);
  };
  const onHide = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; update(); } };
  document.addEventListener('visibilitychange', onHide);
  const onResize = () => { last = -1; sync(); update(); };

  /* Dev only, and stripped from a build: `?s=0.5` pins the panels to the
     screen and holds the stack at that point of its travel, so a still of any
     moment can be taken without scrolling to it. */
  const pin = (at: number) => {
    on = true;
    root.dataset.live = '';
    for (const el of panels) {
      el.style.position = 'fixed';
      el.style.inset = '0';
      el.style.height = '100vh';
      // the stack pulls each panel back over the last; a fixed box with a
      // top of 0 still honours that margin, and would sit a screen too high
      el.style.marginTop = '0';
    }
    let top = n - 1;
    for (let i = 0; i < n - 1; i++) {
      const local = clamp01(at * (n - 1) - i);
      const leave = clamp01((local - HOLD) / (1 - HOLD));
      panels[i].style.transform = leave <= 0 ? '' : `translateY(${(-leave * 100).toFixed(2)}%)`;
      if (leave > 0) unfold(panels[i + 1]);
      if (leave < 1 && top === n - 1) top = i;
    }
    unfold(panels[0]);
    root.dataset.theme = panels[top].dataset.panel ?? 'light';
  };
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search);
    if (q.has('s')) {
      const at = clamp01(Number(q.get('s')));
      setTimeout(() => pin(at), 400);
      setTimeout(() => pin(at), 1400);
      return { destroy() {} };
    }
  }

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', onResize);
  wide.addEventListener('change', onResize);
  still.addEventListener('change', onResize);
  sync();

  return {
    destroy() {
      cancelAnimationFrame(raf);
      removeEventListener('scroll', schedule);
      removeEventListener('resize', onResize);
      wide.removeEventListener('change', onResize);
      still.removeEventListener('change', onResize);
      document.removeEventListener('visibilitychange', onHide);
      clear();
    },
  };
}
