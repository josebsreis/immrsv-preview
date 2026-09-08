/* ═══════════════════════════════════════════════════════════════════
   A real fluid under the page.

   Stable-fluids on the GPU (after Stam / Dobryakov): velocity is advected,
   curled back on itself (vorticity confinement), made divergence-free by a
   Jacobi pressure solve, and a single dye channel is carried through it,
   then mapped through a colour ramp. The cursor pushes on the water; a
   "lens" pass reads red and blue through the dye's slope at different
   bends, so the trail's edges fringe like glass.
   ═══════════════════════════════════════════════════════════════════ */

export interface FluidPalette { deep: number[]; violet: number[]; lav: number[]; pale: number[]; }

export interface FluidOptions {
  simRes: number; dyeRes: number;
  densityDissipation: number; velocityDissipation: number;
  pressureIters: number; curl: number;
  splatRadius: number; splatForce: number;
  dyeAmount: number; dyeMax: number;
  ambient: boolean;
  palette: FluidPalette;
  gain: number; shade: number; glow: number; haze: number;
  stars: boolean; aberration: number;
  /** viewport width at or below which sim/dye resolution is reduced */
  mobileMax: number;
}

export interface FluidHandle {
  opts: FluidOptions;
  splat(x: number, y: number, dx: number, dy: number, amount: number, radius: number): void;
  step(now: number): void;
  stop(): void;
  start(): void;
  destroy(): void;
}

const DEFAULTS: FluidOptions = {
  simRes: 128, dyeRes: 512,
  densityDissipation: 0.9, velocityDissipation: 0.6,
  pressureIters: 20, curl: 22,
  splatRadius: 0.0022, splatForce: 5200,
  dyeAmount: 7, dyeMax: 0.22,
  ambient: false,
  palette: { deep: [0.024, 0.024, 0.024], violet: [0.16, 0.16, 0.17], lav: [0.5, 0.5, 0.52], pale: [0.92, 0.92, 0.93] },
  gain: 1, shade: 0.55, glow: 0.3, haze: 0.22,
  stars: false, aberration: 0,
  mobileMax: 719,
};

const VERT = `#version 300 es
in vec2 pos; out vec2 vUv;
void main(){ vUv = pos*0.5 + 0.5; gl_Position = vec4(pos,0.0,1.0); }`;

const F_ADVECT = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uVel, uSrc; uniform vec2 texel; uniform float dt, diss;
void main(){
  vec2 coord = vUv - dt * texture(uVel, vUv).xy * texel;
  o = texture(uSrc, coord) / (1.0 + diss*dt);
}`;

const F_DIVERGENCE = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uVel; uniform vec2 texel;
void main(){
  float l = texture(uVel, vUv - vec2(texel.x,0.)).x;
  float r = texture(uVel, vUv + vec2(texel.x,0.)).x;
  float b = texture(uVel, vUv - vec2(0.,texel.y)).y;
  float t = texture(uVel, vUv + vec2(0.,texel.y)).y;
  o = vec4(0.5*(r-l+t-b), 0., 0., 1.);
}`;

const F_CURL = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uVel; uniform vec2 texel;
void main(){
  float l = texture(uVel, vUv - vec2(texel.x,0.)).y;
  float r = texture(uVel, vUv + vec2(texel.x,0.)).y;
  float b = texture(uVel, vUv - vec2(0.,texel.y)).x;
  float t = texture(uVel, vUv + vec2(0.,texel.y)).x;
  o = vec4(0.5*(r - l - t + b), 0., 0., 1.);
}`;

const F_VORTICITY = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uVel, uCurl; uniform vec2 texel; uniform float curl, dt;
void main(){
  float l = texture(uCurl, vUv - vec2(texel.x,0.)).x;
  float r = texture(uCurl, vUv + vec2(texel.x,0.)).x;
  float b = texture(uCurl, vUv - vec2(0.,texel.y)).x;
  float t = texture(uCurl, vUv + vec2(0.,texel.y)).x;
  float c = texture(uCurl, vUv).x;
  vec2 force = 0.5*vec2(abs(t) - abs(b), abs(r) - abs(l));
  force /= length(force) + 0.0001;
  force *= curl * c; force.y *= -1.0;
  vec2 v = texture(uVel, vUv).xy + force*dt;
  o = vec4(clamp(v, -1000.0, 1000.0), 0., 1.);
}`;

