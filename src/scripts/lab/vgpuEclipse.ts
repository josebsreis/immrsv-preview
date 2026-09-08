/* ═══════════════════════════════════════════════════════════════════
   The mark lit from within, in WebGPU by way of vgpu.

   Each of the three faces is rasterised into its own channel of one mask,
   so the shader can tell them apart. Nothing emits light except the faces
   themselves: a face is black, and what escapes is a line at its border
   and a short halo outside it. There is no source in the frame.

   Which face is brightest follows the pointer — the light is behind the
   mark, never in front of it — and breathes on its own when nothing moves.
   ═══════════════════════════════════════════════════════════════════ */
import { init, surface, effect, uniforms, sampler, frameLoop } from 'vgpu';
import { SYMBOL, LETTERMARK } from '@lib/lettermark';

const WGSL = /* wgsl */ `
struct U {
  res: vec2f,        // canvas, in pixels
  light: vec2f,      // where the light sits behind the sheet — never drawn
  markScale: f32,    // half-height of the mark, in aspect units
  markAspect: f32,
  bloom: f32,        // how far the light spreads from a slit
  reach: f32,        // how far the light behind carries
  shaft: f32,        // how strongly the light streams along the ray
  time: f32,
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var mask: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

const TAPS: i32 = 30;
const SHAFT: i32 = 32;
const GOLDEN: f32 = 2.39996;

/** the alpha channel holds the slits: the mark's outlines, cut into the sheet */
fn slit(p: vec2f) -> f32 {
  let half = vec2f(u.markScale * u.markAspect, u.markScale);
  let t = (p / half) * 0.5 + vec2f(0.5);
  if (t.x < 0.0 || t.x > 1.0 || t.y < 0.0 || t.y > 1.0) { return 0.0; }
  return textureSampleLevel(mask, samp, vec2f(t.x, 1.0 - t.y), 0.0).a;
}

fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453); }

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = u.res.x / max(u.res.y, 1.0);
  let p = (uv - vec2f(0.5)) * vec2f(2.0 * aspect, -2.0);

  // what leaks straight through, and what spreads from the slits nearby
  let core = slit(p);
  var glow = 0.0;
  var wsum = 0.0;
  let spin = hash(uv * u.res) * 6.2831;
  for (var i = 0; i < TAPS; i = i + 1) {
    let f = (f32(i) + 0.5) / f32(TAPS);
    let r = u.bloom * sqrt(f);
    let a = f32(i) * GOLDEN + spin;
    let w = (1.0 - f) * (1.0 - f);
    glow = glow + slit(p + vec2f(cos(a), sin(a)) * r) * w;
    wsum = wsum + w;
  }
  glow = glow / max(wsum, 1e-4);

  // the light behind: invisible itself, it only decides which slits are lit
  let d = length(p - u.light);
  let behind = u.reach / (u.reach + d * d);

  // the flare: walk back toward the light, and whatever slit the ray crosses
  // on the way streams its light along it
  let toLight = u.light - p;
  let span = length(toLight);
  let dir = select(vec2f(0.0, 1.0), toLight / max(span, 1e-4), span > 1e-4);
  let jitter = hash(uv * u.res + vec2f(7.13)) ;
  var shaft = 0.0;
  for (var i = 0; i < SHAFT; i = i + 1) {
    let f = (f32(i) + jitter) / f32(SHAFT);
    let s = slit(p + dir * span * f);
    shaft = shaft + s * (1.0 - f) * (1.0 - f);
  }
  shaft = shaft / f32(SHAFT);

  let ink = vec3f(0.92, 0.95, 1.0);
  var col = vec3f(0.012, 0.012, 0.014);
  col = col + ink * core * behind * 1.6;
  col = col + ink * glow * behind * 2.4;
  col = col + vec3f(0.8, 0.85, 1.0) * shaft * u.shaft;

  let grain = (hash(uv * u.res + vec2f(u.time)) - 0.5) * 0.014;
  return vec4f(col + vec3f(grain), 1.0);
}`;

