/* ═══════════════════════════════════════════════════════════════════
   The hero in glass: a trial, chosen on the address with `?hero=glass`
   (clear) or `?hero=frost` (etched). Everything else about the hero is
   the same — it answers the page exactly as the particle one does — only
   what the forms are made of changes.

   One shader, no library. Every form is a signed distance: the mark's
   three plates, a tree, a standing figure, a phone. The object on screen
   is a blend of two of them, and a morph is that blend running from one
   to the other, so the glass melts from one form into the next rather
   than cutting. The page is black, so there is nothing behind the glass
   to see through; it is lit the way a black object is photographed — a
   dark room and a few bright strips — and a faint hidden field is drawn
   for the refracted ray alone, so the glass reads as something you look
   into. Each colour bends a little differently on the way out, which is
   the tell for glass.

   Rendered below the screen's own resolution and scaled up — glass is
   soft, and a phone has to hold it — and stopped entirely once the hero
   has gone by.
   ═══════════════════════════════════════════════════════════════════ */
import type { Hero } from './index';

export interface GlassOptions { host: HTMLElement; frost?: boolean }

const FRAG = /* glsl */ `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform int uA;
uniform int uB;
uniform float uMix;
uniform float uSpin;
uniform float uTurn;
uniform float uOut;
uniform float uExit;
uniform float uFrost;

/* ── primitives ─────────────────────────────────────────────────── */
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float roundBox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
float sphere(vec3 p, float r) { return length(p) - r; }
float capsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
vec3 rotAxis(vec3 p, vec3 k, float a) { float c = cos(a), s = sin(a); return p * c + cross(k, p) * s + k * dot(k, p) * (1.0 - c); }

/* ── the mark: three L plates round a cube, as the logo draws them ── */
const float SEP = 0.175;
const float THICK = 0.055;
const float NOTCH = 0.6667;
float sdL(vec3 q) {
  float d = q.z + THICK;
  float a = sdBox(vec3(q.x - 0.5, q.y - NOTCH * 0.5, d), vec3(0.5, NOTCH * 0.5, THICK));
  float b = sdBox(vec3(q.x - NOTCH * 0.5, q.y - 0.5, d), vec3(NOTCH * 0.5, 0.5, THICK));
  return min(a, b) - 0.012;
}
const vec3 DIAG = vec3(0.57735);
float markD(vec3 w) {
  /* seen down its diagonal, top face up — the logo's own view — and turning
     on that diagonal, so it tumbles rather than spins flat */
  vec3 f = DIAG, r = normalize(cross(vec3(0.0, 1.0, 0.0), f)), u = cross(f, r);
  const float M = 1.3;
  vec3 q = (r * w.x + u * w.y + f * w.z) / M;
  vec3 p = rotAxis(q, DIAG, -uSpin);
  float o = 0.5 + SEP;
  float d = min(sdL(vec3(p.x + 0.5, p.z + 0.5, o - p.y)),
            min(sdL(vec3(p.x + 0.5, p.y + 0.5, o - p.z)),
                sdL(vec3(p.z + 0.5, p.y + 0.5, o - p.x))));
  return d * M;
}

/* ── the forms, authored y up, feet at 0, about a unit tall ───────── */
float treeU(vec3 p) {
  float d = capsule(p, vec3(0.0), vec3(0.015, 0.5, 0.01), 0.05);
  d = smin(d, capsule(p, vec3(0.01, 0.34, 0.0), vec3(-0.14, 0.52, 0.03), 0.025), 0.04);
  d = smin(d, capsule(p, vec3(0.012, 0.38, 0.0), vec3(0.15, 0.55, -0.04), 0.025), 0.04);
  float c = sphere(p - vec3(0.0, 0.74, 0.0), 0.2);
  c = smin(c, sphere(p - vec3(-0.17, 0.62, 0.05), 0.15), 0.09);
  c = smin(c, sphere(p - vec3(0.16, 0.64, -0.06), 0.15), 0.09);
  c = smin(c, sphere(p - vec3(0.05, 0.62, 0.16), 0.13), 0.09);
  c = smin(c, sphere(p - vec3(-0.06, 0.66, -0.16), 0.13), 0.09);
  c = smin(c, sphere(p - vec3(0.02, 0.9, 0.02), 0.12), 0.09);
  return smin(d, c, 0.06);
}
float figureU(vec3 p) {
  float x = p.x, y = p.y, z = p.z;
  float d = sphere(vec3(x, y - 0.865, z - 0.01), 0.105);
  d = min(d, roundBox(vec3(x, y - 0.885, z + 0.055), vec3(0.075, 0.075, 0.02), 0.02));
  d = smin(d, capsule(p, vec3(0.0, 0.75, 0.0), vec3(0.0, 0.80, 0.0), 0.045), 0.03);
  float chest = roundBox(vec3(x, y - 0.63, z), vec3(0.135, 0.115, 0.062), 0.05);
  float waist = roundBox(vec3(x, y - 0.46, z), vec3(0.10, 0.09, 0.055), 0.045);
  float hips = roundBox(vec3(x - 0.012, y - 0.36, z), vec3(0.115, 0.075, 0.06), 0.05);
  d = smin(d, smin(smin(chest, waist, 0.06), hips, 0.05), 0.04);
  d = smin(d, capsule(p, vec3(-0.135, 0.705, 0.0), vec3(0.135, 0.705, 0.0), 0.055), 0.05);
  d = smin(d, capsule(p, vec3(-0.175, 0.70, 0.005), vec3(-0.225, 0.50, 0.03), 0.043), 0.04);
  d = smin(d, capsule(p, vec3(-0.225, 0.50, 0.03), vec3(-0.205, 0.315, -0.01), 0.036), 0.03);
  d = min(d, sphere(vec3(x + 0.20, y - 0.285, z + 0.02), 0.043));
  d = smin(d, capsule(p, vec3(0.175, 0.70, -0.005), vec3(0.235, 0.505, -0.045), 0.043), 0.04);
  d = smin(d, capsule(p, vec3(0.235, 0.505, -0.045), vec3(0.215, 0.325, 0.02), 0.036), 0.03);
  d = min(d, sphere(vec3(x - 0.21, y - 0.295, z - 0.03), 0.043));
  d = smin(d, capsule(p, vec3(-0.062, 0.335, 0.0), vec3(-0.072, 0.175, 0.005), 0.058), 0.05);
  d = smin(d, capsule(p, vec3(-0.072, 0.175, 0.005), vec3(-0.078, 0.015, 0.0), 0.045), 0.04);
  d = smin(d, capsule(p, vec3(0.066, 0.335, 0.01), vec3(0.086, 0.18, 0.06), 0.058), 0.05);
  d = smin(d, capsule(p, vec3(0.086, 0.18, 0.06), vec3(0.086, 0.02, 0.035), 0.045), 0.04);
  d = min(d, roundBox(vec3(x + 0.078, y - 0.005, z - 0.03), vec3(0.045, 0.018, 0.075), 0.018));
  d = min(d, roundBox(vec3(x - 0.086, y - 0.012, z - 0.065), vec3(0.045, 0.018, 0.075), 0.018));
  return d;
}
float slab(vec3 p, vec3 h, float r, float e) {
  vec2 q = abs(p.xy) - h.xy + r;
  float face = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  vec2 w = vec2(face + e, abs(p.z) - h.z + e);
  return length(max(w, 0.0)) + min(max(w.x, w.y), 0.0) - e;
}
float phoneU(vec3 p) {
  vec3 q = p - vec3(0.0, 0.5, 0.0);
  float c = cos(0.1), s = sin(0.1);
  q = vec3(q.x, q.y * c + q.z * s, -q.y * s + q.z * c);
  float d = slab(q, vec3(0.195, 0.4, 0.032), 0.075, 0.018);
  d = max(d, -slab(q - vec3(0.0, 0.0, 0.034), vec3(0.178, 0.383, 0.01), 0.062, 0.004));
  d = min(d, slab(q - vec3(-0.09, 0.29, -0.038), vec3(0.085, 0.085, 0.012), 0.03, 0.006));
  d = min(d, capsule(q, vec3(-0.135, 0.325, -0.05), vec3(-0.135, 0.325, -0.066), 0.028));
  d = min(d, capsule(q, vec3(-0.045, 0.325, -0.05), vec3(-0.045, 0.325, -0.066), 0.028));
  d = min(d, capsule(q, vec3(-0.09, 0.255, -0.05), vec3(-0.09, 0.255, -0.066), 0.028));
  return d;
}

/* a form in the world: turned on its own axis, scaled up, centred */
const float S = 2.1;
float form(int i, vec3 w) {
  if (i == 0) return markD(w);
  vec3 p = rotY(w, uTurn) / S + vec3(0.0, 0.5, 0.0);
  float d = i == 1 ? treeU(p) : i == 2 ? figureU(p) : phoneU(p);
  return d * S;
}

/* The morph. Two separate forms blended straight across average out to
   nothing halfway, and the glass vanished. So the one going melts instead:
   it thins away while a drop of glass swells at the middle and takes it in,
   and the next form grows out of the drop as it shrinks — liquid glass
   poured from one shape into the next, never an empty frame. */
float map(vec3 w) {
  w.y -= uExit * 1.6;
  float a = form(uA, w);
  if (uMix <= 0.001) return a;
  float m = uMix;
  float drop = length(w) - 0.78 * sqrt(sin(3.14159 * m));
  float going = a + 0.55 * smoothstep(0.0, 0.6, m);
  float coming = form(uB, w) + 0.55 * (1.0 - smoothstep(0.4, 1.0, m));
  return smin(smin(going, drop, 0.35), coming, 0.35);
}

vec3 normalAt(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  const float e = 0.0015;
  return normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) +
                   k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
}

/* the room: dark, with a few soft strips; frosted glass sees them blurred */
vec3 studio(vec3 d) {
  vec3 n = normalize(d);
  float w = mix(0.0, 0.18, uFrost);
  float l = 0.0;
  l += smoothstep(0.90 - w, 0.998, dot(n, normalize(vec3(-0.32, 0.92, -0.22)))) * 3.2;
  l += smoothstep(0.94 - w, 0.999, dot(n, normalize(vec3(0.96, 0.1, 0.26)))) * 2.4;
  l += smoothstep(0.92 - w, 0.997, dot(n, normalize(vec3(-0.75, 0.25, 0.62)))) * 1.4;
  l += max(0.0, n.y) * 0.06;
  return vec3(0.95, 0.97, 1.0) * l;
}
/* what is behind the glass, drawn for the refracted ray alone */
vec3 hidden(vec3 d, float t) {
  vec3 n = normalize(d);
  float sharp = mix(34.0, 6.0, uFrost);
  float a = atan(n.z, n.x) * 3.0 + t * 0.15;
  float b = asin(clamp(n.y, -1.0, 1.0)) * 5.0 - t * 0.1;
  float lines = pow(abs(sin(a)), sharp) + pow(abs(sin(b)), sharp);
  float blobs = pow(max(0.0, dot(n, normalize(vec3(sin(t * 0.21), 0.35, cos(t * 0.21))))), mix(140.0, 30.0, uFrost)) * 3.0
              + pow(max(0.0, dot(n, normalize(vec3(cos(t * 0.13), -0.5, sin(t * 0.17))))), mix(90.0, 20.0, uFrost)) * 1.6;
  float depth = 0.16 + 0.34 * max(0.0, n.y);
  return vec3(0.86, 0.91, 1.0) * (lines * mix(1.1, 0.35, uFrost) + blobs * 1.2) + vec3(0.34, 0.38, 0.5) * depth;
}

void main() {
  /* sized by the screen's shorter side, so a tall screen does not push the
     form out over the headline */
  vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y * 1.15);

  vec2 m = (uMouse - 0.5) * 0.5;
  float yaw = m.x * 0.45, pitch = 0.08 + m.y * 0.25;
  const float D = 6.2;
  vec3 ro = vec3(D * cos(pitch) * sin(yaw), D * sin(pitch), D * cos(pitch) * cos(yaw));
  vec3 fw = normalize(-ro), rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw)), up = cross(fw, rt);
  vec3 rd = normalize(fw * 3.1 + rt * p.x + up * p.y);

  /* a ray that misses the form's sphere is not marched at all */
  vec3 c0 = vec3(0.0, uExit * 1.6, 0.0);
  vec3 oc = ro - c0;
  float bq = dot(oc, rd), cq = dot(oc, oc) - 1.75 * 1.75;
  if (bq * bq - cq < 0.0) { outColor = vec4(0.0); return; }

  float t = max(0.0, -bq - 1.75), hit = -1.0;
  for (int i = 0; i < 110; i++) {
    float s = map(ro + rd * t);
    if (s < 0.0015) { hit = t; break; }
    t += s * 0.9;
    if (t > 12.0) break;
  }
  if (hit < 0.0) { outColor = vec4(0.0); return; }

  vec3 pos = ro + rd * hit;
  vec3 n = normalAt(pos);
  float cosi = clamp(dot(n, -rd), 0.0, 1.0);
  float fres = 0.04 + 0.96 * pow(1.0 - cosi, 5.0);
  vec3 refl = studio(reflect(rd, n));

  /* bend in, cross the glass, bend out — each colour bending a little
     differently on the way out */
  const float IOR = 1.5;
  vec3 rin = refract(rd, n, 1.0 / IOR);
  vec3 q = pos - n * 0.004;
  float th = 0.02;
  for (int i = 0; i < 48; i++) {
    float s = -map(q + rin * th);
    if (s < 0.0015) break;
    th += max(s, 0.004) * 0.9;
    if (th > 4.0) break;
  }
  vec3 ex = q + rin * th;
  vec3 nx = -normalAt(ex);
  vec3 thru;
  vec3 iors = vec3(IOR - 0.04, IOR, IOR + 0.04);
  for (int c = 0; c < 3; c++) {
    vec3 ro2 = refract(rin, nx, iors[c]);
    if (dot(ro2, ro2) < 0.001) ro2 = reflect(rin, nx);
    vec3 e = hidden(ro2, uTime) + studio(ro2) * 0.5;
    thru[c] = e[c];
  }
  /* the glass is not quite clear: the further through it, the more it holds */
  thru *= exp(-th * vec3(0.22, 0.12, 0.08));

  vec3 col = mix(thru, refl, fres);
  /* frosted: the body scatters, so it glows milky and its rim reads white */
  if (uFrost > 0.0) {
    float body = 0.25 + 0.55 * max(0.0, dot(n, normalize(vec3(-0.3, 0.8, 0.5))));
    col = mix(col, vec3(0.62, 0.65, 0.7) * body + refl * 0.35, 0.45 * uFrost);
    col += vec3(0.9) * pow(1.0 - cosi, 3.0) * 0.35 * uFrost;
  }
  col = col / (1.0 + col * 0.35);
  col = pow(col, vec3(0.92));

  float a = 1.0 - uOut;
  outColor = vec4(col * a, a);
}`;

