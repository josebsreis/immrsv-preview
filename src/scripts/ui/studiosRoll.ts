/* ═══════════════════════════════════════════════════════════════════
   The word THREE, rolled into place: the styles turn each letter's drum;
   this only says when — once, as the screen is half in view — and not
   at all for a reader who asked for less motion, for whom the word
   simply stands.
   ═══════════════════════════════════════════════════════════════════ */

export interface StudiosRoll { destroy(): void }

export function createStudiosRoll(root: HTMLElement): StudiosRoll {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return { destroy() {} };
  root.dataset.live = '';
  const seen = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { root.classList.add('in'); seen.disconnect(); }
  }, { threshold: 0.5 });
  seen.observe(root);
  return { destroy() { seen.disconnect(); delete root.dataset.live; } };
}
