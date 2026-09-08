/* ═══════════════════════════════════════════════════════════════════
   The mark as glass, in WebGPU by way of vgpu.

   The page is black, so there is nothing behind the mark to refract —
   which is exactly how a black object is photographed: the room is dark
   and a few bright strips do all the work. This shader lights it that
   way. The three plates are raymarched as slabs; each hit reflects and
   refracts a small studio environment of soft strips, and the two are
   mixed by Fresnel, so the mark reads as glass by its edges and its
   highlights rather than by what is behind it.
   ═══════════════════════════════════════════════════════════════════ */
import { init, surface, effect, uniforms, frameLoop } from 'vgpu';

const WGSL = /* wgsl */ `
struct U {
  res: vec2f,
  mouse: vec2f,
  time: f32,
  spin: f32,       // the turn about the cube's diagonal
  ior: f32,        // how hard the glass bends light
  mirror: f32,     // how much of the room the surface returns
  _pad: f32,
};
@group(0) @binding(0) var<uniform> u: U;

const SEP: f32 = 0.175;
const THICK: f32 = 0.055;
const NOTCH: f32 = 0.6667;

fn sdBox(p: vec3f, b: vec3f) -> f32 {
  let q = abs(p) - b;
  return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

/* one L plate: q.xy across the face, q.z into the cube */
fn sdL(q: vec3f) -> f32 {
  let d = q.z + THICK;
  let a = sdBox(vec3f(q.x - 0.5, q.y - NOTCH * 0.5, d), vec3f(0.5, NOTCH * 0.5, THICK));
  let b = sdBox(vec3f(q.x - NOTCH * 0.5, q.y - 0.5, d), vec3f(NOTCH * 0.5, 0.5, THICK));
  return min(a, b);
}

/* the cube's diagonal: the mark has three-fold symmetry about it, so turning
   on this axis is the tumble the particle version does — never a flat spin */
const DIAG: vec3f = vec3f(0.57735, 0.57735, 0.57735);

fn rotAxis(p: vec3f, axis: vec3f, a: f32) -> vec3f {
  let c = cos(a); let s = sin(a);
  return p * c + cross(axis, p) * s + axis * dot(axis, p) * (1.0 - c);
}

fn map(world: vec3f) -> f32 {
  let p = rotAxis(world, DIAG, -u.spin);
  let o = 0.5 + SEP;
  return min(sdL(vec3f(p.x + 0.5, p.z + 0.5, o - p.y)),
         min(sdL(vec3f(p.x + 0.5, p.y + 0.5, o - p.z)),
             sdL(vec3f(p.z + 0.5, p.y + 0.5, o - p.x))));
}

fn normalAt(p: vec3f) -> vec3f {
  let e = vec2f(0.0012, 0.0);
  return normalize(vec3f(map(p + e.xyy) - map(p - e.xyy),
                         map(p + e.yxy) - map(p - e.yxy),
                         map(p + e.yyx) - map(p - e.yyx)));
}

/* The room, for what the surface mirrors: black, with a few soft strips — the
   softboxes of a dark studio. Kept dim, so reflection never takes the object
   over; it is the transmission that should carry it. */
fn studio(d: vec3f) -> vec3f {
  let n = normalize(d);
  var l = 0.0;
  l = l + smoothstep(0.90, 0.998, dot(n, normalize(vec3f(-0.32, 0.92, -0.22)))) * 3.4;
  l = l + smoothstep(0.94, 0.999, dot(n, normalize(vec3f(0.96, 0.1, 0.26)))) * 2.4;
  l = l + smoothstep(0.92, 0.997, dot(n, normalize(vec3f(-0.75, 0.25, 0.62)))) * 1.4;
  l = l + max(0.0, n.y) * 0.06;
  return vec3f(0.95, 0.97, 1.0) * l;
}

/* What is behind the glass — and only there. The page is black, so a hidden
   field is drawn for the refracted ray alone: a lattice of thin lines with a
   drift through it. You never see it directly; you see it bent, which is what
   makes the mark read as something you look through rather than at. */
fn hidden(d: vec3f, t: f32) -> vec3f {
  let n = normalize(d);
  // a lattice, in the ray's own direction
  let a = atan2(n.z, n.x) * 3.0 + t * 0.15;
  let b = asin(clamp(n.y, -1.0, 1.0)) * 5.0 - t * 0.1;
  let lines = pow(abs(sin(a)), 34.0) + pow(abs(sin(b)), 34.0);
  // a few soft lights adrift in it
  var blobs = 0.0;
  blobs = blobs + pow(max(0.0, dot(n, normalize(vec3f(sin(t * 0.21), 0.35, cos(t * 0.21))))), 140.0) * 3.0;
  blobs = blobs + pow(max(0.0, dot(n, normalize(vec3f(cos(t * 0.13), -0.5, sin(t * 0.17))))), 90.0) * 1.6;
  let depth = 0.16 + 0.34 * max(0.0, n.y);
  return vec3f(0.86, 0.91, 1.0) * (lines * 1.35 + blobs * 1.4) + vec3f(0.34, 0.38, 0.5) * depth;
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = u.res.x / max(u.res.y, 1.0);
  let p = (uv - vec2f(0.5)) * vec2f(2.0 * aspect, -2.0);

  let m = (u.mouse - vec2f(0.5)) * 0.5;
  let yaw = 0.785 + m.x * 0.5;      // an isometric three-quarter, swaying a little
  let pitch = 0.615 + m.y * 0.35;
  let dist = 3.5;
  let ro = vec3f(dist * cos(pitch) * sin(yaw), dist * sin(pitch), dist * cos(pitch) * cos(yaw));
  let fw = normalize(-ro);
  let rt = normalize(cross(vec3f(0.0, 1.0, 0.0), fw));
  let up = cross(fw, rt);
  let rd = normalize(fw * 2.15 + rt * p.x + up * p.y);

  var d = 0.3;
  var hit = -1.0;
  for (var i = 0; i < 96; i = i + 1) {
    let s = map(ro + rd * d);
    if (s < 0.0012) { hit = d; break; }
    d = d + s * 0.9;
    if (d > 9.0) { break; }
  }

  var col = vec3f(0.014, 0.014, 0.016);          // the page's own ground

  if (hit > 0.0) {
    let pos = ro + rd * hit;
    let n = normalAt(pos);
    let v = -rd;
    let cosi = clamp(dot(n, v), 0.0, 1.0);
    // Fresnel, held back: only the grazing edge turns to mirror, the rest is glass
    let f = (0.03 + 0.97 * pow(1.0 - cosi, 5.0)) * u.mirror;

    // what the surface mirrors
    let refl = studio(reflect(rd, n));

    // and what it lets through: bend in, cross the slab, bend out — each
    // channel bending a little differently, which is the tell for glass
    var thru = vec3f(0.0);
    let iors = vec3f(u.ior - 0.055, u.ior, u.ior + 0.055);
    for (var c = 0; c < 3; c = c + 1) {
      let ior = iors[c];
      let inDir = refract(rd, n, 1.0 / ior);
      if (length(inDir) < 0.001) { continue; }
      var t = 0.02;
      for (var i = 0; i < 36; i = i + 1) {       // march until we are out of the glass
        if (map(pos + inDir * t) > 0.0) { break; }
        t = t + 0.014;
      }
      let exitP = pos + inDir * t;
      let exitN = -normalAt(exitP);
      var outDir = refract(inDir, exitN, ior);
      if (length(outDir) < 0.001) { outDir = reflect(inDir, exitN); }
      let lit = (hidden(outDir, u.time) + studio(outDir) * 0.22) * exp(-t * 0.6);
      if (c == 0) { thru.r = lit.r; } else if (c == 1) { thru.g = lit.g; } else { thru.b = lit.b; }
    }

    // the lit edge itself: where the normal turns fastest, glass catches light
    let edge = pow(1.0 - cosi, 6.0);
    col = mix(thru, refl, f) + vec3f(0.9, 0.94, 1.0) * edge * 0.5;
    col = col / (col + vec3f(1.15));             // roll the highlights off rather than clipping
    col = pow(col, vec3f(0.85));
  }

  // grain, so the falloff never bands
  let g = fract(sin(dot(uv * u.res + vec2f(u.time), vec2f(12.9898, 78.233))) * 43758.5453) - 0.5;
  return vec4f(col + vec3f(g * 0.012), 1.0);
}`;

export async function startGlass(canvas: HTMLCanvasElement) {
  if (!('gpu' in navigator)) throw new Error('WebGPU is not available in this browser');
  const gpu = await init();
  const view = surface(gpu, canvas);
  const u = uniforms(gpu, {
    res: [canvas.width, canvas.height],
    mouse: [0.5, 0.5],
    time: 0,
    spin: 0,
    ior: 1.52,
    mirror: 0.55,
    _pad: 0,
  });
  const pass = effect(gpu, WGSL).set({ u });

  const pointer = { x: 0.5, y: 0.5 };
  addEventListener('pointermove', (e) => {
    pointer.x = e.clientX / innerWidth;
    pointer.y = e.clientY / innerHeight;
  }, { passive: true });

  const t0 = performance.now();
  const loop = frameLoop(gpu, () => {
    const t = (performance.now() - t0) / 1000;
    u.set({
      res: [canvas.width, canvas.height],
      mouse: [pointer.x, pointer.y],
      time: t,
      spin: t * 0.2,                 // the same cruise the particle mark keeps
    });
    pass.draw(view);
  });
  return { stop: () => loop.stop() };
}
