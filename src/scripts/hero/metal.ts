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
  /* a little under a retina screen's own resolution: the edges are soft
     and dark, and the difference cannot be seen, only paid for */
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, narrow ? 1.25 : 1.5));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0, 8.5);

  /* ── the room it reflects: seen only by the camera inside the scene ── */
  const ROOM = 1;
  const room = new THREE.Group();
  const strip = (w: number, h: number, x: number, y: number, z: number, ry: number, rz = 0, k = 1) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k * 1.04), side: THREE.DoubleSide }));
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
  strip(0.35, 14, -1.8, 0, 9, 0, 0.1, 0.9);
  strip(0.25, 12, -7, 0, 0, Math.PI / 2, 0, 0.7);
  strip(0.25, 12, 7, 0, 0, -Math.PI / 2, 0, 0.55);
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
    metalness: 1, roughness: 0.08,
    transparent: true, opacity: 0.72, clearcoat: 1, clearcoatRoughness: 0.05,
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


  /* ── sizing: the mark about half the screen's shorter side ── */
  const fit = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    // a portrait screen pulls the camera back, so the mark keeps to the width
    camera.position.z = camera.aspect < 1 ? 8.5 / Math.max(0.55, camera.aspect) : 8.5;
    camera.updateProjectionMatrix();
  };
  fit();
  addEventListener('resize', fit);

  /* ── the pointer: the whole leans towards it, and a piece under it flares ── */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2(9, 9);
  let mx = 0, my = 0, tmx = 0, tmy = 0;
  let hovered: Piece | null = null;
  const onMove = (e: PointerEvent) => {
    tmx = (e.clientX / innerWidth) * 2 - 1; tmy = -(e.clientY / innerHeight) * 2 + 1;
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
  const frames = handoverSection() ? Array.from(handoverSection()!.querySelectorAll<HTMLElement>('.run .frame')) : [];
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
    /* the picture itself, at the size the page chose for it */
    const src = img.currentSrc || img.src;
    loader.load(src, (tex) => {
      if (gone) { tex.dispose(); return; }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      u.uTex.value = tex;
      sheet.ready = true;
      /* drawn here now: the page's own is kept, unseen, for the rest */
      img.style.visibility = 'hidden';
      frame.style.background = 'transparent';
      wake();
    });
  }
  let lastY = scrollY, speed = 0, push = 0;

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
    const p = scrollY / innerHeight;
    /* spread over most of two screens, so the surfaces leave slowly — but
       starting at once: eased out, not in, so the first turn of the wheel
       already lifts them, and they settle into their drift at the far end */
    const leave = 1 - Math.pow(1 - clamp01(p / 1.6), 2.4);
    const back = handover ? smooth((innerHeight - handover.getBoundingClientRect().top) / (innerHeight * 0.85)) : 0;
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

    const breathe = BREATHE * (0.5 + 0.5 * Math.sin(t * 0.8));
    for (const pc of pieces) {
      pc.group.position.copy(pc.dir).multiplyScalar(breathe);
      pc.flash *= 0.92;
      const f = pc.flash;
      pc.mat.envMapIntensity = 3 + 1.6 * f;
      pc.mat.roughness = Math.max(0.02, 0.08 - 0.06 * f);
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
    const W = innerWidth, H = innerHeight;
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
    if (!covered) raf = requestAnimationFrame(frame);
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
      removeEventListener('resize', fit);
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
