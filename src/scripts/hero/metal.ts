/* ═══════════════════════════════════════════════════════════════════
   The hero as a solid mark: a trial, chosen on the address with
   `?hero=metal`. The way trionn.com builds theirs, done to ours.

   No model file. The mark's three faces are the logo's own outlines
   (lib/lettermark), pushed into depth with a hair of bevel on every
   edge to catch the light, each face its own piece. The material is
   dark polished metal that lets a third of the light through, under a
   clear coat. What makes it read as expensive is what it reflects: a
   camera inside the scene records the room once — a few soft
   bright strips — and the mark mirrors that,
   so its highlights move as it turns. The pieces breathe apart and back
   together, the whole leans towards the pointer, and a piece under the
   pointer flares for a moment. Each piece is split into its surfaces:
   as the page arrives they fly in to an outline already standing, and
   as the hero is scrolled past they come away again and return, the
   mark moving down the screen as it reassembles.

   It answers the page as the particle hero does, and stops drawing once
   the hero has gone by.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import type { Hero } from './index';
import { SYMBOL } from '../../lib/lettermark';
import { stableHeight, sizeChanged } from '../ui/viewport';

export interface MetalOptions { host: HTMLElement }

/** how deep the faces are pushed, in the mark's own units (it is ~184 wide) */
const DEPTH = 26;
/** how far the pieces drift apart at rest, and on the way out */
const BREATHE = 0.09;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** the section before the studios, whose run of pictures this also draws */
const handoverSection = () => document.getElementById('studios-title')?.closest('section') ?? null;