const VERT = /* glsl */ `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

/** the reel: which form, for how long — the mark between each, as the
 *  particle hero does it */
const REEL = [0, 1, 0, 2, 0, 3];
const HOLD = 3.4;        // seconds a form stands
const MORPH = 1.5;       // seconds from one to the next
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (t: number) => t * t * (3 - 2 * t);

export function createGlassHero({ host, frost = false }: GlassOptions): Hero {
  const canvas = document.createElement('canvas');
  host.appendChild(canvas);
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' });
  const none: Hero = { setReady() {}, setOut() {}, setExit() {}, strike() {}, showShape() {}, destroy() { canvas.remove(); } };
  if (!gl) return none;

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.bindAttribLocation(prog, 0, 'pos');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return none; }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = (n: string) => gl.getUniformLocation(prog, n);
  const u = { res: U('uRes'), time: U('uTime'), mouse: U('uMouse'), a: U('uA'), b: U('uB'), mix: U('uMix'),
              spin: U('uSpin'), turn: U('uTurn'), out: U('uOut'), exit: U('uExit'), frost: U('uFrost') };
  gl.uniform1f(u.frost, frost ? 1 : 0);

  /* below the screen's own resolution: glass is soft, and a phone has to
     hold it; stepped down further if frames run long */
  const narrow = matchMedia('(max-width: 719px)').matches;
  let scale = narrow ? 0.7 : 0.75;
  const fit = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(innerWidth * dpr * scale));
    canvas.height = Math.max(1, Math.round(innerHeight * dpr * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u.res, canvas.width, canvas.height);
  };
  fit();
  addEventListener('resize', fit);

  let mx = 0.5, my = 0.5, tmx = 0.5, tmy = 0.5;
  const onMove = (e: PointerEvent) => { tmx = e.clientX / innerWidth; tmy = 1 - e.clientY / innerHeight; };
  addEventListener('pointermove', onMove, { passive: true });

  const pin = new URLSearchParams(location.search).get('form');
  const pinned = pin !== null && /^[0-3]$/.test(pin) ? Number(pin) : -1;
  let out = 0, exit = 0, released = false, raf = 0, gone = false;
  const t0 = performance.now();
  let reelT = 0, last = t0, slow = 0, frames = 0;

  const frame = (now: number) => {
    raf = 0;
    if (gone) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    /* a frame that runs long, often, steps the resolution down once more */
    frames++; if (dt > 1 / 40) slow++;
    if (frames === 90) { if (slow > 45 && scale > 0.4) { scale -= 0.15; fit(); } frames = 0; slow = 0; }

    if (released) reelT += dt;
    const step = HOLD + MORPH;
    const k = Math.floor(reelT / step);
    const inStep = reelT - k * step;
    let a = REEL[k % REEL.length], b = REEL[(k + 1) % REEL.length];
    let m = inStep > HOLD ? ease(clamp01((inStep - HOLD) / MORPH)) : 0;
    /* `&form=0..3` holds one form still, for looking at it */
    if (pinned >= 0) { a = pinned; b = pinned; m = 0; }
    mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
    const time = (now - t0) / 1000;

    gl.uniform1f(u.time, time);
    gl.uniform2f(u.mouse, mx, my);
    gl.uniform1i(u.a, a); gl.uniform1i(u.b, b);
    gl.uniform1f(u.mix, m);
    gl.uniform1f(u.spin, time * 0.35);
    gl.uniform1f(u.turn, Math.sin(time * 0.3) * 0.5);
    gl.uniform1f(u.out, out);
    gl.uniform1f(u.exit, exit);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    /* once the hero has gone by, nothing is drawn until it comes back */
    if (out < 0.999) raf = requestAnimationFrame(frame);
  };
  const wake = () => { if (!raf && !gone) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  wake();

  return {
    setReady() { released = true; },
    setOut(p) { out = clamp01(p); if (out < 0.999) wake(); },
    setExit(p) { exit = clamp01(p); },
    strike() {},
    showShape() {},
    destroy() {
      gone = true;
      if (raf) cancelAnimationFrame(raf);
      removeEventListener('resize', fit);
      removeEventListener('pointermove', onMove);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    },
  };
}
