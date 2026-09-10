/* ═══════════════════════════════════════════════════════════════════
   Three panels on one screen, and the top one leaves.

   The usual stack has each panel ride up over the one before it. This
   is the other way round: all three are pinned to the top of the screen
   with the first one covering, and scrolling draws it away to unveil
   the one that was underneath all along. Nothing arrives; something is
   removed. It is the same gesture the rest of the site is made of — a
   clip opening — run backwards.

   The panel is taken from its head down, the way a card is drawn up off
   a deck: what survives longest is its foot, and the panel underneath
   arrives name first. Taken the other way round it reads badly — the
   leaving panel's name sits over the arriving panel's foot, so you meet
   a studio's service list before you are told whose it is.

   One value drives it: how far the stack has been scrolled, 0 to 1.
   ═══════════════════════════════════════════════════════════════════ */

export interface StudioStack { destroy(): void }

/** how much of each panel's turn is spent standing still before it goes */
const HOLD = 0.42;

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

  const clear = () => {
    for (const el of panels) el.style.clipPath = '';
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

    /* Each panel but the last has a turn: it stands, then it is taken away
       from its foot up. The turns are laid end to end across the stack's
       whole travel, so the reveals are evenly spaced however many there are. */
    let top = n - 1;
    for (let i = 0; i < n - 1; i++) {
      const local = clamp01(p * (n - 1) - i);
      const leave = clamp01((local - HOLD) / (1 - HOLD));
      panels[i].style.clipPath = leave <= 0 ? 'none' : `inset(${(leave * 100).toFixed(2)}% 0 0 0)`;
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
    }
    let top = n - 1;
    for (let i = 0; i < n - 1; i++) {
      const local = clamp01(at * (n - 1) - i);
      const leave = clamp01((local - HOLD) / (1 - HOLD));
      panels[i].style.clipPath = leave <= 0 ? 'none' : `inset(${(leave * 100).toFixed(2)}% 0 0 0)`;
      if (leave < 1 && top === n - 1) top = i;
    }
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
