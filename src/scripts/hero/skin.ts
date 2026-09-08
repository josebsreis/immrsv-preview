/* ═══════════════════════════════════════════════════════════════════
   An animated cloud: the points of a rigged model, and the bones that
   move them.

   Baking a position per point per frame is the obvious way and much too
   heavy — one frame is a whole cloud, so a second of motion runs into a
   megabyte. What is baked instead is what the animation actually is: a
   few dozen small matrices a frame. The skinning itself is four
   multiply-adds per point, which is less than the physics already does.

   See scripts/bakeSkinned.py for the other half.
   ═══════════════════════════════════════════════════════════════════ */

export interface Skin {
  readonly count: number;
  /** the current frame's positions, count × 3, in the mark's own space */
  readonly pose: Float32Array;
  /** the rest positions, for deciding which particle takes which point */
  readonly bind: Float32Array;
  /** pose the cloud at `t` seconds, looping */
  update(t: number): void;
}

const skins = new Map<string, Skin | null>();

/** whatever has been fetched for this source, or null */
export const skinFor = (src: string): Skin | null => skins.get(src) ?? null;

export async function loadSkin(src: string): Promise<Skin | null> {
  const held = skins.get(src);
  if (held !== undefined) return held;
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error(String(res.status));
    const buf = await res.arrayBuffer();
    skins.set(src, parse(buf));
  } catch {
    skins.set(src, null);
  }
  return skins.get(src) ?? null;
}

function parse(buf: ArrayBuffer): Skin {
  const dv = new DataView(buf);
  if (dv.getUint32(0, false) !== 0x494d534b) throw new Error('not a skin');  // 'IMSK'
  const count = dv.getUint32(4, true), bones = dv.getUint32(8, true), frames = dv.getUint32(12, true);
  const bindScale = dv.getFloat32(16, true), fps = dv.getFloat32(20, true);
  let o = 24;
  const q = new Int16Array(buf.slice(o, o + count * 6)); o += count * 6;
  const index = new Uint8Array(buf, o, count * 4); o += count * 4;
  const weight = new Uint8Array(buf, o, count * 4); o += count * 4;
  const mats = new Float32Array(buf.slice(o, o + frames * bones * 48));

  const bind = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) bind[i] = (q[i] / 32767) * bindScale;

  const pose = new Float32Array(count * 3);
  const M = new Float32Array(bones * 12);          // this instant's bones

  return {
    count, pose, bind,
    update(t: number) {
      // the two keys either side of now, and the blend between them. Bones a
      // sixth of a second apart barely turn, so blending the matrices term by
      // term is indistinguishable from doing it properly.
      const f = t * fps;
      const k = Math.floor(f), a = f - k;
      const f0 = ((k % frames) + frames) % frames, f1 = (f0 + 1) % frames;
      const o0 = f0 * bones * 12, o1 = f1 * bones * 12;
      for (let i = 0, n = bones * 12; i < n; i++) M[i] = mats[o0 + i] + (mats[o1 + i] - mats[o0 + i]) * a;

      for (let p = 0; p < count; p++) {
        const p3 = p * 3, p4 = p * 4;
        const x = bind[p3], y = bind[p3 + 1], z = bind[p3 + 2];
        let ox = 0, oy = 0, oz = 0;
        for (let b = 0; b < 4; b++) {
          const w = weight[p4 + b];
          if (w === 0) continue;
          const m = index[p4 + b] * 12, s = w / 255;
          ox += s * (M[m] * x + M[m + 1] * y + M[m + 2] * z + M[m + 3]);
          oy += s * (M[m + 4] * x + M[m + 5] * y + M[m + 6] * z + M[m + 7]);
          oz += s * (M[m + 8] * x + M[m + 9] * y + M[m + 10] * z + M[m + 11]);
        }
        pose[p3] = ox; pose[p3 + 1] = oy; pose[p3 + 2] = oz;
      }
    },
  };
}
