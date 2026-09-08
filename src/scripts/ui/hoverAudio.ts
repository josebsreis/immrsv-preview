/** Small taps on hover. Decoded once into Web Audio buffers and played from
 *  memory — instant, any number at once — with a little random pitch and level
 *  so nothing repeats exactly. Browsers keep audio locked until a gesture;
 *  the first click or key unlocks it. */
export function createHoverAudio(sources: readonly string[], selector = '[data-tap]'): { destroy(): void } {
  let actx: AudioContext | null = null, bufs: AudioBuffer[] = [], lastIdx = -1, lastAt = 0;

  const init = () => {
    if (actx) return;
    actx = new AudioContext();
    Promise.all(sources.map((u) => fetch(u).then((r) => r.arrayBuffer()).then((ab) => actx!.decodeAudioData(ab))))
      .then((b) => { bufs = b; }).catch(() => {});
  };
  const unlock = () => { init(); if (actx?.state === 'suspended') actx.resume(); };
  const gestures = ['pointerdown', 'keydown', 'touchstart'] as const;
  gestures.forEach((ev) => addEventListener(ev, unlock, { passive: true }));
  init();

  const tap = () => {
    if (!actx || !bufs.length || actx.state !== 'running') return;
    const now = performance.now(); if (now - lastAt < 40) return; lastAt = now;
    let i: number; do { i = Math.floor(Math.random() * bufs.length); } while (i === lastIdx && bufs.length > 1); lastIdx = i;
    const src = actx.createBufferSource(), vol = actx.createGain();
    src.buffer = bufs[i]; src.playbackRate.value = 0.92 + Math.random() * 0.16;
    vol.gain.value = 0.35 + Math.random() * 0.25;
    src.connect(vol).connect(actx.destination); src.start();
  };
  const els = document.querySelectorAll<HTMLElement>(selector);
  els.forEach((el) => el.addEventListener('pointerenter', tap));

  return { destroy() { gestures.forEach((ev) => removeEventListener(ev, unlock)); els.forEach((el) => el.removeEventListener('pointerenter', tap)); actx?.close(); } };
}
