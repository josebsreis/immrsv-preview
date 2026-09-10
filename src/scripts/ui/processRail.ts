/* ═══════════════════════════════════════════════════════════════════
   How we work, read one step at a time.

   Two readings of the same idea, because the rule can only measure the
   direction the steps run in:

   Across (860 and up) the section holds still while a screen or so of
   scroll passes through it — a sticky pane inside a tall track — and that
   travel draws the rule from left to right under three columns.

   Down (below that) nothing is pinned; there is no room on a phone to hold
   a screen still. The rule stands on the left of the stacked steps and
   grows as the page is scrolled, reaching each square as its step arrives.

   Either way one number does everything: the line's length and each step's
   arrival are the same value read twice, so they cannot drift apart.
   ═══════════════════════════════════════════════════════════════════ */

export interface ProcessRail { update(): void; destroy(): void; }

/** across: how much of a step's own stretch is spent bringing it in, rather
 *  than waiting — below 1 a step is fully here before the next starts */
const INK = 0.55;

/** across: how much of the travel the rule takes to cross. The rest is the
 *  section holding still, finished, before it lets go — without it the last
 *  square arrives on the very last pixel of the pin and is gone unseen. */
const CROSS = 0.86;

/** down: where on the screen a step counts as read — 0.72 of the way down,
 *  so it arrives while it is being looked at rather than at the very edge */
const LINE = 0.72;

/** down: over how much of a screen a step comes in */
const RISE = 0.12;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function createProcessRail(root: HTMLElement): ProcessRail {
  const found = {
    track: root.querySelector<HTMLElement>('[data-process-track]'),
    rail: root.querySelector<HTMLElement>('[data-process-rail]'),
    fill: root.querySelector<HTMLElement>('[data-process-fill]'),
  };
  const steps = Array.from(root.querySelectorAll<HTMLElement>('[data-process-step]'));
  const marks = Array.from(root.querySelectorAll<HTMLElement>('[data-process-mark]'));
  if (!found.track || !found.rail || !found.fill || steps.length === 0) {
    return { update() {}, destroy() {} };
  }
  const { track, rail, fill } = found as Record<'track' | 'rail' | 'fill', HTMLElement>;

  /* A reader who asked for less motion gets the section as a plain page:
     everything here, the rule drawn, nothing pinned (see the stylesheet). */
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* the same breakpoint as tokens.css and the component's own media query */
  const across = matchMedia('(min-width: 860px)');

  /** where each square sits along the rule, as a fraction of its length.
   *  Across, the steps are even columns and CSS already knows. Down, they
   *  are whatever height their words came to, so the squares are put against
   *  the steps' real tops and measured again whenever the layout can change. */
  let placed = false;
  function place() {
    if (across.matches) {
      if (placed) marks.forEach((mark) => { mark.style.removeProperty('top'); });
      placed = false;
      return;
    }
    const top = rail.getBoundingClientRect().top;
    steps.forEach((step, i) => {
      const mark = marks[i];
      if (mark) mark.style.top = `${step.getBoundingClientRect().top - top}px`;
    });
    const last = marks[steps.length];
    if (last) last.style.top = '100%';
    placed = true;
  }

  function update() {
    if (still) return;
    place();

    if (across.matches) {
      const box = track.getBoundingClientRect();
      /* how far through the track's own travel we are: 0 when its top meets
         the top of the screen, 1 when its bottom meets the bottom */
      const travel = box.height - innerHeight;
      const p = travel > 0 ? clamp01(-box.top / travel / CROSS) : 0;
      fill.style.transform = `scaleX(${p})`;
      /* each step owns an equal stretch of that travel, and the squares are
         evenly spaced across it, so both can be read straight off p */
      steps.forEach((step, i) => set(step, clamp01((p * steps.length - i) / INK)));
      marks.forEach((mark, i) => on(mark, p >= i / steps.length - 0.001));
      return;
    }

    /* Down the page: the rule reaches from its own top to the reading line,
       and a step arrives as that line passes it — so the square and the words
       beside it happen together however tall the step turned out to be. */
    const box = rail.getBoundingClientRect();
    const line = innerHeight * LINE;
    const reached = clamp01((line - box.top) / box.height);
    fill.style.transform = `scaleY(${reached})`;
    steps.forEach((step, i) => {
      set(step, clamp01((line - step.getBoundingClientRect().top) / (innerHeight * RISE)));
      const mark = marks[i];
      if (mark) on(mark, line >= step.getBoundingClientRect().top);
    });
    const last = marks[steps.length];
    if (last) on(last, reached >= 0.999);
  }

  /** a step, as far in as it has come */
  function set(step: HTMLElement, at: number) {
    step.style.setProperty('--lit', String(at));
    step.toggleAttribute('data-on', at > 0.5);
  }

  const on = (mark: HTMLElement, yes: boolean) => mark.toggleAttribute('data-on', yes);

  const onScroll = () => update();
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  update();

  return {
    update,
    destroy() {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
    },
  };
}