/** The sheet: the mark's outlines cut into the alpha channel as slits. The
 *  fills go into rgb as well, so a future pass can tell the faces apart. */
function rasterise(which: 'symbol' | 'wordmark', height: number, slitPx: number) {
  const art = which === 'symbol' ? SYMBOL : LETTERMARK;
  const aspect = art.box.w / art.box.h;
  const w = Math.round(height * aspect);
  const fit = (g: CanvasRenderingContext2D) =>
    g.setTransform(w / art.box.w, 0, 0, height / art.box.h, (-art.box.x * w) / art.box.w, (-art.box.y * height) / art.box.h);

  const fills = document.createElement('canvas');
  fills.width = w; fills.height = height;
  const fg = fills.getContext('2d', { willReadFrequently: true })!;
  fit(fg);
  ['#f00', '#0f0', '#00f'].forEach((c, i) => { if (art.paths[i]) { fg.fillStyle = c; fg.fill(new Path2D(art.paths[i])); } });

  const lines = document.createElement('canvas');
  lines.width = w; lines.height = height;
  const lg = lines.getContext('2d', { willReadFrequently: true })!;
  fit(lg);
  lg.strokeStyle = '#fff';
  lg.lineWidth = (slitPx * art.box.h) / height;      // the slit's width, in art units
  lg.lineJoin = 'round';
  for (const d of art.paths) lg.stroke(new Path2D(d));

  // merge: rgb from the fills, alpha from the outlines
  const out = fg.getImageData(0, 0, w, height);
  const cut = lg.getImageData(0, 0, w, height).data;
  for (let i = 0; i < out.data.length; i += 4) out.data[i + 3] = cut[i + 3];
  fg.putImageData(out, 0, 0);
  return { canvas: fills, aspect };
}

export interface EclipseOptions { art?: 'symbol' | 'wordmark'; scale?: number; slitPx?: number; }

export async function startEclipse(canvas: HTMLCanvasElement, opts: EclipseOptions = {}) {
  if (!('gpu' in navigator)) throw new Error('WebGPU is not available in this browser');
  const gpu = await init();
  const device = gpu.gpu;

  const scale = opts.scale ?? 0.42;
  const { canvas: art, aspect } = rasterise(opts.art ?? 'symbol', 1024, opts.slitPx ?? 5);
  const tex = device.createTexture({
    size: [art.width, art.height],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture({ source: art }, { texture: tex }, [art.width, art.height]);

  const view = surface(gpu, canvas);
  const u = uniforms(gpu, {
    res: [canvas.width, canvas.height],
    light: [0, 0],
    markScale: scale,
    markAspect: aspect,
    bloom: 0.09,
    reach: 0.32,
    shaft: 2.2,
    time: 0,
  });
  const samp = sampler(gpu, { magFilter: 'linear', minFilter: 'linear' });
  const pass = effect(gpu, WGSL).set({ u, mask: tex.createView(), samp });

  // the light sits behind the sheet: the pointer moves it, it is never drawn
  const behind = { x: 0, y: 0, tx: 0, ty: 0, held: false };
  addEventListener('pointermove', (e) => {
    const a = innerWidth / innerHeight;
    behind.tx = (e.clientX / innerWidth - 0.5) * 2 * a;
    behind.ty = (0.5 - e.clientY / innerHeight) * 2;
    behind.held = true;
  }, { passive: true });

  const t0 = performance.now();
  const loop = frameLoop(gpu, () => {
    const t = (performance.now() - t0) / 1000;
    // it breathes around the mark until the pointer takes it over
    if (!behind.held) { behind.tx = Math.sin(t * 0.29) * 0.34; behind.ty = Math.cos(t * 0.21) * 0.26; }
    behind.x += (behind.tx - behind.x) * 0.045;
    behind.y += (behind.ty - behind.y) * 0.045;
    u.set({ res: [canvas.width, canvas.height], light: [behind.x, behind.y], time: t });
    pass.draw(view);
  });

  return { stop: () => loop.stop() };
}
