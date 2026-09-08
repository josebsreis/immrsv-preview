/* ═══════════════════════════════════════════════════════════════════
   The name, in WebGL.

   The letters are rasterised once from the inline SVG into an alpha
   texture, then drawn by a single quad that decides, per pixel, how lit
   that part of the mark is:

     · a wipe travelling left to right, driven by the panel's own scroll
       position, brings the letters up from almost nothing to their base;
     · a heat map splatted at the cursor and decayed every frame lifts them
       the rest of the way to white, and separates the channels slightly at
       its edge — the same fringe the hero's lens has;
     · a slow flow and a static dither keep the fill alive, so the mark
       reads as the same material the hero is made of.

   It only runs while it is on screen. Without WebGL2, or for a reader who
   asked for less motion, nothing here loads and the plain SVG stays.
   ═══════════════════════════════════════════════════════════════════ */

export interface WordmarkConfig {
  dim: number;        // how faint the letters are before the wipe reaches them
  base: number;       // where the wipe leaves them
  edge: number;       // softness of the wipe, in uv
  heatGain: number;   // how much the cursor adds on top of base
  trailRes: number;   // heat map width (height follows the mark's aspect)
  trailDecay: number; // per second
  trailRadius: number;
  trailAdd: number;
  aberration: number; // channel separation at full heat, in uv
  flow: number;       // drift of the fill
  grain: number;
}

export const WORDMARK_CONFIG: WordmarkConfig = {
  dim: 0.07,
  base: 0.66,
  edge: 0.34,
  heatGain: 0.9,
  trailRes: 320,
  trailDecay: 0.35,     // per second — enough for the light to leave a wake
  trailRadius: 0.34,
  trailAdd: 3.2,
  aberration: 0.0024,
  flow: 0.055,
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

const TRAIL_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPrev;
uniform vec2 uPointer;      // -1 when absent
uniform float uAspect, uRadius, uDecay, uAdd;
out vec4 frag;
void main() {
  float prev = texture(uPrev, vUv).r * uDecay;
  float add = 0.0;
  if (uPointer.x > -0.5) {
    vec2 d = vec2((vUv.x - uPointer.x) * uAspect, vUv.y - uPointer.y);
    add = exp(-dot(d, d) / (uRadius * uRadius)) * uAdd;
  }
  frag = vec4(min(1.0, prev + add), 0.0, 0.0, 1.0);
}`;

const MARK_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uLetters, uTrail;
uniform vec3 uInk;
uniform float uReveal, uDim, uBase, uEdge, uHeat, uAber, uFlow, uGrain, uTime;
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
  float heat = texture(uTrail, vUv).r;

  // the channels part where the heat is strongest
  float off = uAber * heat;
  float ar = texture(uLetters, vUv + vec2(off, 0.0)).a;
  float ag = texture(uLetters, vUv).a;
  float ab = texture(uLetters, vUv - vec2(off, 0.0)).a;
  float a = max(ag, max(ar, ab));
  if (a < 0.002) discard;

  // the wipe: everything left of the travelling edge is up at base
  float w = max(uEdge, 0.001);
  float p = uReveal * (1.0 + w);
  float lit = 1.0 - smoothstep(p - w, p, vUv.x);

  float b = mix(uDim, uBase, lit) + heat * uHeat;
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

  const P = { x: -1, y: -1 };
  const onMove = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    const pad = r.height * 1.2;                       // the cursor is felt a little before it arrives
    const inside = e.clientX >= r.left - pad && e.clientX <= r.right + pad && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
    P.x = inside ? (e.clientX - r.left) / r.width : -1;
    P.y = inside ? 1 - (e.clientY - r.top) / r.height : -1;
  };
  const onLeave = () => { P.x = -1; P.y = -1; };
  addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('mouseleave', onLeave);

  let visible = false, raf = 0, last = performance.now(), time = 0, reveal = 0;
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

    // the wipe follows the panel across the viewport
    const r = host.getBoundingClientRect();
    reveal = Math.max(0, Math.min(1, (innerHeight * 0.95 - r.top) / (innerHeight * 0.55)));

    GL.bindVertexArray(vao);

    // 1 — the heat map: decay what is there, splat where the cursor is
    GL.useProgram(pTrail);
    GL.bindFramebuffer(GL.FRAMEBUFFER, trail[1].fb);
    GL.viewport(0, 0, trailW, trailH);
    GL.activeTexture(GL.TEXTURE0); GL.bindTexture(GL.TEXTURE_2D, trail[0].t);
    GL.uniform1i(u(pTrail, 'uPrev'), 0);
    GL.uniform2f(u(pTrail, 'uPointer'), P.x, P.y);
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
    GL.uniform1f(u(pMark, 'uReveal'), reveal);
    GL.uniform1f(u(pMark, 'uDim'), C.dim);
    GL.uniform1f(u(pMark, 'uBase'), C.base);
    GL.uniform1f(u(pMark, 'uEdge'), C.edge);
    GL.uniform1f(u(pMark, 'uHeat'), C.heatGain);
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
