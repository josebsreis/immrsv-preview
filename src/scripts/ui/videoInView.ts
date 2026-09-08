/* ═══════════════════════════════════════════════════════════════════
   Silent loops that only run while they are on screen. Nothing downloads
   until a clip is close to view, only one plays at a time, and a reader
   who asked for less motion gets the poster frame and nothing else.
   ═══════════════════════════════════════════════════════════════════ */

export interface VideoInView { destroy(): void; }

export function createVideoInView(root: ParentNode = document): VideoInView {
  const videos = Array.from(root.querySelectorAll<HTMLVideoElement>('video[data-in-view]'));
  if (videos.length === 0) return { destroy() {} };

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) return { destroy() {} };                 // the poster is the whole story

  // load a clip a screen before it is needed, then play only when it is really there
  const near = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target as HTMLVideoElement;
      if (e.isIntersecting && v.preload !== 'auto') { v.preload = 'auto'; v.load(); }
    }
  }, { rootMargin: '100% 0px' });

  const onScreen = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target as HTMLVideoElement;
      if (e.isIntersecting) {
        for (const other of videos) if (other !== v && !other.paused) other.pause();
        v.play().catch(() => {});                     // a refused autoplay just leaves the poster
      } else if (!v.paused) v.pause();
    }
  }, { threshold: 0.35 });

  videos.forEach((v) => { near.observe(v); onScreen.observe(v); });
  return { destroy() { near.disconnect(); onScreen.disconnect(); } };
}
