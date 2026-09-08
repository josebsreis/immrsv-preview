/* ═══════════════════════════════════════════════════════════════════
   The mark eclipsing a light source, in WebGPU by way of vgpu.

   The mark is rasterised once into a mask texture. Every pixel then walks
   toward the light, sampling that mask: what it crosses is what shadows
   it, so the light spills around the silhouette and through the gaps
   between the three faces. The mark itself stays pure black, with a rim
   where its edge faces the light.

   The light drifts on its own and hands over to the pointer when it moves.
   ═══════════════════════════════════════════════════════════════════ */
import { init, surface, effect, uniforms, sampler, frameLoop } from 'vgpu';
import { SYMBOL, LETTERMARK } from '@lib/lettermark';

const WGSL = /* wgsl */ `
struct U {
  res: vec2f,      // canvas, in pixels
  light: vec2f,    // light position, in aspect-corrected units
  markScale: f32,  // half-height of the mark, same units
  markAspect: f32, // its width over its height
  time: f32,
  reach: f32,      // how far the glow carries
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var mask: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

const STEPS: i32 = 26;

/** 1 inside the mark, 0 outside */
fn solid(p: vec2f) -> f32 {
  let half = vec2f(u.markScale * u.markAspect, u.markScale);
  let t = (p / half) * 0.5 + vec2f(0.5);
  if (t.x < 0.0 || t.x > 1.0 || t.y < 0.0 || t.y > 1.0) { return 0.0; }
  return textureSampleLevel(mask, samp, vec2f(t.x, 1.0 - t.y), 0.0).r;
}

fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453); }

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = u.res.x / max(u.res.y, 1.0);
  let p = (uv - vec2f(0.5)) * vec2f(2.0 * aspect, -2.0);

  let toLight = u.light - p;
  let dist = length(toLight);
  let dir = select(vec2f(0.0, 1.0), toLight / max(dist, 1e-4), dist > 1e-4);

  // Walk toward the light, but only as far as the eclipse needs: near
  // occluders count for most of the shadow and far ones for almost none, so
  // the silhouette throws a halo that hugs it rather than a wedge across the
  // whole frame.
  let walk = min(dist, u.reach * 3.2);
  let jitter = hash(uv * u.res) * 0.9;
  var shade = 0.0;
  var haze = 0.0;
  for (var i = 0; i < STEPS; i = i + 1) {
    let f = (f32(i) + jitter) / f32(STEPS);
    let s = solid(p + dir * walk * f);
    let near = 1.0 - f;                       // what is close to us shadows us
    shade = shade + s * near * near;
    haze = haze + (1.0 - s) * near * 0.05;
  }
  let open = exp(-shade * (9.0 / f32(STEPS)));

  // the source: broad, not a point, and its air lit around it
  let core = u.reach / (u.reach + dist * dist * 5.2);
  let hot = pow(u.reach / (u.reach + dist * dist * 34.0), 1.7);
  var col = vec3f(0.018, 0.018, 0.02);
  col = col + vec3f(0.86, 0.89, 0.98) * core * open * 0.85;
  col = col + vec3f(1.0) * hot * open * 0.7;
  col = col + vec3f(0.7, 0.74, 0.9) * haze * open * 0.28;

  // the mark: black, with a rim wherever its edge faces the light
  let here = solid(p);
  if (here > 0.5) {
    let e = 0.006;
    let gx = solid(p + vec2f(e, 0.0)) - solid(p - vec2f(e, 0.0));
    let gy = solid(p + vec2f(0.0, e)) - solid(p - vec2f(0.0, e));
    let edge = clamp(length(vec2f(gx, gy)) * 1.6, 0.0, 1.0);
    let facing = clamp(dot(normalize(vec2f(gx, gy) + vec2f(1e-5)), -dir), 0.0, 1.0);
    col = vec3f(0.012) + vec3f(1.0, 1.0, 1.0) * edge * facing * 0.55 * core;
  }

  // grain, then a vignette so the frame closes down
  let grain = (hash(uv * u.res + vec2f(u.time)) - 0.5) * 0.02;
  let vig = 1.0 - 0.06 * dot(p, p);
  return vec4f((col + vec3f(grain)) * vig, 1.0);
}`;

/** the mark, rasterised once into a mask */
function rasterise(which: 'symbol' | 'wordmark', height: number) {
  const art = which === 'symbol' ? SYMBOL : LETTERMARK;
  const aspect = art.box.w / art.box.h;
  const w = Math.round(height * aspect);
  const c = document.createElement('canvas');
  c.width = w; c.height = height;
  const g = c.getContext('2d')!;
  g.setTransform(w / art.box.w, 0, 0, height / art.box.h, (-art.box.x * w) / art.box.w, (-art.box.y * height) / art.box.h);
  g.fillStyle = '#fff';
  for (const d of art.paths) g.fill(new Path2D(d));
  return { canvas: c, aspect };
}

export interface EclipseOptions { art?: 'symbol' | 'wordmark'; scale?: number; }

export async function startEclipse(canvas: HTMLCanvasElement, opts: EclipseOptions = {}) {
  if (!('gpu' in navigator)) throw new Error('WebGPU is not available in this browser');
  const gpu = await init();
  const device = gpu.gpu;

  const { canvas: art, aspect } = rasterise(opts.art ?? 'symbol', 1024);
  const tex = device.createTexture({
    size: [art.width, art.height],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture({ source: art }, { texture: tex }, [art.width, art.height]);

  const view = surface(gpu, canvas);
  const u = uniforms(gpu, {
    res: [canvas.width, canvas.height],
    light: [0, 0.35],
    markScale: opts.scale ?? 0.42,
    markAspect: aspect,
    time: 0,
    reach: 0.26,
  });
  const samp = sampler(gpu, { magFilter: 'linear', minFilter: 'linear' });
  const pass = effect(gpu, WGSL).set({ u, mask: tex.createView(), samp });

  // the light drifts on its own until the pointer takes it over
  const light = { x: 0, y: 0.35, tx: 0, ty: 0.35, held: false };
  addEventListener('pointermove', (e) => {
    const aspectNow = innerWidth / innerHeight;
    light.tx = (e.clientX / innerWidth - 0.5) * 2 * aspectNow;
    light.ty = (0.5 - e.clientY / innerHeight) * 2;
    light.held = true;
  }, { passive: true });

  const t0 = performance.now();
  const loop = frameLoop(gpu, () => {
    const t = (performance.now() - t0) / 1000;
    if (!light.held) { light.tx = Math.sin(t * 0.31) * 0.55; light.ty = 0.3 + Math.cos(t * 0.23) * 0.22; }
    light.x += (light.tx - light.x) * 0.06;
    light.y += (light.ty - light.y) * 0.06;
    u.set({ res: [canvas.width, canvas.height], light: [light.x, light.y], time: t });
    pass.draw(view);
  });

  return { stop: () => loop.stop() };
}
