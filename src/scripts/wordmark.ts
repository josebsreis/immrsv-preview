/* ═══════════════════════════════════════════════════════════════════
   The name, in WebGL.

   The letters are rasterised once from the inline SVG into an alpha
   texture, then drawn by a single quad that decides, per pixel, how lit
   that part of the mark is:

     · the letters rest at a fixed brightness — scrolling changes nothing;
     · a flow map splatted at the cursor, carrying its velocity and a heat
       value and decayed every frame, lights the letters to white where the
       hand is and leaves a wake behind it;
     · that same flow drags the letters with it, and a live bulge around the
       cursor pushes them outward, so the mark bends like the hero's lens;
     · the channels part at the edge of the disturbance, and a slow drift
       plus a static dither keep the fill alive.

   It only runs while it is on screen. Without WebGL2, or for a reader who
   asked for less motion, nothing here loads and the plain SVG stays.
   ═══════════════════════════════════════════════════════════════════ */

export interface WordmarkConfig {
  base: number;         // brightness at rest
  restingHover: number; // …on a device with no pointer, where nothing can light it
  heatGain: number;     // how much the cursor adds on top
  trailRes: number;     // flow map width (height follows the mark's aspect)
  trailDecay: number;   // per second
  trailRadius: number;
  trailAdd: number;     // heat added per second under the cursor
  trailPush: number;    // how much of the cursor's velocity the map keeps
  smear: number;        // displacement from the wake, in uv
  bulge: number;        // displacement from the cursor itself
  bulgeRadius: number;
  aberration: number;   // channel separation at full disturbance, in uv
  flow: number;         // drift of the fill
  grain: number;
}

export const WORDMARK_CONFIG: WordmarkConfig = {
  base: 0.42,
  restingHover: 0.9,
  heatGain: 0.85,
  trailRes: 320,
  trailDecay: 0.32,     // per second — enough for the light to leave a wake
  trailRadius: 0.38,
  trailAdd: 4.0,
  trailPush: 0.5,
  smear: 0.075,
  bulge: 0.045,
  bulgeRadius: 0.5,
  aberration: 0.0034,
  flow: 0.05,
  grain: 0.035,
};

export interface Wordmark { destroy(): void; }

const VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/* rg — the cursor's velocity, signed, packed into 0..1; b — heat */
const TRAIL_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPrev;
uniform vec2 uPointer;      // -1 when absent
uniform vec2 uVelocity;
uniform float uAspect, uRadius, uDecay, uAdd, uPush;
out vec4 frag;
void main() {
  vec4 prev = texture(uPrev, vUv);
  vec2 v = (prev.rg * 2.0 - 1.0) * uDecay;
  float h = prev.b * uDecay;
  if (uPointer.x > -0.5) {
    vec2 d = vec2((vUv.x - uPointer.x) * uAspect, vUv.y - uPointer.y);
    float g = exp(-dot(d, d) / (uRadius * uRadius));
    v += uVelocity * uPush * g;
    h += g * uAdd;
  }
  frag = vec4(clamp(v, -1.0, 1.0) * 0.5 + 0.5, min(h, 1.0), 1.0);
}`;

const MARK_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uLetters, uTrail;
uniform vec3 uInk;
uniform vec2 uPointer;
uniform float uBase, uHeat, uAber, uFlow, uGrain, uTime, uAspect, uSmear, uBulge, uBulgeR;
out vec4 frag;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

// value noise, two octaves — the drift inside the fill
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1, 0)), c = hash(i + vec2(0, 1)), d = hash(i + vec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec4 t = texture(uTrail, vUv);
  vec2 vel = t.rg * 2.0 - 1.0;
  float heat = t.b;

  // dragged by the wake…
  vec2 disp = vec2(vel.x / uAspect, vel.y) * uSmear;

  // …and pushed outward by the cursor itself, so it reads as a lens
  if (uPointer.x > -0.5) {
    vec2 d = vec2((vUv.x - uPointer.x) * uAspect, vUv.y - uPointer.y);
    float g = exp(-dot(d, d) / (uBulgeR * uBulgeR));
    disp += normalize(d + 1e-5) * g * uBulge * vec2(1.0 / uAspect, 1.0);
  }

  // the channels part where the disturbance is strongest
  float off = uAber * clamp(heat + length(vel) * 0.7, 0.0, 1.0);
  float ar = texture(uLetters, vUv + disp + vec2(off, 0.0)).a;
  float ag = texture(uLetters, vUv + disp).a;
  float ab = texture(uLetters, vUv + disp - vec2(off, 0.0)).a;
  float a = max(ag, max(ar, ab));
  if (a < 0.002) discard;

  float b = uBase + heat * uHeat;
  // the fill drifts, so the mark is never quite flat
  b *= 1.0 + uFlow * (noise(vec2(vUv.x * 4.0 - uTime * 0.06, vUv.y * 2.5 + uTime * 0.03)) - 0.5) * 2.0;
  b += (hash(gl_FragCoord.xy) - 0.5) * uGrain;
  b = clamp(b, 0.0, 1.2);

  vec3 rgb = uInk * vec3(ar, ag, ab) * b;    // premultiplied
  frag = vec4(rgb, a * b);
}`;