const F_PRESSURE = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uPres, uDiv; uniform vec2 texel;
void main(){
  float l = texture(uPres, vUv - vec2(texel.x,0.)).x;
  float r = texture(uPres, vUv + vec2(texel.x,0.)).x;
  float b = texture(uPres, vUv - vec2(0.,texel.y)).x;
  float t = texture(uPres, vUv + vec2(0.,texel.y)).x;
  float d = texture(uDiv,  vUv).x;
  o = vec4((l+r+b+t - d) * 0.25, 0., 0., 1.);
}`;

const F_GRADIENT = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uPres, uVel; uniform vec2 texel;
void main(){
  float l = texture(uPres, vUv - vec2(texel.x,0.)).x;
  float r = texture(uPres, vUv + vec2(texel.x,0.)).x;
  float b = texture(uPres, vUv - vec2(0.,texel.y)).x;
  float t = texture(uPres, vUv + vec2(0.,texel.y)).x;
  o = vec4(texture(uVel, vUv).xy - vec2(r-l, t-b), 0., 1.);
}`;

const F_SPLAT = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uTarget; uniform vec3 value; uniform vec2 point;
uniform float radius, aspect;
void main(){
  vec2 p = vUv - point; p.x *= aspect;
  float f = exp(-dot(p,p)/radius);
  o = vec4(texture(uTarget, vUv).xyz + f*value, 1.0);
}`;

const F_DISPLAY = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uDye; uniform vec2 texel, uRes; uniform float uT;
uniform vec3 uDeep, uViolet, uLav, uPale;
uniform float uGain, uShade, uGlow, uHaze, uStars, uAber;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
void main(){
  float ar = uRes.x / uRes.y;
  vec2 uv = vUv;
  float d  = texture(uDye, uv).x * uGain;
  float dl = texture(uDye, uv - vec2(texel.x,0.)).x * uGain;
  float dr = texture(uDye, uv + vec2(texel.x,0.)).x * uGain;
  float db = texture(uDye, uv - vec2(0.,texel.y)).x * uGain;
  float dt = texture(uDye, uv + vec2(0.,texel.y)).x * uGain;

  float m = clamp(d, 0.0, 1.0);
  vec3 col = mix(uDeep, uViolet, smoothstep(0.0, 0.45, m));
  col = mix(col, uLav,  smoothstep(0.40, 0.85, m));
  col = mix(col, uPale, smoothstep(1.1, 2.2, d));

  // the lens: read red and blue through the dye's slope at different bends
  if (uAber > 0.0){
    vec2 g = vec2(dr - dl, dt - db);
    vec2 dir = g / (length(g) + 1e-4);
    vec2 sh = dir * texel * uAber * smoothstep(0.0, 0.25, length(g)*20.0);
    float rr = texture(uDye, uv + sh).x * uGain;
    float bb = texture(uDye, uv - sh).x * uGain;
    float mr = clamp(rr, 0.0, 1.0), mb = clamp(bb, 0.0, 1.0);
    vec3 cr = mix(uDeep, uViolet, smoothstep(0.0, 0.45, mr)); cr = mix(cr, uLav, smoothstep(0.40, 0.85, mr));
    vec3 cb = mix(uDeep, uViolet, smoothstep(0.0, 0.45, mb)); cb = mix(cb, uLav, smoothstep(0.40, 0.85, mb));
    col = mix(col, vec3(cr.r, col.g, cb.b), 0.6);
  }

  // shading: light from the upper-left grazes the dye's slope
  vec3 n = normalize(vec3(dr - dl, dt - db, 0.08 * length(texel) * 10.0));
  float lit = clamp(dot(n, normalize(vec3(-0.5, 0.6, 0.62))), 0.0, 1.0);
  col *= 1.0 + (lit - 0.55) * uShade * smoothstep(0.02, 0.3, m);

  // a pool of light behind the mark, and haze rising from the base
  vec2 p = (uv - vec2(0.5, 0.52)) * vec2(ar, 1.0);
  col += uViolet * exp(-dot(p,p) * 3.6) * uGlow;
  col += uViolet * 0.8 * smoothstep(0.62, 0.0, uv.y) * uHaze;

  vec2 sp = uv * vec2(ar, 1.0) * 150.0; vec2 cell = floor(sp); float h = hash(cell);
  if (uStars > 0.5 && h > 0.986){
    vec2 c = fract(sp) - 0.5 - (vec2(hash(cell+1.7), hash(cell+3.1)) - 0.5)*0.6;
    float star = smoothstep(0.11, 0.0, length(c)) * (0.45 + 0.55*sin(uT*1.6 + h*60.0));
    col += vec3(0.92,0.88,1.0) * star * 0.7;
  }

  col *= 0.76 + 0.24*smoothstep(1.15, 0.15, distance(uv, vec2(0.5)));
  col += (hash(gl_FragCoord.xy) - 0.5) * (1.0/255.0);   // static dither: breaks banding, never twinkles
  o = vec4(col, 1.0);
}`;

