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
  const walls = new THREE.Mesh(new THREE.SphereGeometry(20, 16, 8), new THREE.MeshBasicMaterial({ color: 0x060606, side: THREE.BackSide }));
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
    /* a faint grey body of its own — neutral, no tint — so the faces read as
       a dark solid and not only as what they mirror */
    color: 0x3a3d42, emissive: new THREE.Color(0x2e2f32), emissiveIntensity: 0.75,
    /* no `transmission`: it draws the whole scene a second time every frame
       to fake light passing through, and on a black ground plain
       transparency reads the same */
    metalness: 0.8, roughness: 0.08,
    transparent: true, opacity: 0.72, clearcoat: 1, clearcoatRoughness: 0.05,
    envMap: cubeRT.texture, envMapIntensity: 3, side: THREE.DoubleSide, depthWrite: false,
  });

  /* A piece is split into its surfaces — each flat face and each strip of
     the bevel its own mesh — so that they can come away one by one and
     leave the piece's outline standing where it was. Triangles are grouped
     by the plane they lie in; a surface is moved about its own middle. */
  type Surface = { mesh: THREE.Mesh; home: THREE.Vector3; out: THREE.Vector3; axis: THREE.Vector3; spin: number; lag: number };
  const hash = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const split = (geo: THREE.BufferGeometry, mat: THREE.Material, seed: number): Surface[] => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const pos = g.attributes.position.array as ArrayLike<number>;
    const nrm = g.attributes.normal.array as ArrayLike<number>;
    const groups = new Map<string, number[]>();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    for (let t = 0; t < pos.length / 9; t++) {
      a.fromArray(pos, t * 9); b.fromArray(pos, t * 9 + 3); c.fromArray(pos, t * 9 + 6);
      n.subVectors(c, b).cross(a.clone().sub(b)).normalize();
      if (!Number.isFinite(n.x)) continue;
      const d = n.dot(a);
      const key = `${Math.round(n.x * 12)},${Math.round(n.y * 12)},${Math.round(n.z * 12)},${Math.round(d * 40)}`;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(t);
    }
    const out: Surface[] = [];
    let k = 0;
    for (const tris of groups.values()) {
      const P = new Float32Array(tris.length * 9), N = new Float32Array(tris.length * 9);
      tris.forEach((t, i) => { for (let j = 0; j < 9; j++) { P[i * 9 + j] = pos[t * 9 + j]; N[i * 9 + j] = nrm[t * 9 + j]; } });
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(P, 3));
      sg.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      sg.computeBoundingBox();
      const home = new THREE.Vector3(); sg.boundingBox!.getCenter(home);
      sg.translate(-home.x, -home.y, -home.z);
      const face = new THREE.Vector3(N[0], N[1], N[2]).normalize();
      const r = (q: number) => hash(seed * 97 + k * 13 + q);
      /* out along its own face, a little off it, and further for some */
      /* A long way: out across the screen, not just off the middle — most of
         the way to the edges, and some right past them. Mostly across the
         page's plane; a little towards or away, never through the viewer. */
      const ang = r(1) * Math.PI * 2;
      const reach = 0.9 + Math.pow(r(2), 1.6) * 4.2;
      const dir = new THREE.Vector3(Math.cos(ang) * reach * 1.35, Math.sin(ang) * reach, (r(3) - 0.6) * 3.2)
        .add(face.clone().multiplyScalar(0.8));
      const mesh = new THREE.Mesh(sg, mat);
      mesh.position.copy(home);
      out.push({ mesh, home, out: dir,
                 axis: new THREE.Vector3(r(5) - 0.5, r(6) - 0.5, r(7) - 0.5).normalize(),
                 spin: (r(8) - 0.5) * 4, lag: r(9) * 0.55 });
      k++;
    }
    return out;
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
                 dir: THREE.Vector3; whole: THREE.Mesh; surfaces: Surface[]; flash: number };
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
      /* whole, the piece is one mesh — one draw instead of dozens — and
         its surfaces are only shown while it is coming apart */
      const whole = new THREE.Mesh(geo, mat);
      const surfaces = split(geo, mat, pi + 1);
      const piece: Piece = { group, mat, edges: edgeMat, dir: c.clone().setZ(0).normalize(), whole, surfaces, flash: 0 };
      group.add(whole); hitList.push(whole); owner.set(whole, piece);
      for (const sf of surfaces) { sf.mesh.visible = false; group.add(sf.mesh); owner.set(sf.mesh, piece); }
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

  let released = false, intro = 0, raf = 0, gone = false, recorded = false;
  let moved = false;
  const clock = new THREE.Clock();
  const q = new THREE.Quaternion();
  /* the section that brings it back together, and the light half that ends it */
  const handover = document.getElementById('studios-title')?.closest('section') ?? null;
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
    /* spread over most of two screens, so the surfaces leave slowly */
    const leave = smooth(p / 1.6);
    const back = handover ? smooth((innerHeight - handover.getBoundingClientRect().top) / (innerHeight * 0.85)) : 0;
    const covered = light ? light.getBoundingClientRect().top <= 0 : false;
    const vis = 1;
    /* how far apart: all the way as the page arrives, then as the scroll says */
    const e = Math.max(1 - ei, leave * (1 - back));
    /* apart, it drifts: the far-flung surfaces keep turning, slowly */
    const drift = t * 0.12;

    mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
    /* turned far enough, slowly, that its thickness shows — then back to
       face the page — and leaning a little towards the pointer */
    mark.rotation.y = Math.sin(t * 0.22) * 0.95 * (1 - e * 0.6) + mx * 0.3;
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
      pc.mat.emissiveIntensity = 0.75 + 0.15 * f;
      pc.mat.opacity = (0.88 - 0.16 * f) * vis * (1 - e * 0.35);
      /* the outline brightens as the surfaces leave it */
      /* the outline is only there while the mark is apart: whole, it is the
         solid alone */
      pc.edges.opacity = 0.3 * smooth(e * 1.6) * vis;
      const apart = e > 0.002;
      pc.whole.visible = !apart;
      for (const sf of pc.surfaces) {
        sf.mesh.visible = apart;
        if (!apart) continue;
        /* each surface on its own clock, so they leave one after another */
        const k = smooth((e - sf.lag) / (1 - sf.lag));
        sf.mesh.position.copy(sf.home).addScaledVector(sf.out, k);
        sf.mesh.quaternion.copy(q.setFromAxisAngle(sf.axis, sf.spin * k + drift * sf.spin * 0.3 * k));
      }
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
    },
  };
}
