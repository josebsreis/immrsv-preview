/* ═══════════════════════════════════════════════════════════════════
   The hero as a solid mark: a trial, chosen on the address with
   `?hero=metal`. The way trionn.com builds theirs, done to ours.

   No model file. The mark's three faces are the logo's own outlines
   (lib/lettermark), pushed into depth with a hair of bevel on every
   edge to catch the light, each face its own piece. The material is
   dark polished metal that lets a third of the light through, under a
   clear coat. What makes it read as expensive is what it reflects: a
   camera inside the scene records the room every frame — a few soft
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
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, narrow ? 1.5 : 2));
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
  /* the walls: not black but a slow fall from a cool grey overhead to
     nothing underfoot, so a face turned away from every light still has a
     tone of its own */
  const wallGeo = new THREE.SphereGeometry(20, 32, 16);
  const tone = new Float32Array(wallGeo.attributes.position.count * 3);
  for (let i = 0; i < wallGeo.attributes.position.count; i++) {
    const y = wallGeo.attributes.position.getY(i) / 20;
    const v = 0.02 + 0.2 * Math.pow(Math.max(0, y * 0.5 + 0.5), 2.2);
    tone.set([v * 0.92, v * 0.97, v * 1.08], i * 3);
  }
  wallGeo.setAttribute('color', new THREE.BufferAttribute(tone, 3));
  const walls = new THREE.Mesh(wallGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
  walls.layers.set(ROOM); room.add(walls);
  strip(3, 12, -6, 0.5, 2.5, Math.PI / 2.4, 0, 1);           // a tall softbox to the left
  strip(1.4, 12, 6.2, 0, 1.5, -Math.PI / 2.2, 0, 0.85);      // a narrower one to the right
  strip(12, 2.4, 0, 6, 1, 0, 0, 0.9).rotation.x = Math.PI / 2;    // a band overhead
  strip(6, 0.6, 0, -3.5, 5.5, 0, 0.25, 0.8);                 // a sliver low in front
  /* The faces all look straight back at the viewer — the mark is a flat
     logo pushed into depth — so what they mirror is what stands behind the
     viewer. Two tall softboxes there, a little apart, with a gap between:
     as the mark leans, their edges sweep across the faces. */
  strip(2.2, 14, -2.6, 0, 9, 0, 0.12, 1.1);
  strip(1.1, 14, 2.4, 0, 9, 0, -0.08, 0.8);
  strip(14, 0.35, 0, 2.2, 9, 0, 0, 0.7);
  // a warm one, behind, for the edges
  const warm = strip(4, 8, 3.5, 1, -6, 0.3, 0.2, 1);
  (warm.material as THREE.MeshBasicMaterial).color.setRGB(1, 0.62, 0.3);
  scene.add(room);


  /* the camera inside: six small renders of the room, every frame */
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
    color: 0x3a3d42, emissive: new THREE.Color(0x1a2030), emissiveIntensity: 0.15,
    metalness: 1, roughness: 0.08, transmission: 0.35, ior: 2.4, thickness: 0.4,
    transparent: true, opacity: 0.88, clearcoat: 1, clearcoatRoughness: 0.05,
    envMap: cubeRT.texture, envMapIntensity: 3, side: THREE.DoubleSide,
  });
  const mark = new THREE.Group();
  type Piece = { mesh: THREE.Mesh; mat: THREE.MeshPhysicalMaterial; dir: THREE.Vector3; flash: number };
  const pieces: Piece[] = [];
  parsed.paths.forEach((p) => {
    for (const shape of SVGLoader.createShapes(p)) {
      const geo = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 0.9, bevelSegments: 2, curveSegments: 8 });
      // into the page's own frame: centred, y up, a unit about a metre
      geo.translate(-cx, -cy, -DEPTH / 2);
      geo.scale(S, -S, S);
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      const c = new THREE.Vector3(); geo.boundingBox!.getCenter(c);
      const mat = baseMat.clone();
      const mesh = new THREE.Mesh(geo, mat);
      /* a fine line along each piece's edges, to draw it against the dark */
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), new THREE.LineBasicMaterial({ color: 0x8a96aa, transparent: true, opacity: 0.12 }));
      mesh.add(edges);
      mark.add(mesh);
      pieces.push({ mesh, mat, dir: c.clone().setZ(0).normalize(), flash: 0 });
    }
  });
  scene.add(mark);

  /* a little direct light, for the bevels */
  const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(-3, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffb070, 1.4); rim.position.set(4, 2, -5); scene.add(rim);
  scene.add(new THREE.AmbientLight(0x8090a0, 0.15));

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
  };
  addEventListener('pointermove', onMove, { passive: true });

  let out = 0, exit = 0, released = false, intro = 0, raf = 0, gone = false;
  const clock = new THREE.Clock();

  const frame = () => {
    raf = 0;
    if (gone) return;
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;
    if (released) intro = Math.min(1, intro + dt / 1.8);
    const ei = 1 - Math.pow(1 - intro, 3);

    mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
    mark.rotation.y = Math.sin(t * 0.25) * 0.35 + mx * 0.35;
    mark.rotation.x = Math.sin(t * 0.19) * 0.12 - my * 0.2;
    mark.position.y = Math.sin(t * 0.6) * 0.04 + exit * 1.6;

    /* the pieces: in from far apart as the page arrives, breathing at rest,
       and parting again on the way out */
    const apart = (1 - ei) * 1.4 + BREATHE * (0.5 + 0.5 * Math.sin(t * 0.8)) + exit * 1.2;
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pieces.map((p) => p.mesh), false)[0];
    const now = hit ? pieces.find((p) => p.mesh === hit.object) ?? null : null;
    if (now && now !== hovered) now.flash = 1;
    hovered = now;
    for (const p of pieces) {
      p.mesh.position.copy(p.dir).multiplyScalar(apart);
      p.mesh.position.z = (1 - ei) * -1.2;
      p.flash *= 0.92;
      const f = p.flash;
      p.mat.envMapIntensity = 3 + 1.6 * f;
      p.mat.roughness = Math.max(0.02, 0.08 - 0.06 * f);
      p.mat.transmission = 0.35 + 0.32 * f;
      p.mat.emissiveIntensity = 0.15 + 0.1 * f;
      p.mat.opacity = (0.88 - 0.16 * f) * ei;
    }

    /* the room turns slowly, so the highlights travel over the metal */
    room.rotation.y = Math.sin(t * 0.15) * 0.35;

    /* the room is recorded without the mark in it, then the picture drawn */
    mark.visible = false;
    cubeCam.position.copy(mark.position);
    cubeCam.update(renderer, scene);
    mark.visible = true;
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
