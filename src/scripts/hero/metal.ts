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
   pointer flares for a moment.

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
  const walls = new THREE.Mesh(new THREE.SphereGeometry(20, 16, 8), new THREE.MeshBasicMaterial({ color: 0x020203, side: THREE.BackSide }));
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
  const mark = new THREE.Group();
  type Piece = { mesh: THREE.Mesh; mat: THREE.MeshPhysicalMaterial; dir: THREE.Vector3; flash: number };
  const pieces: Piece[] = [];
  parsed.paths.forEach((p) => {
    for (const shape of SVGLoader.createShapes(p)) {
      const geo = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: true, bevelThickness: 1.6, bevelSize: 1.3, bevelSegments: 3, curveSegments: 8 });
      // into the page's own frame: centred, y up, a unit about a metre
      geo.translate(-cx, -cy, -DEPTH / 2);
      geo.scale(S, -S, S);
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      const c = new THREE.Vector3(); geo.boundingBox!.getCenter(c);
      const mat = baseMat.clone();
      const mesh = new THREE.Mesh(geo, mat);
      /* a fine line along every edge, the back ones seen through the glass,
         so the shape is drawn even where no light falls on it */
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30),
        new THREE.LineBasicMaterial({ color: 0xc9d2e0, transparent: true, opacity: 0.13, depthTest: false }));
      mesh.add(edges);
      mark.add(mesh);
      pieces.push({ mesh, mat, dir: c.clone().setZ(0).normalize(), flash: 0 });
    }
  });
  scene.add(mark);

  /* a little direct light, for the bevels */
  const top = new THREE.DirectionalLight(0xffa24a, 2.2); top.position.set(0.5, 6, 1.5); scene.add(top);
  const rim = new THREE.DirectionalLight(0xff9a50, 1.2); rim.position.set(4, 2, -5); scene.add(rim);
  const cool = new THREE.DirectionalLight(0xbcd0ff, 0.35); cool.position.set(-4, 0, 4); scene.add(cool);

  /* embers: a few warm sparks drifting slowly up through the dark */
  const EMBERS = narrow ? 18 : 34;
  const ember = new Float32Array(EMBERS * 3);
  const seed = Array.from({ length: EMBERS }, (_, i) => {
    const h = (k: number) => { const x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
    return { x: (h(1) - 0.5) * 7, y: (h(2) - 0.5) * 5, z: (h(3) - 0.5) * 4 - 0.5, v: 0.05 + h(4) * 0.12, p: h(5) * 6.283 };
  });
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(ember, 3));
  const sparks = new THREE.Points(emberGeo, new THREE.PointsMaterial({
    color: 0xff8a3c, size: 0.035, sizeAttenuation: true, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(sparks);

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

  let out = 0, exit = 0, released = false, intro = 0, raf = 0, gone = false, recorded = false;
  let moved = false;
  const clock = new THREE.Clock();

  const frame = () => {
    raf = 0;
    if (gone) return;
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;
    if (released) intro = Math.min(1, intro + dt / 1.8);
    const ei = 1 - Math.pow(1 - intro, 3);

    mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
    /* turned far enough, slowly, that its thickness shows — then back to
       face the page — and leaning a little towards the pointer */
    mark.rotation.y = Math.sin(t * 0.22) * 0.95 + mx * 0.3;
    mark.rotation.x = Math.sin(t * 0.17) * 0.1 - my * 0.18;
    mark.position.y = Math.sin(t * 0.6) * 0.04 + exit * 1.6;

    /* the pieces: in from far apart as the page arrives, breathing at rest,
       and parting again on the way out */
    const apart = (1 - ei) * 1.4 + BREATHE * (0.5 + 0.5 * Math.sin(t * 0.8)) + exit * 1.2;
    /* which piece is under the pointer: asked only when it has moved */
    if (moved) {
      moved = false;
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(pieces.map((p) => p.mesh), false)[0];
      const now = hit ? pieces.find((p) => p.mesh === hit.object) ?? null : null;
      if (now && now !== hovered) now.flash = 1;
      hovered = now;
    }
    for (const p of pieces) {
      p.mesh.position.copy(p.dir).multiplyScalar(apart);
      p.mesh.position.z = (1 - ei) * -1.2;
      p.flash *= 0.92;
      const f = p.flash;
      p.mat.envMapIntensity = 3 + 1.6 * f;
      p.mat.roughness = Math.max(0.02, 0.08 - 0.06 * f);
      p.mat.emissiveIntensity = 0.15 + 0.1 * f;
      p.mat.opacity = (0.88 - 0.16 * f) * ei;
    }

    /* the room sways slowly, so the highlights travel over the metal */
    const sway = Math.sin(t * 0.15) * 0.35;
    for (let i = 0; i < EMBERS; i++) {
      const e = seed[i];
      const y = ((e.y + t * e.v + 2.5) % 5) - 2.5;
      ember[i * 3] = e.x + Math.sin(t * 0.4 + e.p) * 0.15;
      ember[i * 3 + 1] = y;
      ember[i * 3 + 2] = e.z;
    }
    emberGeo.attributes.position.needsUpdate = true;
    (sparks.material as THREE.PointsMaterial).opacity = 0.85 * ei;

    /* the room is recorded once, and the reflection is turned in place:
       re-recording it was six more renders of the scene every frame */
    if (!recorded) {
      mark.visible = false; sparks.visible = false;
      cubeCam.update(renderer, scene);
      mark.visible = true; sparks.visible = true;
      scene.remove(room);             // recorded: nothing else needs it
      recorded = true;
    }
    for (const p of pieces) p.mat.envMapRotation.set(0, sway, 0);
    renderer.domElement.style.opacity = String(1 - out);
    renderer.render(scene, camera);
    if (out < 0.999) raf = requestAnimationFrame(frame);
  };
  const wake = () => { if (!raf && !gone) raf = requestAnimationFrame(frame); };
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
    },
  };
}
