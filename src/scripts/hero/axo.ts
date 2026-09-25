/* ═══════════════════════════════════════════════════════════════════
   The hero as a drawn and built mark: a trial, chosen on the address with
   `?hero=axo`. The solid, polished mark of `?hero=metal`, made ours.

   Two things tell it apart from a shatter. It comes apart the way an
   architect draws a building apart — an exploded axonometric: each of the
   three faces slides straight out along the cube's own axis, and then its
   layers lift off it in order, front plate towards you, back plate away,
   the sides outward — parallel, measured, nothing spinning — with a
   dimension line from where each face stood to where it went, and the
   studio it stands for named at its end. And it goes back together the way
   the studios make an image: first a line drawing, then the surfaces
   return as matte clay, then the finished material washes over them —
   before it exists, built. The light is a studio's white, not gold.

   It answers the page as the particle hero does, and stops drawing once
   the first studio has covered it.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import type { Hero } from './index';
import { SYMBOL } from '../../lib/lettermark';

import { site } from '../../lib/site';

export interface AxoOptions { host: HTMLElement }

/** how deep the faces are pushed, in the mark's own units (it is ~184 wide) */
const DEPTH = 26;
/** how far the pieces drift apart at rest, and on the way out */
const BREATHE = 0.09;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function createAxoHero({ host }: AxoOptions): Hero {
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
  /* a white softbox overhead — a studio's light, not a gold one: every
     edge and step that faces up catches it */
  const over = strip(14, 3, 0, 6, 0, 0, 0, 1);
  over.rotation.x = Math.PI / 2;
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

  /* A piece comes apart into its layers — each flat face and each strip of
     the bevel — as an exploded axonometric: the piece slides out along its
     own axis, and then its layers lift off it in order, all parallel. It
     stays ONE mesh throughout (a mesh per layer blended its see-through
     faces in a different order the moment it began, and the reflections
     jumped): every vertex carries its layer's slide and lift, and the
     vertex shader moves it. Triangles are grouped by the plane they lie in. */
  const burstable = (geo: THREE.BufferGeometry, slide: THREE.Vector3) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const pos = g.attributes.position.array as ArrayLike<number>;
    const nrm = g.attributes.normal.array as ArrayLike<number>;
    const tris = pos.length / 9;
    const L = new Float32Array(tris * 9), O = new Float32Array(tris * 3), SL = new Float32Array(tris * 9);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    for (let t = 0; t < tris; t++) {
      a.fromArray(pos, t * 9); b.fromArray(pos, t * 9 + 3); c.fromArray(pos, t * 9 + 6);
      n.subVectors(c, b).cross(a.clone().sub(b)).normalize();
      if (!Number.isFinite(n.x)) n.set(0, 0, 1);
      /* the layer: the front plate comes towards you and the back goes away,
         the sides step outward, the bevel strips in between — and in that
         order, plates first */
      let lift: THREE.Vector3, order: number;
      if (Math.abs(n.z) > 0.92) { lift = new THREE.Vector3(0, 0, Math.sign(n.z) * 0.62); order = 0; }
      else if (Math.abs(n.z) < 0.08) { lift = new THREE.Vector3(n.x, n.y, 0).normalize().multiplyScalar(0.24); order = 1; }
      else { lift = n.clone().multiplyScalar(0.42); order = 0.5; }
      for (let v = 0; v < 3; v++) {
        const i = t * 3 + v;
        lift.toArray(L, i * 3); slide.toArray(SL, i * 3); O[i] = order;
      }
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos as ArrayLike<number> as Float32Array), 3));
    out.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nrm as ArrayLike<number> as Float32Array), 3));
    out.setAttribute('aLift', new THREE.BufferAttribute(L, 3));
    out.setAttribute('aSlide', new THREE.BufferAttribute(SL, 3));
    out.setAttribute('aOrder', new THREE.BufferAttribute(O, 1));
    return out;
  };

  /* the exploded view, in the vertex shader: first the piece slides out
     along its axis, then its layers lift off in order — nothing turns */
  const teach = (mat: THREE.MeshPhysicalMaterial) => {
    const u = { uE: { value: 0 } };
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float uE;
          attribute vec3 aLift; attribute vec3 aSlide; attribute float aOrder;`)
        .replace('#include <begin_vertex>', `
          float xs = smoothstep(0.0, 0.5, uE);
          float xl = smoothstep(0.35 + aOrder * 0.18, 0.8 + aOrder * 0.2, uE);
          vec3 transformed = vec3(position) + aSlide * xs + aLift * xl;`);
    };
    mat.customProgramCacheKey = () => 'axo';
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
                 dir: THREE.Vector3; home: THREE.Vector3; slide: THREE.Vector3;
                 burst: { uE: { value: number } }; dim: THREE.BufferGeometry; tag: HTMLElement; flash: number };
  /* how far a face slides out along its axis */
  const SLIDE = matchMedia('(max-width: 859px)').matches ? 0.7 : 0.9;
  /* the dimension lines, and the names at their ends, drawn over the canvas */
  const dimMat = new THREE.LineBasicMaterial({ color: 0xaab2c0, transparent: true, opacity: 0, depthTest: false });
  const tags = document.createElement('div');
  tags.setAttribute('aria-hidden', 'true');
  tags.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1;';
  host.appendChild(tags);
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
      const dir = c.clone().setZ(0).normalize();
      const slide = dir.clone().multiplyScalar(SLIDE);
      const mesh = new THREE.Mesh(burstable(geo, slide), mat);
      mesh.frustumCulled = false;
      const probe = new THREE.Mesh(geo, mat);
      probe.visible = false;
      /* a dimension line from where the face stood to where it has gone,
         with a tick across each end */
      const dim = new THREE.BufferGeometry();
      dim.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 3), 3));
      const dimLine = new THREE.LineSegments(dim, dimMat);
      dimLine.frustumCulled = false;
      mark.add(dimLine);
      /* and the studio the face stands for, named at its end */
      const studio = site.studios[pi % site.studios.length];
      const tag = document.createElement('div');
      tag.innerHTML = `<span style="color:var(--ink-4)">${String(pi + 1).padStart(2, '0')}</span>&nbsp;&nbsp;${studio.label}`;
      tag.style.cssText = 'position:absolute;left:0;top:0;white-space:nowrap;opacity:0;font-family:var(--font-label);font-stretch:var(--label-stretch);font-weight:var(--w-label);text-transform:uppercase;letter-spacing:var(--track-label);font-size:var(--t-label);color:var(--ink-2);will-change:transform,opacity;';
      tags.appendChild(tag);
      const piece: Piece = { group, mat, edges: edgeMat, dir, home: c.clone(), slide, burst, dim, tag, flash: 0 };
      group.add(mesh, probe); hitList.push(probe); owner.set(probe, piece);
      mark.add(group);
      pieces.push(piece);
    }
  });
  scene.add(mark);

  /* a little direct light, for the bevels */
  const top = new THREE.DirectionalLight(0xffffff, 1.9); top.position.set(0.5, 6, 1.5); scene.add(top);
  const rim = new THREE.DirectionalLight(0xe4ebff, 1.0); rim.position.set(4, 2, -5); scene.add(rim);
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

  let released = false, intro = 0, raf = 0, gone = false, recorded = false;
  let moved = false;
  const clock = new THREE.Clock();
  /* the section that brings it back together, and the light half that ends it */
  const handover = document.getElementById('studios-title')?.closest('section') ?? null;
  const light = document.querySelector<HTMLElement>('[data-light]');
  const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
  /* the clay stage: a matte, pale grey, the colour of a model before it is finished */
  const CLAY = new THREE.Color(0x8e8f93);

  const frame = () => {
    raf = 0;
    if (gone) return;
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;
    if (released) intro = Math.min(1, intro + dt / 3.2);
    const ei = smooth(intro);

    /* The scroll, read here rather than handed in. As the hero leaves, the
       mark is drawn apart — an exploded axonometric — and held that way
       through the dark half, the faces named; as the section before the
       studios arrives it closes up again, and is rebuilt in the studios'
       own order: drawing, clay, finish. Never faded: the first studio, on
       the light, rides up over it. */
    const p = scrollY / innerHeight;
    const leave = smooth(p / 1.3);
    const back = handover ? smooth((innerHeight - handover.getBoundingClientRect().top) / (innerHeight * 0.95)) : 0;
    const covered = light ? light.getBoundingClientRect().top <= 0 : false;
    /* apart: all the way as the page arrives, then as the scroll says, and
       closed again over the first part of the handover */
    const closing = smooth(back / 0.4);
    const e = Math.max(1 - smooth(ei / 0.45), leave * (1 - closing));
    /* the stages, on arrival and at the handover alike: a line drawing while
       it closes, then clay, then the finish */
    const drawI = 1 - smooth((ei - 0.45) / 0.15);
    const clayI = smooth((ei - 0.45) / 0.15) * (1 - smooth((ei - 0.72) / 0.22));
    const drawH = smooth(back / 0.1) * (1 - smooth((back - 0.4) / 0.14));
    const clayH = smooth((back - 0.4) / 0.14) * (1 - smooth((back - 0.7) / 0.24));
    const drawn = Math.max(drawI, drawH), clay = Math.max(clayI, clayH);
    /* the names and dimensions: only in the exploded view the scroll makes */
    const shown = smooth((leave * (1 - closing) - 0.55) / 0.3);

    mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
    /* turned just far enough, slowly, that its thickness shows — never so
       far that it stops reading as the mark — and, apart, turned to the
       three-quarter view an exploded drawing is made from */
    mark.rotation.y = Math.sin(t * 0.22) * 0.42 * (1 - e) + 0.4 * e + mx * 0.2;
    mark.rotation.x = Math.sin(t * 0.17) * 0.1 * (1 - e) - 0.24 * e - my * 0.18;
    mark.position.y = Math.sin(t * 0.6) * 0.04;
    mark.updateMatrixWorld();

    /* which piece is under the pointer: asked only when it has moved */
    if (moved) {
      moved = false;
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(hitList, false)[0];
      const now = hit ? owner.get(hit.object) ?? null : null;
      if (now && now !== hovered) now.flash = 1;
      hovered = now;
    }

    const breathe = BREATHE * (0.5 + 0.5 * Math.sin(t * 0.8)) * (1 - e);
    const W = innerWidth, H = innerHeight;
    const v = new THREE.Vector3();
    for (const pc of pieces) {
      pc.group.position.copy(pc.dir).multiplyScalar(breathe);
      pc.flash *= 0.92;
      const f = pc.flash;
      /* the material, between clay and the finish */
      pc.mat.color.setHex(0x3a3d42).lerp(CLAY, clay);
      pc.mat.metalness = 1 - clay;
      pc.mat.roughness = Math.max(0.02, 0.08 - 0.06 * f) + 0.8 * clay;
      pc.mat.clearcoat = 1 - clay;
      pc.mat.envMapIntensity = (3 + 1.6 * f) * (1 - clay * 0.85);
      pc.mat.emissiveIntensity = (0.15 + 0.1 * f) * (1 - clay);
      /* a line drawing is the outline alone: the surfaces are all but gone */
      pc.mat.opacity = ((0.88 - 0.16 * f) * (1 - clay) + clay) * (1 - 0.95 * drawn);
      /* the outline: the drawing, and what is left standing of the mark
         while its faces are out */
      pc.edges.opacity = Math.max(0.3 * smooth(e * 1.6), 0.6 * drawn, 0.35 * clay);
      pc.burst.uE.value = e;
      /* the dimension line, from home to where the face has slid */
      const s0 = smooth(e / 0.5);
      const from = pc.home, to = pc.home.clone().addScaledVector(pc.slide, s0);
      const perp = new THREE.Vector3(-pc.dir.y, pc.dir.x, 0).multiplyScalar(0.06);
      const arr = pc.dim.attributes.position.array as Float32Array;
      from.clone().add(perp).toArray(arr, 0); from.clone().sub(perp).toArray(arr, 3);
      to.clone().add(perp).toArray(arr, 6); to.clone().sub(perp).toArray(arr, 9);
      from.toArray(arr, 12); to.toArray(arr, 15);
      pc.dim.attributes.position.needsUpdate = true;
      /* the name, just beyond the far end, placed over the canvas */
      v.copy(to).addScaledVector(pc.dir, 0.34).applyMatrix4(mark.matrixWorld).project(camera);
      /* kept on the screen, clear of the nav: a name half off the edge
         names nothing */
      const tw = pc.tag.offsetWidth, th = pc.tag.offsetHeight, pad = 20;
      const px = Math.min(W - pad - tw / 2, Math.max(pad + tw / 2, (v.x * 0.5 + 0.5) * W));
      const py = Math.min(H - pad - th / 2, Math.max(96 + th / 2, (-v.y * 0.5 + 0.5) * H));
      pc.tag.style.opacity = shown.toFixed(3);
      pc.tag.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%, -50%)`;
    }
    dimMat.opacity = 0.45 * shown;

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
    renderer.render(scene, camera);
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
      tags.remove();
    },
  };
}
