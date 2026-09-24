/* ═══════════════════════════════════════════════════════════════════
   The word THREE, rolled into place. The styles do the turning and the
   landing; this says when.

   The drums start turning as soon as the screen is on its way — a
   screen below the fold — so a reader arrives to a word already
   scrambling. Once the screen is half in view each drum is stopped
   where it happens to be and sent on, forward, to its letter: its
   position mid-turn is read and written back as its own, the turning
   is taken off, and the landing carries on from there. Not at all for a
   reader who asked for less motion, for whom the word simply stands.
   ═══════════════════════════════════════════════════════════════════ */

export interface StudiosRoll { destroy(): void }

export function createStudiosRoll(root: HTMLElement): StudiosRoll {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return { destroy() {} };
  root.dataset.live = '';
  const drums = [...root.querySelectorAll<HTMLElement>('.drum')];

  /* turning: from a screen below */
  const near = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { root.classList.add('spin'); near.disconnect(); }
  }, { rootMargin: '0px 0px 100% 0px' });
  near.observe(root);

  /* landing: once here */
  const here = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    here.disconnect(); near.disconnect();
    root.classList.add('spin');
    for (const d of drums) {
      const at = getComputedStyle(d).transform;
      d.style.animation = 'none';
      d.style.transform = at === 'none' ? '' : at;
    }
    void root.offsetHeight;                     // the position is taken as the start
    root.classList.add('in');
    for (const d of drums) { d.style.animation = ''; d.style.transform = ''; }
  }, { threshold: 0.5 });
  here.observe(root);

  return { destroy() { near.disconnect(); here.disconnect(); delete root.dataset.live; } };
}
