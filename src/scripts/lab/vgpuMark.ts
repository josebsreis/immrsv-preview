/* ═══════════════════════════════════════════════════════════════════
   The mark in WebGPU, by way of vgpu (Vercel Labs). A single fullscreen
   fragment shader raymarches the three L plates as signed distance
   fields and lights their edges, so there is no geometry, no particles
   and no scene graph — one pass, one shader.

   This is a lab page: nothing else on the site imports it.
   ═══════════════════════════════════════════════════════════════════ */
import { init, surface, effect, uniforms, frameLoop } from 'vgpu';

const WGSL = /* wgsl */ `
struct U {
  res: vec2f,
  mouse: vec2f,
  time: f32,
  edge: f32,
  _pad: vec2f,
};
@group(0) @binding(0) var<uniform> u: U;

const SEP: f32 = 0.175;          // the gap between the plates
const THICK: f32 = 0.05;         // how deep a plate is
const NOTCH: f32 = 0.6667;       // where the L is cut

fn sdBox(p: vec3f, b: vec3f) -> f32 {
  let q = abs(p) - b;
  return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

/* one L plate: q.xy runs 0..1 across the face, q.z is depth into the cube */
fn sdL(q: vec3f) -> f32 {
  let d = q.z + THICK;
  let a = sdBox(vec3f(q.x - 0.5, q.y - NOTCH * 0.5, d), vec3f(0.5, NOTCH * 0.5, THICK));
  let b = sdBox(vec3f(q.x - NOTCH * 0.5, q.y - 0.5, d), vec3f(NOTCH * 0.5, 0.5, THICK));
  return min(a, b);
}

/* the three faces of the cube, each pushed out along its own normal */
fn map(p: vec3f) -> f32 {
  let o = 0.5 + SEP;
  let top   = sdL(vec3f(p.x + 0.5, p.z + 0.5, o - p.y));
  let front = sdL(vec3f(p.x + 0.5, p.y + 0.5, o - p.z));
  let right = sdL(vec3f(p.z + 0.5, p.y + 0.5, o - p.x));
  return min(top, min(front, right));
}

fn normalAt(p: vec3f) -> vec3f {
  let e = vec2f(0.0015, 0.0);
  return normalize(vec3f(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)));
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = u.res.x / max(u.res.y, 1.0);
  let p = (uv - vec2f(0.5)) * vec2f(2.0 * aspect, -2.0);

  // an orbit about the cube's own diagonal, with a little parallax from the pointer
  let m = (u.mouse - vec2f(0.5)) * 0.6;
  let yaw = u.time * 0.22 + 0.7 + m.x;
  let pitch = 0.62 + m.y * 0.5;
  let dist = 3.6;
  let ro = vec3f(dist * cos(pitch) * sin(yaw), dist * sin(pitch), dist * cos(pitch) * cos(yaw));
  let fw = normalize(-ro);
  let rt = normalize(cross(vec3f(0.0, 1.0, 0.0), fw));
  let up = cross(fw, rt);
  let rd = normalize(fw * 2.1 + rt * p.x + up * p.y);

  // march, keeping the closest approach so the edges can bleed light
  var d = 0.35;
  var hit = -1.0;
  var glow = 0.0;
  for (var i = 0; i < 110; i = i + 1) {
    let pos = ro + rd * d;
    let s = map(pos);
    let step = max(s * 0.9, 0.0015);
    // integrate the glow over distance, not over steps — a per-step sum bands
    // wherever the marcher takes different numbers of steps
    glow = glow + step * 0.6 / (0.02 + s * s * 30.0);
    if (s < 0.0015) { hit = d; break; }
    d = d + step;
    if (d > 9.0) { break; }
  }

  var col = vec3f(0.024, 0.024, 0.026);          // the site's ground

  if (hit > 0.0) {
    let pos = ro + rd * hit;
    let n = normalAt(pos);
    let v = -rd;
    let fres = pow(1.0 - max(dot(n, v), 0.0), 3.5);
    let key = max(dot(n, normalize(vec3f(0.55, 0.9, 0.4))), 0.0);
    let fill = max(dot(n, normalize(vec3f(-0.7, 0.2, -0.5))), 0.0);
    // a near-black slab: the edge carries the light, the face barely reads
    col = vec3f(0.035) + vec3f(0.11) * key * 0.5 + vec3f(0.05) * fill + vec3f(1.0) * fres * u.edge;
  }

  col = col + vec3f(0.86, 0.89, 0.96) * glow * 0.05;
  // a static dither, so the falloff never bands
  let dither = fract(sin(dot(uv * u.res, vec2f(12.9898, 78.233))) * 43758.5453) - 0.5;
  col = col + vec3f(dither * 0.006);
  return vec4f(col, 1.0);
}`;

export async function startVgpuMark(canvas: HTMLCanvasElement) {
  if (!('gpu' in navigator)) throw new Error('WebGPU is not available in this browser');

  const gpu = await init();
  const view = surface(gpu, canvas);
  const u = uniforms(gpu, {
    res: [canvas.width, canvas.height],
    mouse: [0.5, 0.5],
    time: 0,
    edge: 0.55,
    _pad: [0, 0],
  });
  const mark = effect(gpu, WGSL).set({ u });

  const pointer = { x: 0.5, y: 0.5 };
  addEventListener('pointermove', (e) => {
    pointer.x = e.clientX / innerWidth;
    pointer.y = e.clientY / innerHeight;
  }, { passive: true });

  const t0 = performance.now();
  const loop = frameLoop(gpu, () => {
    u.set({
      res: [canvas.width, canvas.height],
      mouse: [pointer.x, pointer.y],
      time: (performance.now() - t0) / 1000,
    });
    mark.draw(view);
  });

  return { stop: () => loop.stop(), gpu };
}
