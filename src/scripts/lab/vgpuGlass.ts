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
  rough: f32,      // how soft the strips read in it
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

/* The room: black, with a few hard-edged strips — the softboxes of a dark
   studio. Narrow and very bright, so a face catches a streak rather than a
   wash, which is what makes a surface read as glass rather than as plastic. */
fn studio(d: vec3f) -> vec3f {
  let n = normalize(d);
  var l = 0.0;
  // the key: a long strip above and behind
  l = l + smoothstep(0.88, 0.995, dot(n, normalize(vec3f(-0.32, 0.92, -0.22)))) * 9.0;
  // a hard rim strip to the right
  l = l + smoothstep(0.93, 0.998, dot(n, normalize(vec3f(0.96, 0.1, 0.26)))) * 7.0;
  // a second, cooler strip behind the left shoulder
  l = l + smoothstep(0.90, 0.995, dot(n, normalize(vec3f(-0.75, 0.25, 0.62)))) * 4.0;
  // a dim floor bounce, so the underside is not dead
  l = l + smoothstep(0.4, 1.0, -n.y) * 0.5;
  // and the faintest sky gradient, to give the reflection somewhere to fall
  l = l + max(0.0, n.y) * 0.25;
  return vec3f(0.95, 0.97, 1.0) * l;
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
    let f = 0.04 + 0.96 * pow(1.0 - cosi, 5.0);   // Fresnel: edges mirror, faces let through

    // what the surface mirrors
    let refl = studio(reflect(rd, n));

    // and what it lets through: bend in, cross the slab, bend out — each
    // channel bending a little differently, which is the tell for glass
    var thru = vec3f(0.0);
    let iors = vec3f(u.ior - 0.022, u.ior, u.ior + 0.022);
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
      let lit = studio(outDir) * exp(-t * 1.6);
      if (c == 0) { thru.r = lit.r; } else if (c == 1) { thru.g = lit.g; } else { thru.b = lit.b; }
    }

    // the lit edge itself: where the normal turns fastest, glass catches light
    let edge = pow(1.0 - cosi, 3.0);
    col = mix(thru, refl, f) + vec3f(0.9, 0.94, 1.0) * edge * 0.35;
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
    ior: 1.48,
    rough: 0.12,
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