function compile(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const make = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader');
    return sh;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, make(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
  return p;
}

/** the inline SVG, rasterised once into a white-on-transparent bitmap */
function rasterise(svg: SVGSVGElement, width: number): Promise<HTMLCanvasElement> {
  const box = svg.viewBox.baseVal;
  const height = Math.max(1, Math.round((width * box.height) / box.width));
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('fill', '#fff');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = width; c.height = height;
      c.getContext('2d')!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('rasterise')); };
    img.src = url;
  });
}

export async function createWordmark(
  host: HTMLElement,
  canvas: HTMLCanvasElement,
  config: Partial<WordmarkConfig> = {},
): Promise<Wordmark | null> {
  const C = { ...WORDMARK_CONFIG, ...config };
  const svg = host.querySelector('svg');
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true });
  if (!svg || !gl) return null;
  const GL: WebGL2RenderingContext = gl;   // narrowed once, so the closures below can use it

  const letters = await rasterise(svg, 2048).catch(() => null);
  if (!letters) return null;

  const aspect = letters.width / letters.height;
  const trailW = C.trailRes, trailH = Math.max(2, Math.round(C.trailRes / aspect));

  const tex = (w: number, h: number, src?: TexImageSource) => {
    const t = GL.createTexture()!;
    GL.bindTexture(GL.TEXTURE_2D, t);
    // bitmaps arrive top-down, GL reads bottom-up
    GL.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, src ? 1 : 0);
    if (src) GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, GL.RGBA, GL.UNSIGNED_BYTE, src);
    else GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, w, h, 0, GL.RGBA, GL.UNSIGNED_BYTE, null);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
    return t;
  };
  const target = (t: WebGLTexture) => {
    const fb = GL.createFramebuffer()!;
    GL.bindFramebuffer(GL.FRAMEBUFFER, fb);
    GL.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, t, 0);
    return fb;
  };

  const lettersTex = tex(0, 0, letters);
  let trail = [0, 1].map(() => { const t = tex(trailW, trailH); return { t, fb: target(t) }; });

  const pTrail = compile(GL, VERT, TRAIL_FRAG);
  const pMark = compile(GL, VERT, MARK_FRAG);
  const u = (p: WebGLProgram, n: string) => GL.getUniformLocation(p, n);
  const vao = GL.createVertexArray();

  // the ink colour comes from the page, so the theme still owns it
  const ink = getComputedStyle(host).color.match(/[\d.]+/g)?.slice(0, 3).map((v) => Number(v) / 255) ?? [1, 1, 1];

  let dpr = 1, w = 0, h = 0;
  function resize() {
    const r = host.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = Math.max(1, Math.round(r.width * dpr));
    h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }
  resize();

  const canHover = matchMedia('(hover: hover)').matches;
  const base = canHover ? C.base : C.restingHover;    // nothing can light it without a pointer

  const P = { x: -1, y: -1, px: -1, py: -1, vx: 0, vy: 0 };
  const onMove = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    const pad = r.height * 1.2;                       // the cursor is felt a little before it arrives
    const inside = e.clientX >= r.left - pad && e.clientX <= r.right + pad && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
    P.x = inside ? (e.clientX - r.left) / r.width : -1;
    P.y = inside ? 1 - (e.clientY - r.top) / r.height : -1;
  };
  const onLeave = () => { P.x = -1; P.y = -1; P.px = -1; P.py = -1; };
  addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('mouseleave', onLeave);

  let visible = false, raf = 0, last = performance.now(), time = 0;
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    last = performance.now();
    if (visible && !raf) raf = requestAnimationFrame(frame);
  }, { rootMargin: '20% 0px' });
  io.observe(host);

  const ro = new ResizeObserver(resize);
  ro.observe(host);

  function frame(now: number) {
    raf = visible ? requestAnimationFrame(frame) : 0;
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now; time += dt;

    // how fast the cursor is crossing the mark, in mark-heights per second
    if (P.x < 0 || P.px < 0) { P.vx = 0; P.vy = 0; }
    else if (dt > 0) {
      P.vx = Math.max(-1, Math.min(1, ((P.x - P.px) * aspect) / dt * 0.25));
      P.vy = Math.max(-1, Math.min(1, ((P.y - P.py) / dt) * 0.25));
    }
    P.px = P.x; P.py = P.y;

    GL.bindVertexArray(vao);

    // 1 — the heat map: decay what is there, splat where the cursor is
    GL.useProgram(pTrail);
    GL.bindFramebuffer(GL.FRAMEBUFFER, trail[1].fb);
    GL.viewport(0, 0, trailW, trailH);
    GL.activeTexture(GL.TEXTURE0); GL.bindTexture(GL.TEXTURE_2D, trail[0].t);
    GL.uniform1i(u(pTrail, 'uPrev'), 0);
    GL.uniform2f(u(pTrail, 'uPointer'), P.x, P.y);
    GL.uniform2f(u(pTrail, 'uVelocity'), P.vx, P.vy);
    GL.uniform1f(u(pTrail, 'uPush'), C.trailPush);
    GL.uniform1f(u(pTrail, 'uAspect'), aspect);
    GL.uniform1f(u(pTrail, 'uRadius'), C.trailRadius);
    GL.uniform1f(u(pTrail, 'uDecay'), Math.pow(C.trailDecay, dt));
    GL.uniform1f(u(pTrail, 'uAdd'), C.trailAdd * dt);
    GL.disable(GL.BLEND);
    GL.drawArrays(GL.TRIANGLES, 0, 3);
    trail = [trail[1], trail[0]];

    // 2 — the mark
    GL.useProgram(pMark);
    GL.bindFramebuffer(GL.FRAMEBUFFER, null);
    GL.viewport(0, 0, w, h);
    GL.clearColor(0, 0, 0, 0); GL.clear(GL.COLOR_BUFFER_BIT);
    GL.enable(GL.BLEND); GL.blendFunc(GL.ONE, GL.ONE_MINUS_SRC_ALPHA);
    GL.activeTexture(GL.TEXTURE0); GL.bindTexture(GL.TEXTURE_2D, lettersTex);
    GL.activeTexture(GL.TEXTURE1); GL.bindTexture(GL.TEXTURE_2D, trail[0].t);
    GL.uniform1i(u(pMark, 'uLetters'), 0);
    GL.uniform1i(u(pMark, 'uTrail'), 1);
    GL.uniform3f(u(pMark, 'uInk'), ink[0], ink[1], ink[2]);
    GL.uniform2f(u(pMark, 'uPointer'), P.x, P.y);
    GL.uniform1f(u(pMark, 'uBase'), base);
    GL.uniform1f(u(pMark, 'uHeat'), C.heatGain);
    GL.uniform1f(u(pMark, 'uAspect'), aspect);
    GL.uniform1f(u(pMark, 'uSmear'), C.smear);
    GL.uniform1f(u(pMark, 'uBulge'), C.bulge);
    GL.uniform1f(u(pMark, 'uBulgeR'), C.bulgeRadius);
    GL.uniform1f(u(pMark, 'uAber'), C.aberration);
    GL.uniform1f(u(pMark, 'uFlow'), C.flow);
    GL.uniform1f(u(pMark, 'uGrain'), C.grain);
    GL.uniform1f(u(pMark, 'uTime'), time);
    GL.drawArrays(GL.TRIANGLES, 0, 3);
  }

  host.dataset.gl = '';                                // the SVG steps back, the canvas takes over
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
      removeEventListener('pointermove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      delete host.dataset.gl;
    },
  };
}
