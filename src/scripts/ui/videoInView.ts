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

  /* which clips are on screen right now, so a play that had to wait for data
     only starts if its clip is still there */
  const here = new Set<HTMLVideoElement>();

  /** A clip that is asked to play in the same tick as its own load() loses the
   *  race and the play is refused; it gets one more go once there is data. A
   *  refusal after that is the browser's autoplay policy, and the poster is
   *  the whole story. */
  function start(v: HTMLVideoElement) {
    v.play().catch(() => {
      if (v.readyState >= 3) return;
      v.addEventListener('canplay', () => { if (here.has(v)) v.play().catch(() => {}); }, { once: true });
    });
  }

  const onScreen = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target as HTMLVideoElement;
      if (e.isIntersecting) {
        here.add(v);
        for (const other of videos) if (other !== v && !other.paused) other.pause();
        start(v);
      } else {
        here.delete(v);
        if (!v.paused) v.pause();
      }
    }
  }, { threshold: 0.35 });

  videos.forEach((v) => { near.observe(v); onScreen.observe(v); });
  return { destroy() { near.disconnect(); onScreen.disconnect(); } };
}