export function createMetalHero({ host }: MetalOptions): Hero {
  const narrow = matchMedia('(max-width: 719px)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  /* a retina screen's own resolution: the pictures of the handover section
     are drawn by this canvas too, and at less than that they read soft next
     to the page's own type */
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, narrow ? 1.75 : 2));
  renderer.setSize(innerWidth, stableHeight(), false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, innerWidth / stableHeight(), 0.1, 100);
  camera.position.set(0, 0, 8.5);

  /* ── the room it reflects: seen only by the camera inside the scene ── */
  const ROOM = 1;
  const room = new THREE.Group();
  /* Every light is a soft glow, bright in its middle and fading to nothing
     at its edges: a hard-edged panel mirrored in a smooth face showed as
     the panel — its corners and its straight sides — and read as cheap.
     A softbox photographed is a glow, not a rectangle. */
  const glow = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const img = g.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const u = Math.abs(x / 63.5 - 1), v = Math.abs(y / 63.5 - 1);
      const f = Math.pow(Math.max(0, 1 - u * u), 1.6) * Math.pow(Math.max(0, 1 - v * v), 1.6);
      const i = (y * 128 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(f * 255);
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const strip = (w: number, h: number, x: number, y: number, z: number, ry: number, rz = 0, k = 1) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      color: new THREE.Color(k, k, k * 1.04), map: glow, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(0, ry, rz); m.layers.set(ROOM); room.add(m); return m;
  };
  /* The room is black. Theirs reads as premium because the faces stay
     dark, near see-through, and the shape is drawn by its edges catching
     light — so almost nothing here is lit, and what is, is placed to be
     caught by an edge rather than filled into a face. */
  const walls = new THREE.Mesh(new THREE.SphereGeometry(20, 16, 8), new THREE.MeshBasicMaterial({ color: 0x2a2a2e, side: THREE.BackSide }));
  walls.layers.set(ROOM); room.add(walls);
  /* warm gold overhead: every edge and step that faces up glows with it */
  const gold = strip(14, 3, 0, 6, 0, 0, 0, 1);
  gold.rotation.x = Math.PI / 2;
  (gold.material as THREE.MeshBasicMaterial).color.setRGB(1.0, 0.62, 0.26);
  /* one narrow cool glint behind the viewer, that slides across a face as
     it turns, and a thin one to either side for the vertical edges */
  strip(1.2, 16, -1.8, 0, 9, 0, 0.1, 0.9);
  /* and a large soft one behind the viewer, off to one side, for the big
     faces: they look straight back, and this is what they see — a wide
     glow that slides across them as the mark turns */
  strip(9, 11, 3.2, 1.5, 9, 0, 0, 0.38);
  strip(1.1, 14, -7, 0, 0, Math.PI / 2, 0, 0.7);
  strip(1.1, 14, 7, 0, 0, -Math.PI / 2, 0, 0.55);
  scene.add(room);


  /* the camera inside: six small renders of the room, made once */
  const cubeRT = new THREE.WebGLCubeRenderTarget(narrow ? 128 : 256, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cubeCam = new THREE.CubeCamera(0.1, 100, cubeRT);
  cubeCam.children.forEach((c) => c.layers.enable(ROOM));
  scene.add(cubeCam);

  /* ── the mark: the logo's own outlines, pushed into depth ── */
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SYMBOL.viewBox}">${SYMBOL.paths.map((d) => `<path d="${d}"/>`).join('')}</svg>`;
  const parsed = new SVGLoader().parse(svg);
  const cx = SYMBOL.box.x + SYMBOL.box.w / 2, cy = SYMBOL.box.y + SYMBOL.box.h / 2;
  const S = 1 / 100;
  const baseMat = new THREE.MeshPhysicalMaterial({
    color: 0x3a3d42, emissive: new THREE.Color(0x0e1320), emissiveIntensity: 0.15,
    /* no `transmission`: it draws the whole scene a second time every frame
       to fake light passing through, and on a black ground plain
       transparency reads the same */
    /* smooth, but not a mirror: enough roughness that what it reflects is a
       blur of light, the way satin metal takes a softbox */
    metalness: 1, roughness: 0.2,
    transparent: true, opacity: 0.72, clearcoat: 1, clearcoatRoughness: 0.14,
    envMap: cubeRT.texture, envMapIntensity: 3, side: THREE.DoubleSide, depthWrite: false,
  });

  /* A piece comes apart into its surfaces — each flat face and each strip
     of the bevel — and they leave one by one, the outline left standing.
     It stays ONE mesh throughout: every vertex carries which surface it
     belongs to (that surface's middle, where it flies to, how it turns and
     when it goes), and the graphics card moves them. Split into separate
     meshes, the see-through faces were blended in a different order the
     moment the break-up began and the reflections jumped; one mesh, in the
     triangle order of the whole, looks exactly the same at rest and costs
     one draw instead of dozens. Triangles are grouped by the plane they lie
     in. */
  const hash = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const burstable = (geo: THREE.BufferGeometry, seed: number) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const pos = g.attributes.position.array as ArrayLike<number>;
    const nrm = g.attributes.normal.array as ArrayLike<number>;
    const tris = pos.length / 9;
    /* which surface each triangle is on */
    const keyOf: string[] = [];
    const members = new Map<string, number[]>();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    for (let t = 0; t < tris; t++) {
      a.fromArray(pos, t * 9); b.fromArray(pos, t * 9 + 3); c.fromArray(pos, t * 9 + 6);
      n.subVectors(c, b).cross(a.clone().sub(b)).normalize();
      const key = Number.isFinite(n.x)
        ? `${Math.round(n.x * 12)},${Math.round(n.y * 12)},${Math.round(n.z * 12)},${Math.round(n.dot(a) * 40)}`
        : `degenerate-${t}`;
      keyOf.push(key);
      (members.get(key) ?? members.set(key, []).get(key)!).push(t);
    }
    /* each surface: its middle, where it goes, how it turns, when */
    type Plan = { home: THREE.Vector3; out: THREE.Vector3; axis: THREE.Vector3; spin: number; lag: number };
    const plans = new Map<string, Plan>();
    let k = 0;
    const box = new THREE.Box3();
    for (const [key, list] of members) {
      box.makeEmpty();
      for (const t of list) for (let v = 0; v < 3; v++) box.expandByPoint(a.fromArray(pos, t * 9 + v * 3));
      const home = box.getCenter(new THREE.Vector3());
      const face = new THREE.Vector3().fromArray(nrm, list[0] * 9).normalize();
      const r = (q: number) => hash(seed * 97 + k * 13 + q);
      /* A long way: out across the screen, not just off the middle — most of
         the way to the edges, and some right past them. Mostly across the
         page's plane; a little towards or away, never through the viewer. */
      const ang = r(1) * Math.PI * 2;
      const reach = 0.9 + Math.pow(r(2), 1.6) * 4.2;
      const out = new THREE.Vector3(Math.cos(ang) * reach * 1.35, Math.sin(ang) * reach, (r(3) - 0.6) * 3.2)
        .add(face.multiplyScalar(0.8));
      plans.set(key, { home, out, axis: new THREE.Vector3(r(5) - 0.5, r(6) - 0.5, r(7) - 0.5).normalize(),
                       spin: (r(8) - 0.5) * 4, lag: r(9) * 0.55 });
      k++;
    }
    /* the whole's own triangle order, each vertex written about its surface */
    const P = new Float32Array(tris * 9), H = new Float32Array(tris * 9), O = new Float32Array(tris * 9),
          X = new Float32Array(tris * 9), SP = new Float32Array(tris * 3), LG = new Float32Array(tris * 3);
    for (let t = 0; t < tris; t++) {
      const pl = plans.get(keyOf[t])!;
      for (let v = 0; v < 3; v++) {
        const i = t * 3 + v;
        P[i * 3] = pos[i * 3] - pl.home.x; P[i * 3 + 1] = pos[i * 3 + 1] - pl.home.y; P[i * 3 + 2] = pos[i * 3 + 2] - pl.home.z;
        pl.home.toArray(H, i * 3); pl.out.toArray(O, i * 3); pl.axis.toArray(X, i * 3);
        SP[i] = pl.spin; LG[i] = pl.lag;
      }
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(P, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nrm as ArrayLike<number> as Float32Array), 3));
    out.setAttribute('aHome', new THREE.BufferAttribute(H, 3));
    out.setAttribute('aOut', new THREE.BufferAttribute(O, 3));
    out.setAttribute('aAxis', new THREE.BufferAttribute(X, 3));
    out.setAttribute('aSpin', new THREE.BufferAttribute(SP, 1));
    out.setAttribute('aLag', new THREE.BufferAttribute(LG, 1));
    return out;
  };

  /* the break-up, in the vertex shader: each vertex turned about its
     surface's middle and carried out along that surface's path, by how far
     the mark is apart (uE) — each surface on its own clock */
  const teach = (mat: THREE.MeshPhysicalMaterial) => {
    const u = { uE: { value: 0 }, uDrift: { value: 0 } };
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float uE; uniform float uDrift;
          attribute vec3 aHome; attribute vec3 aOut; attribute vec3 aAxis; attribute float aSpin; attribute float aLag;
          vec3 burstTurn(vec3 v, vec3 k, float a) { float c = cos(a), s = sin(a); return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c); }`)
        .replace('#include <beginnormal_vertex>', `
          float bx = clamp((uE - aLag) / (1.0 - aLag), 0.0, 1.0);
          float bk = bx * bx * (3.0 - 2.0 * bx);
          float ba = aSpin * bk * (1.0 + uDrift * 0.3);
          vec3 objectNormal = burstTurn(vec3(normal), aAxis, ba);
          #ifdef USE_TANGENT
            vec3 objectTangent = vec3( tangent.xyz );
          #endif`)
        .replace('#include <begin_vertex>', `vec3 transformed = burstTurn(vec3(position), aAxis, ba) + aHome + aOut * bk;`);
    };
    mat.customProgramCacheKey = () => 'burst';
    return u;
  };

  /* The outline, from the logo's own shape rather than read off the solid:
     the contour on the front face, the same on the back, and a line down
     every corner joining the two. Read off the solid by angle, the bevels
     split each corner into steps too shallow to count, and some corners
     were never drawn. Each contour is a hair outside its face, so the line
     sits on the edge rather than inside the glass. */
  const outline = (shape: THREE.Shape) => {
    const zF = (DEPTH / 2 + 1.6) * S, zB = -zF;
    const seg: number[] = [];
    const loops = [shape.extractPoints(8).shape, ...shape.extractPoints(8).holes];
    for (const pts of loops) {
      const ring = pts.slice();
      if (ring.length > 1 && ring[0].equals(ring[ring.length - 1])) ring.pop();
      const at = (v: THREE.Vector2) => [(v.x - cx) * S, -(v.y - cy) * S];
      for (let i = 0; i < ring.length; i++) {
        const [ax, ay] = at(ring[i]), [bx, by] = at(ring[(i + 1) % ring.length]);
        seg.push(ax, ay, zF, bx, by, zF);          // front
        seg.push(ax, ay, zB, bx, by, zB);          // back
        seg.push(ax, ay, zF, ax, ay, zB);          // the corner, front to back
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    return g;
  };

  const mark = new THREE.Group();
  type Piece = { group: THREE.Group; mat: THREE.MeshPhysicalMaterial; edges: THREE.LineBasicMaterial;
                 dir: THREE.Vector3; burst: { uE: { value: number }; uDrift: { value: number } }; flash: number };
  const pieces: Piece[] = [];
  const hitList: THREE.Mesh[] = [];
  const owner = new Map<THREE.Object3D, Piece>();
  parsed.paths.forEach((p, pi) => {
    for (const shape of SVGLoader.createShapes(p)) {
      const geo = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: true, bevelThickness: 1.6, bevelSize: 1.3, bevelSegments: 3, curveSegments: 8 });
      // into the page's own frame: centred, y up, a unit about a metre
      geo.translate(-cx, -cy, -DEPTH / 2);
      geo.scale(S, -S, S);
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      const c = new THREE.Vector3(); geo.boundingBox!.getCenter(c);
      const mat = baseMat.clone();
      const group = new THREE.Group();
      /* the outline: every edge of the piece, the back ones seen through the
         glass — and what is left standing when the surfaces come away */
      const edgeMat = new THREE.LineBasicMaterial({ color: 0x8c96a6, transparent: true, opacity: 0.3, depthTest: false });
      group.add(new THREE.LineSegments(outline(shape), edgeMat));
      /* one mesh, that comes apart in the vertex shader; and the solid as it
         is, never drawn, for the pointer to find */
      const burst = teach(mat);
      const mesh = new THREE.Mesh(burstable(geo, pi + 1), mat);
      mesh.frustumCulled = false;
      const probe = new THREE.Mesh(geo, mat);
      probe.visible = false;
      const piece: Piece = { group, mat, edges: edgeMat, dir: c.clone().setZ(0).normalize(), burst, flash: 0 };
      group.add(mesh, probe); hitList.push(probe); owner.set(probe, piece);
      mark.add(group);
      pieces.push(piece);
    }
  });
  scene.add(mark);

  /* a little direct light, for the bevels */
  const top = new THREE.DirectionalLight(0xffa24a, 2.2); top.position.set(0.5, 6, 1.5); scene.add(top);
  const rim = new THREE.DirectionalLight(0xff9a50, 1.2); rim.position.set(4, 2, -5); scene.add(rim);
  const cool = new THREE.DirectionalLight(0xffffff, 0.55); cool.position.set(-4, 0, 4); scene.add(cool);

  /* ── the pull: lights drawn in through the mark's open middle ──
     The mark is hollow at its heart — a tunnel front to back between the
     three faces — and it pulls. Points of light come from our side of the
     screen, from around and just past the viewer, and are drawn in to
     the opening like matter to a black hole: spiralling inward, quicker
     and quicker, a streak and a flash as they pass through, then gone into
     the dark behind it, small and far. The paths live in the mark's own
     space, so they turn with it. The part of anything behind the mark is
     drawn under the glass, the part in front over it. */
  const PATHS = narrow ? 50 : 110, RUNNERS = PATHS, TRAIL = 5, SHOW_LINES = false;
  const threadU = { uTime: { value: 0 }, uE: { value: 0 }, uShow: { value: 0 }, uPx: { value: 1 }, uDpr: { value: renderer.getPixelRatio() } };
  /* the same slow sway, here and in the shader, so the lights stay on their line */
  const SWAY = `
    float amp = smoothstep(0.5, 5.0, abs(p.z)) * 0.3 * uE;
    p.y += sin(uTime * 0.4 + p.z * 0.22 + aSeed * 6.28) * amp;`;
  const sway = (v: THREE.Vector3, t: number, e: number, seed: number) => {
    const amp = smooth((Math.abs(v.z) - 0.5) / 4.5) * 0.3 * e;
    v.y += Math.sin(t * 0.4 + v.z * 0.22 + seed * 6.28) * amp;
    return v;
  };
  const threadVert = `
    uniform float uTime; uniform float uE;
    attribute float aSeed;
    varying float vS; varying float vZ;
    void main() {
      vec3 p = position;${SWAY}
      vS = uv.x; vZ = p.z;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`;
  const threadFrag = (front: boolean) => `
    uniform float uShow;
    varying float vS; varying float vZ;
    void main() {
      if (${front ? 'vZ < 0.0' : 'vZ >= 0.0'}) discard;
      /* one quiet tone its whole length, fading only where it leaves the screen */
      float ends = smoothstep(0.0, 0.12, vS) * smoothstep(1.0, 0.88, vS);
      gl_FragColor = vec4(vec3(0.85, 0.85, 0.87), 0.2 * ends * uShow);
      #include <colorspace_fragment>
    }`;
  const runnerVert = `
    uniform float uPx; uniform float uDpr;
    attribute float aSize; attribute float aGlow;
    varying float vZ; varying float vGlow;
    void main() {
      vZ = position.z; vGlow = aGlow;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      /* never a blot, however near it passes */
      gl_PointSize = min(aSize * uPx / -mv.z, 7.0 * uDpr);
      gl_Position = projectionMatrix * mv;
    }`;
  const runnerFrag = (front: boolean) => `
    uniform float uShow;
    varying float vZ; varying float vGlow;
    void main() {
      if (${front ? 'vZ < 0.0' : 'vZ >= 0.0'}) discard;
      float r = length(gl_PointCoord - 0.5) * 2.0;
      float soft = smoothstep(1.0, 0.0, r);
      gl_FragColor = vec4(vec3(1.0), soft * soft * vGlow * uShow);
      #include <colorspace_fragment>
    }`;
  const pair = (vert: string, frag: (f: boolean) => string, blending: THREE.Blending) => [false, true].map((front) =>
    new THREE.ShaderMaterial({ uniforms: threadU, vertexShader: vert, fragmentShader: frag(front),
      transparent: true, depthTest: false, depthWrite: false, blending }));
  const [threadBack, threadFront] = pair(threadVert, threadFrag, THREE.NormalBlending);
  const [runBack, runFront] = pair(runnerVert, runnerFrag, THREE.AdditiveBlending);

  type Thread = { curve: THREE.CatmullRomCurve3; seed: number; hole: number };
  const lines: Thread[] = [];
  const threads = new THREE.Group();
  /* Each path, from near the camera to far behind: it starts wide, off
     to one side at our end, and closes in on the opening as it comes —
     turning about it as it closes, the way things spiral into a drain —
     through the middle, and swallowed by the dark just behind it. */
  const NEAR = 2, FAR = -0.6;
  for (let i = 0; i < PATHS; i++) {
    const r = (q: number) => hash(i * 31.7 + q * 5.3 + 2);
    /* where it starts around the opening, spread evenly with a little play */
    const a0 = ((i + r(1) * 0.6) / PATHS) * Math.PI * 2;
    const r0 = 1.1 + r(2) * 1.9;
    /* either way round: no one current, the space itself drawn in */
    const twist = (r(3) < 0.5 ? -1 : 1) * (0.5 + r(7) * 0.7);
    /* where in the opening it passes: near the middle, a little apart */
    const hx = (r(5) - 0.5) * 0.24, hy = (r(6) - 0.5) * 0.16;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 120; k++) {
      const z = NEAR + (FAR - NEAR) * (k / 120);
      /* in front: wide at our end, closing to the opening, faster near it */
      const f = z > 0 ? Math.pow(z / NEAR, 1.3) : 0;
      /* behind: straight on down the line through the hole */
      const b = 0;
      const ang = a0 + twist * (1 - f) * 1.6;
      const rad = r0 * f + b;
      pts.push(new THREE.Vector3(hx + Math.cos(ang) * rad * 1.3, hy + Math.sin(ang) * rad, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    /* the point of the line inside the opening: where it crosses the mark's middle plane */
    let hole = 0.5, best = Infinity;
    const v = new THREE.Vector3();
    for (let k = 0; k <= 800; k++) { const u = k / 800; curve.getPointAt(u, v); if (Math.abs(v.z) < best) { best = Math.abs(v.z); hole = u; } }
    const seed = r(4);
    lines.push({ curve, seed, hole });
    /* the paths themselves are not drawn, only the lights on them */
    if (!SHOW_LINES) continue;
    const geo = new THREE.TubeGeometry(curve, 900, 0.0035, 5, false);
    geo.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(seed), 1));
    const back = new THREE.Mesh(geo, threadBack), front = new THREE.Mesh(geo, threadFront);
    back.renderOrder = -1; front.renderOrder = 10;
    back.frustumCulled = front.frustumCulled = false;
    threads.add(back, front);
  }

  /* the lights: each a bright head on its path with a tail behind it, one
     continuous fading streak — long when it is fast, gathered when slow */
  const runners = Array.from({ length: RUNNERS }, (_, k) => ({ line: k % PATHS, u: hash(k * 3.7 + 11) }));
  const RP = new Float32Array(RUNNERS * TRAIL * 3), RS = new Float32Array(RUNNERS * TRAIL), RG = new Float32Array(RUNNERS * TRAIL);
  for (let k = 0; k < RUNNERS; k++) for (let j = 0; j < TRAIL; j++) RS[k * TRAIL + j] = j === 0 ? 0.018 : 0;
  const runGeo = new THREE.BufferGeometry();
  runGeo.setAttribute('position', new THREE.BufferAttribute(RP, 3));
  runGeo.setAttribute('aSize', new THREE.BufferAttribute(RS, 1));
  runGeo.setAttribute('aGlow', new THREE.BufferAttribute(RG, 1));
  /* the tail: the same points joined up, one segment to the next */
  const tailIdx: number[] = [];
  for (let k = 0; k < RUNNERS; k++) for (let j = 0; j < TRAIL - 1; j++) tailIdx.push(k * TRAIL + j, k * TRAIL + j + 1);
  const tailGeo = new THREE.BufferGeometry();
  tailGeo.setAttribute('position', runGeo.attributes.position);
  tailGeo.setAttribute('aGlow', runGeo.attributes.aGlow);
  tailGeo.setIndex(tailIdx);
  const tailVert = `
    attribute float aGlow;
    varying float vZ; varying float vGlow;
    void main() {
      vZ = position.z; vGlow = aGlow;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;
  const tailFrag = (front: boolean) => `
    uniform float uShow;
    varying float vZ; varying float vGlow;
    void main() {
      if (${front ? 'vZ < 0.0' : 'vZ >= 0.0'}) discard;
      gl_FragColor = vec4(vec3(1.0), vGlow * 0.8 * uShow);
      #include <colorspace_fragment>
    }`;
  const [tailBack, tailFront] = pair(tailVert, tailFrag, THREE.AdditiveBlending);
  for (const [m, order] of [[tailBack, -1], [tailFront, 11]] as const) {
    const tl = new THREE.LineSegments(tailGeo, m);
    tl.renderOrder = order; tl.frustumCulled = false;
    threads.add(tl);
  }
  for (const m of [runBack, runFront]) {
    const pts = new THREE.Points(runGeo, m);
    pts.renderOrder = m === runBack ? -1 : 11;
    pts.frustumCulled = false;
    threads.add(pts);
  }
  /* how fast a light moves at a place on its line: a slow drift far out, and
     a pull that grows sharply towards the opening */
  const pull = (d: number) => 0.04 + 0.004 / (d + 0.015);
  const rv = new THREE.Vector3();
  const moveRunners = (dt: number, t: number, e: number) => {
    for (let k = 0; k < RUNNERS; k++) {
      const rn = runners[k], ln = lines[rn.line];
      const sp = pull(Math.abs(rn.u - ln.hole));
      rn.u += sp * dt;
      if (rn.u > 1) rn.u -= 1;
      for (let j = 0; j < TRAIL; j++) {
        /* the tail: the same path, a little behind, by how fast it goes */
        const u = rn.u - j * sp * 0.004;
        const i = k * TRAIL + j;
        if (u < 0) { RG[i] = 0; continue; }
        sway(ln.curve.getPointAt(u, rv), t, e, ln.seed).toArray(RP, i * 3);
        /* seen only near the mark: out of nothing as it closes in, and gone
           the moment it reaches the opening */
        const z = RP[i * 3 + 2];
        const ends = smooth((NEAR - z) / 0.9) * smooth((z - 0.05) / 0.35);
        RG[i] = Math.pow(1 - j / TRAIL, 1.2) * 0.5 * ends;
      }
    }
    runGeo.attributes.position.needsUpdate = true;
    runGeo.attributes.aGlow.needsUpdate = true;
  };
  mark.add(threads);




  /* ── sizing: the mark about half the screen's shorter side ── */
  const fit = () => {
    renderer.setSize(innerWidth, stableHeight(), false);
    camera.aspect = innerWidth / stableHeight();
    // a portrait screen pulls the camera back, so the mark keeps to the width
    camera.position.z = camera.aspect < 1 ? 8.5 / Math.max(0.55, camera.aspect) : 8.5;
    camera.updateProjectionMatrix();
  };
  fit();
  /* only when the width changes — a browser bar sliding in on a phone is
     not a new screen, and resizing the canvas for it made the mark jump */
  let fitW = innerWidth, fitH = stableHeight();
  const onResize = () => {
    /* the resize listener in ui/viewport runs first and re-reads the height */
    if (!sizeChanged(fitW, fitH)) return;
    fitW = innerWidth; fitH = stableHeight();
    fit(); wake();
  };
  addEventListener('resize', onResize);

  /* ── the pointer: the whole leans towards it, and a piece under it flares ── */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2(9, 9);
  let mx = 0, my = 0, tmx = 0, tmy = 0;
  let hovered: Piece | null = null;
  const onMove = (e: PointerEvent) => {
    tmx = (e.clientX / innerWidth) * 2 - 1; tmy = -(e.clientY / stableHeight()) * 2 + 1;
    ndc.set(tmx, tmy);
    moved = true;
  };
  addEventListener('pointermove', onMove, { passive: true });

  /* ── the pictures of the handover section, drawn here too ──
     The run of pictures under 'Before it exists' is drawn by this canvas
     as well as by the page: five planes in a second scene, measured off the
     page's own pictures every frame and laid exactly over them, in screen
     pixels. Drawn here they can answer what is behind them: they bow with
     the speed of the scroll, like sheets flexing, and settle flat when it
     stops; and where the mark stands behind one, the picture swells softly
     over it, as a lens would. The page's own pictures stay, hidden, for
     everything that is not this canvas — and come back if it goes. */
  const flat = new THREE.Scene();
  const flatCam = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10);
  const RADIUS = 6;
  /* A sheet over a ball: where the mark stands behind a picture, the
     picture is pushed out towards the viewer — the paper swells there,
     bigger as it comes nearer, lit on the side the light is and shaded on
     the other — and only while the page is moving. Still, it lies flat. */
  const sheetVert = `
    uniform vec2 uMark; uniform float uR; uniform float uAmp;
    varying vec2 vUv; varying vec2 vD; varying float vH;
    void main() {
      vUv = uv;
      vec4 w = modelMatrix * vec4(position, 1.0);
      vec2 d = vec2(w.x, -w.y) - uMark;
      float h = uAmp * exp(-dot(d, d) / (uR * uR));
      /* nearer is bigger: pushed out from the ball's middle as it rises */
      w.xy += vec2(d.x, -d.y) * h * 0.32;
      vD = d; vH = h;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`;
  const sheetFrag = `
    uniform sampler2D uTex; uniform vec2 uSize; uniform vec2 uCover; uniform float uR; uniform float uRadius;
    varying vec2 vUv; varying vec2 vD; varying float vH;
    void main() {
      /* the corner the page's pictures take */
      vec2 q = abs(vUv - 0.5) * uSize - (uSize * 0.5 - uRadius);
      if (length(max(q, 0.0)) - uRadius > 0.0) discard;
      vec2 uv = (vUv - 0.5) * uCover + 0.5;
      vec3 col = texture2D(uTex, uv).rgb;
      /* the swell's slope, lit from above and to the left: brighter where it
         faces the light, darker where it turns away — the paper's shading */
      vec2 slope = -2.0 * vD / (uR * uR) * vH * uR;
      float lit = dot(normalize(vec3(-slope.x, slope.y, 1.0)), normalize(vec3(-0.45, 0.55, 0.7)));
      float level = dot(vec3(0.0, 0.0, 1.0), normalize(vec3(-0.45, 0.55, 0.7)));
      col *= 1.0 + (lit - level) * 1.4 + vH * 0.04;
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`;
  type Sheet = { frame: HTMLElement; img: HTMLImageElement; mesh: THREE.Mesh; u: Record<string, THREE.IUniform>; ready: boolean };
  const sheets: Sheet[] = [];
  const loader = new THREE.TextureLoader();
  /* Not on a touch screen — a phone or a tablet keeps the page's own
     pictures: the effect answers a pointer and a wheel, and a phone has
     neither, only the cost of drawing five large pictures every frame. */
  const touch = matchMedia('(hover: none), (pointer: coarse)').matches;
  const frames = !touch && handoverSection() ? Array.from(handoverSection()!.querySelectorAll<HTMLElement>('.run .frame')) : [];
  for (const frame of frames) {
    const img = frame.querySelector('img');
    if (!img) continue;
    const u: Record<string, THREE.IUniform> = {
      uTex: { value: null }, uSize: { value: new THREE.Vector2(1, 1) }, uCover: { value: new THREE.Vector2(1, 1) },
      uMark: { value: new THREE.Vector2() }, uR: { value: 1 }, uAmp: { value: 0 },
      uRadius: { value: RADIUS },
    };
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 64, 48),
      new THREE.ShaderMaterial({ uniforms: u, vertexShader: sheetVert, fragmentShader: sheetFrag, depthTest: false, depthWrite: false }));
    mesh.visible = false;
    mesh.frustumCulled = false;
    flat.add(mesh);
    const sheet: Sheet = { frame, img, mesh, u, ready: false };
    sheets.push(sheet);
    /* the picture at the largest size it is made in, for a sharp texture at
       any width the column takes — not the size the page chose for its own */
    const ladder = (img.getAttribute('srcset') ?? '').split(',').map((c) => c.trim().split(/\s+/))
      .map(([u, w]) => ({ u, w: parseInt(w, 10) || 0 })).filter((c) => c.u).sort((a, b) => b.w - a.w);
    const src = ladder[0]?.u || img.currentSrc || img.src;
    loader.load(src, (tex) => {
      if (gone) { tex.dispose(); return; }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      u.uTex.value = tex;
      sheet.ready = true;
      /* drawn here now: the page's own is kept, unseen, for the rest */
      img.style.visibility = 'hidden';
      frame.style.background = 'transparent';
      wake();
    });
  }
  let lastY = scrollY, speed = 0, push = 0, eased = scrollY;

  let released = false, intro = 0, raf = 0, gone = false, recorded = false;
  let moved = false;
  const clock = new THREE.Clock();
  /* the section that brings it back together, and the light half that ends it */
  const handover = handoverSection();
  const light = document.querySelector<HTMLElement>('[data-light]');
  const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

  const frame = () => {
    raf = 0;
    if (gone) return;
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;
    if (released) intro = Math.min(1, intro + dt / 3.2);
    const ei = smooth(intro);

    /* The scroll, read here rather than handed in. As the hero leaves, the
       mark comes apart: the surfaces fly off across the screen and past its
       edges, and the logo's outline is left standing in the middle. It stays
       that way through the dark half — the band, the statement, the clients
       — and only as the section before the studios arrives does it all
       come back to the middle and close. It is never faded: the first
       studio, on the light, simply rides up over it. */
    /* The scroll, eased: the break-up glides after the page rather than
       snapping to it. On a phone the scroll arrives in bursts, and driven
       straight off it the pieces jumped with every one. */
    const vh = stableHeight();
    eased += (scrollY - eased) * (1 - Math.exp(-dt * 7));
    if (Math.abs(scrollY - eased) < 0.5) eased = scrollY;
    const p = eased / vh;
    /* spread over most of two screens, so the surfaces leave slowly — but
       starting at once: eased out, not in, so the first turn of the wheel
       already lifts them, and they settle into their drift at the far end */
    const leave = 1 - Math.pow(1 - clamp01(p / 1.6), 2.4);
    /* the handover's place, taken back by however far the eased scroll
       still trails the page, so it glides with everything else */
    const back = handover ? smooth((vh - (handover.getBoundingClientRect().top + (scrollY - eased))) / (vh * 0.85)) : 0;
    const covered = light ? light.getBoundingClientRect().top <= 0 : false;
    const vis = 1;
    /* how far apart: all the way as the page arrives, then as the scroll says */
    const e = Math.max(1 - ei, leave * (1 - back));
    /* apart, it drifts: the far-flung surfaces keep turning, slowly */
    const drift = t * 0.12;

    mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
    /* turned just far enough, slowly, that its thickness and the light on
       its sides show — never so far that it stops reading as the mark —
       and leaning a little towards the pointer */
    mark.rotation.y = Math.sin(t * 0.22) * 0.42 * (1 - e * 0.6) + mx * 0.2;
    mark.rotation.x = Math.sin(t * 0.17) * 0.1 - my * 0.18;
    mark.position.y = Math.sin(t * 0.6) * 0.04;

    /* which piece is under the pointer: asked only when it has moved */
    if (moved) {
      moved = false;
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(hitList, false)[0];
      const now = hit ? owner.get(hit.object) ?? null : null;
      if (now && now !== hovered) now.flash = 1;
      hovered = now;
    }

    threadU.uTime.value = t;
    threadU.uE.value = e;
    /* in with the mark, and quieter once it is apart, under the dark half's words */
    threadU.uShow.value = ei * (1 - e * 0.4);
    threadU.uPx.value = renderer.domElement.height * 0.5 * camera.projectionMatrix.elements[5];
    moveRunners(dt, t, e);

    const breathe = BREATHE * (0.5 + 0.5 * Math.sin(t * 0.8));
    for (const pc of pieces) {
      pc.group.position.copy(pc.dir).multiplyScalar(breathe);
      pc.flash *= 0.92;
      const f = pc.flash;
      pc.mat.envMapIntensity = 3 + 1.6 * f;
      pc.mat.roughness = Math.max(0.08, 0.2 - 0.1 * f);
      pc.mat.emissiveIntensity = 0.15 + 0.1 * f;
      pc.mat.opacity = (0.88 - 0.16 * f) * vis * (1 - e * 0.35);
      /* the outline brightens as the surfaces leave it */
      /* the outline is only there while the mark is apart: whole, it is the
         solid alone */
      pc.edges.opacity = 0.3 * smooth(e * 1.6) * vis;
      pc.burst.uE.value = e;
      pc.burst.uDrift.value = drift;
    }

    /* the room sways slowly, so the highlights travel over the metal */
    const sway = Math.sin(t * 0.15) * 0.35;

    /* the room is recorded once, and the reflection is turned in place:
       re-recording it was six more renders of the scene every frame */
    if (!recorded) {
      mark.visible = false;
      cubeCam.update(renderer, scene);
      mark.visible = true;
      scene.remove(room);             // recorded: nothing else needs it
      recorded = true;
    }
    for (const pc of pieces) pc.mat.envMapRotation.set(0, sway, 0);
    renderer.autoClear = false;
    renderer.clear();
    renderer.render(scene, camera);

    /* the pictures: laid over the page's own, bowed by the scroll's speed,
       swelling where the mark stands behind them once it is whole again */
    const W = innerWidth, H = vh;
    flatCam.left = 0; flatCam.right = W; flatCam.top = 0; flatCam.bottom = -H;
    flatCam.updateProjectionMatrix();
    const dy = scrollY - lastY; lastY = scrollY;
    speed += (dy / Math.max(dt, 1 / 240) - speed) * 0.12;
    /* how hard the ball pushes: with the scroll's speed, easing in and out,
       and nothing at all once the page is still */
    push += (Math.min(1, Math.abs(speed) / 1800) - push) * 0.1;
    if (push < 0.002) push = 0;
    const markAt = new THREE.Vector3().setFromMatrixPosition(mark.matrixWorld).project(camera);
    const perUnit = H / (2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const whole = smooth(back / 0.5);
    let any = false;
    for (const sh of sheets) {
      if (!sh.ready) continue;
      const r = sh.frame.getBoundingClientRect();
      const on = r.bottom > -60 && r.top < H + 60;
      sh.mesh.visible = on;
      if (!on) continue;
      any = true;
      sh.mesh.position.set(r.left + r.width / 2, -(r.top + r.height / 2), 0);
      sh.mesh.scale.set(r.width, r.height, 1);
      sh.u.uSize.value.set(r.width, r.height);
      const tex = sh.u.uTex.value as THREE.Texture;
      const ia = (tex.image?.width ?? 1) / (tex.image?.height ?? 1), pa = r.width / r.height;
      sh.u.uCover.value.set(ia > pa ? pa / ia : 1, ia > pa ? 1 : ia / pa);
      sh.u.uMark.value.set((markAt.x * 0.5 + 0.5) * W, (-markAt.y * 0.5 + 0.5) * H);
      sh.u.uR.value = 1.05 * perUnit * mark.scale.x;
      sh.u.uAmp.value = push * whole;
    }
    if (any) { renderer.clearDepth(); renderer.render(flat, flatCam); }
    /* gone from view: nothing is drawn until the page comes back up */
    /* covered by the first studio: nothing is drawn until it is uncovered */
    if (!covered || eased !== scrollY) raf = requestAnimationFrame(frame);
  };
  const wake = () => { if (!raf && !gone) raf = requestAnimationFrame(frame); };
  const onScroll = () => wake();
  addEventListener('scroll', onScroll, { passive: true });
  wake();

  return {
    setReady() { released = true; },
    /* the page's own fade and exit are not used: the mark answers the
       scroll itself (above) */
    setOut() {},
    setExit() {},
    strike() {},
    showShape() {},
    destroy() {
      gone = true;
      if (raf) cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
      removeEventListener('pointermove', onMove);
      removeEventListener('scroll', onScroll);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
      cubeRT.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      for (const sh of sheets) { sh.img.style.visibility = ''; sh.frame.style.background = ''; (sh.u.uTex.value as THREE.Texture | null)?.dispose(); }
    },
  };
}