interface Fbo { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number; texel: [number, number]; attach(id: number): number; }
interface Double { readonly read: Fbo; readonly write: Fbo; swap(): void; w: number; h: number; texel: [number, number]; }
interface Prog { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null>; }

export function createFluid(cv: HTMLCanvasElement, opts: Partial<FluidOptions> = {}): FluidHandle | null {
  const O: FluidOptions = { ...DEFAULTS, ...opts, palette: { ...DEFAULTS.palette, ...(opts.palette ?? {}) } };

  const gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl) return null;
  const extCBF = gl.getExtension('EXT_color_buffer_float');
  const extLIN = gl.getExtension('OES_texture_float_linear');
  const FILTER = extLIN ? gl.LINEAR : gl.NEAREST;
  const INTERNAL = extCBF ? gl.RGBA16F : gl.RGBA8;
  const TYPE = extCBF ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;

  function compile(type: number, src: string) {
    const s = gl!.createShader(type)!; gl!.shaderSource(s, src); gl!.compileShader(s);
    if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) console.error(gl!.getShaderInfoLog(s));
    return s;
  }
  function program(fs: string): Prog {
    const p = gl!.createProgram()!;
    gl!.attachShader(p, compile(gl!.VERTEX_SHADER, VERT));
    gl!.attachShader(p, compile(gl!.FRAGMENT_SHADER, fs));
    gl!.linkProgram(p);
    if (!gl!.getProgramParameter(p, gl!.LINK_STATUS)) console.error(gl!.getProgramInfoLog(p));
    const u: Prog['u'] = {}, n = gl!.getProgramParameter(p, gl!.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const inf = gl!.getActiveUniform(p, i)!; u[inf.name] = gl!.getUniformLocation(p, inf.name); }
    return { p, u };
  }
  const quad = gl.createVertexArray();
  gl.bindVertexArray(quad);
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const blit = (target: Fbo | null) => {
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, target ? target.fbo : null);
    gl!.viewport(0, 0, target ? target.w : gl!.drawingBufferWidth, target ? target.h : gl!.drawingBufferHeight);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
  };
  function fbo(w: number, h: number, filter: number): Fbo {
    const tex = gl!.createTexture()!;
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, filter);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, filter);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, INTERNAL, w, h, 0, gl!.RGBA, TYPE, null);
    const f = gl!.createFramebuffer()!;
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, f);
    gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, tex, 0);
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    return { tex, fbo: f, w, h, texel: [1 / w, 1 / h], attach(id) { gl!.activeTexture(gl!.TEXTURE0 + id); gl!.bindTexture(gl!.TEXTURE_2D, tex); return id; } };
  }
  function double(w: number, h: number, filter: number): Double {
    let a = fbo(w, h, filter), b = fbo(w, h, filter);
    return { get read() { return a; }, get write() { return b; }, swap() { const t = a; a = b; b = t; }, w, h, texel: a.texel };
  }

  const PROG = {
    advect: program(F_ADVECT), diverge: program(F_DIVERGENCE),
    curl: program(F_CURL), vort: program(F_VORTICITY),
    pressure: program(F_PRESSURE), gradient: program(F_GRADIENT),
    splat: program(F_SPLAT), display: program(F_DISPLAY),
  };

  let vel!: Double, dye!: Double, div!: Fbo, curlT!: Fbo, pres!: Double, W = 1, H = 1, DPR = 1;
  function sizes() {
    const ar = innerWidth / innerHeight, mobile = innerWidth <= O.mobileMax;
    const s = mobile ? O.simRes * 0.75 : O.simRes, d = mobile ? O.dyeRes * 0.6 : O.dyeRes;
    const sw = ar > 1 ? Math.round(s * ar) : s, sh = ar > 1 ? s : Math.round(s / ar);
    const dw = ar > 1 ? Math.round(d * ar) : d, dh = ar > 1 ? d : Math.round(d / ar);
    vel = double(sw, sh, FILTER); dye = double(dw, dh, FILTER);
    div = fbo(sw, sh, gl!.NEAREST); curlT = fbo(sw, sh, gl!.NEAREST); pres = double(sw, sh, gl!.NEAREST);
  }
  function resize() {
    DPR = Math.min(devicePixelRatio || 1, innerWidth <= O.mobileMax ? 1.25 : 1.5);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  }
  const onResize = () => { resize(); sizes(); };
  addEventListener('resize', onResize);
  resize(); sizes();

  function splat(x: number, y: number, dx: number, dy: number, amount: number, radius: number) {
    gl!.useProgram(PROG.splat.p);
    gl!.uniform1f(PROG.splat.u.aspect, W / H);
    gl!.uniform2f(PROG.splat.u.point, x, y);
    gl!.uniform1i(PROG.splat.u.uTarget, vel.read.attach(0));
    gl!.uniform3f(PROG.splat.u.value, dx, dy, 0);
    gl!.uniform1f(PROG.splat.u.radius, radius);
    blit(vel.write); vel.swap();
    if (amount > 0) {
      gl!.uniform1i(PROG.splat.u.uTarget, dye.read.attach(0));
      gl!.uniform3f(PROG.splat.u.value, amount, 0, 0);
      gl!.uniform1f(PROG.splat.u.radius, radius);
      blit(dye.write); dye.swap();
    }
  }

  /* pointer: raw, so a fast flick is a hard push. The first event after load,
     or after the cursor comes back in from outside, only places the pointer. */
  const P = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, moved: false, fresh: false };
  const place = (x: number, y: number) => { P.x = x; P.y = y; if (!P.moved) { P.px = x; P.py = y; } P.moved = true; P.fresh = true; };
  const onMove = (e: PointerEvent) => place(e.clientX / innerWidth, 1 - e.clientY / innerHeight);
  const onTouchStart = (e: TouchEvent) => { P.moved = false; const t = e.touches[0]; place(t.clientX / innerWidth, 1 - t.clientY / innerHeight); };
  const onTouchMove = (e: TouchEvent) => { const t = e.touches[0]; place(t.clientX / innerWidth, 1 - t.clientY / innerHeight); };
  const onLeave = () => { P.moved = false; };
  addEventListener('pointermove', onMove);
  addEventListener('touchstart', onTouchStart, { passive: true });
  addEventListener('touchmove', onTouchMove, { passive: true });
  document.addEventListener('mouseleave', onLeave);

  let last = performance.now(), running = false, raf = 0;
  function frame(now: number) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    tick(now);
  }
  function tick(now: number) {
    const dt = Math.min((now - last) / 1000, 1 / 30); last = now;
    const t = now / 1000;

    if (P.fresh) {
      const dx = P.x - P.px, dy = P.y - P.py; P.px = P.x; P.py = P.y; P.fresh = false;
      const speed = Math.hypot(dx, dy);
      if (speed > 0.0004) splat(P.x, P.y, dx * O.splatForce, dy * O.splatForce, Math.min(speed * O.dyeAmount, O.dyeMax), O.splatRadius);
    }
    if (O.ambient) {
      for (let k = 0; k < 2; k++) {
        const ph = k * 2.4;
        const ax = 0.5 + Math.sin(t * 0.11 + ph) * 0.30 + Math.sin(t * 0.047 + ph * 3.0) * 0.12;
        const ay = 0.5 + Math.cos(t * 0.083 + ph) * 0.26 + Math.cos(t * 0.061 + ph * 2.0) * 0.10;
        const fx = Math.cos(t * 0.19 + ph) * 22 + Math.cos(t * 0.11) * 16 * (k ? -1 : 1);
        const fy = Math.sin(t * 0.16 + ph) * 20 + Math.sin(t * 0.09) * 14;
        splat(ax, ay, fx * dt * 60, fy * dt * 60, 0.016 * dt * 60 * (0.6 + 0.4 * Math.sin(t * 0.5 + ph)), 0.014);
      }
    }

    gl!.bindVertexArray(quad);
    gl!.disable(gl!.BLEND);
    const tx = vel.texel;

    gl!.useProgram(PROG.curl.p);
    gl!.uniform2f(PROG.curl.u.texel, tx[0], tx[1]);
    gl!.uniform1i(PROG.curl.u.uVel, vel.read.attach(0));
    blit(curlT);
    gl!.useProgram(PROG.vort.p);
    gl!.uniform2f(PROG.vort.u.texel, tx[0], tx[1]);
    gl!.uniform1i(PROG.vort.u.uVel, vel.read.attach(0));
    gl!.uniform1i(PROG.vort.u.uCurl, curlT.attach(1));
    gl!.uniform1f(PROG.vort.u.curl, O.curl);
    gl!.uniform1f(PROG.vort.u.dt, dt);
    blit(vel.write); vel.swap();

    gl!.useProgram(PROG.diverge.p);
    gl!.uniform2f(PROG.diverge.u.texel, tx[0], tx[1]);
    gl!.uniform1i(PROG.diverge.u.uVel, vel.read.attach(0));
    blit(div);
    gl!.useProgram(PROG.pressure.p);
    gl!.uniform2f(PROG.pressure.u.texel, tx[0], tx[1]);
    gl!.uniform1i(PROG.pressure.u.uDiv, div.attach(0));
    for (let i = 0; i < O.pressureIters; i++) {
      gl!.uniform1i(PROG.pressure.u.uPres, pres.read.attach(1));
      blit(pres.write); pres.swap();
    }
    gl!.useProgram(PROG.gradient.p);
    gl!.uniform2f(PROG.gradient.u.texel, tx[0], tx[1]);
    gl!.uniform1i(PROG.gradient.u.uPres, pres.read.attach(0));
    gl!.uniform1i(PROG.gradient.u.uVel, vel.read.attach(1));
    blit(vel.write); vel.swap();

    gl!.useProgram(PROG.advect.p);
    gl!.uniform2f(PROG.advect.u.texel, tx[0], tx[1]);
    gl!.uniform1i(PROG.advect.u.uVel, vel.read.attach(0));
    gl!.uniform1i(PROG.advect.u.uSrc, vel.read.attach(0));
    gl!.uniform1f(PROG.advect.u.dt, dt);
    gl!.uniform1f(PROG.advect.u.diss, O.velocityDissipation);
    blit(vel.write); vel.swap();
    gl!.uniform2f(PROG.advect.u.texel, dye.texel[0], dye.texel[1]);
    gl!.uniform1i(PROG.advect.u.uVel, vel.read.attach(0));
    gl!.uniform1i(PROG.advect.u.uSrc, dye.read.attach(1));
    gl!.uniform1f(PROG.advect.u.diss, O.densityDissipation);
    blit(dye.write); dye.swap();

    const D = PROG.display, pal = O.palette;
    gl!.useProgram(D.p);
    gl!.uniform1i(D.u.uDye, dye.read.attach(0));
    gl!.uniform2f(D.u.texel, dye.texel[0], dye.texel[1]);
    gl!.uniform2f(D.u.uRes, cv.width, cv.height);
    gl!.uniform1f(D.u.uT, t);
    gl!.uniform3fv(D.u.uDeep, pal.deep); gl!.uniform3fv(D.u.uViolet, pal.violet);
    gl!.uniform3fv(D.u.uLav, pal.lav); gl!.uniform3fv(D.u.uPale, pal.pale);
    gl!.uniform1f(D.u.uGain, O.gain); gl!.uniform1f(D.u.uShade, O.shade);
    gl!.uniform1f(D.u.uGlow, O.glow); gl!.uniform1f(D.u.uHaze, O.haze);
    gl!.uniform1f(D.u.uStars, O.stars ? 1 : 0);
    gl!.uniform1f(D.u.uAber, O.aberration);
    blit(null);
  }

  const start = () => { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  start();

  return {
    opts: O, splat, step: tick, stop, start,
    destroy() {
      stop();
      removeEventListener('resize', onResize); removeEventListener('pointermove', onMove);
      removeEventListener('touchstart', onTouchStart); removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('mouseleave', onLeave);
      gl!.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
