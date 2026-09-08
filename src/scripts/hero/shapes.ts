/* ═══════════════════════════════════════════════════════════════════
   The other things the cloud can be.

   Each shape is a signed distance field written in code — no meshes, no
   loaders, no downloads. A field is sampled once into a list of surface
   points (rejection sampling in the bounding box, then each accepted
   point pushed onto the surface along the gradient), which is exactly
   the same currency the wordmark morph already trades in: one flat array
   of targets per shape, about 86KB, built in a few milliseconds.

   Shapes are authored with y up and the origin at the floor line, then
   placed in the mark's own coordinates around the pivot, so a shape can
   stand still and turn on a vertical axis while the cube tumbles on its
   diagonal.
   ═══════════════════════════════════════════════════════════════════ */

/* ── field primitives ─────────────────────────────────────────────── */

const sphere = (x: number, y: number, z: number, r: number) => Math.hypot(x, y, z) - r;

/** distance to a box of half-extents (bx,by,bz), rounded by r */
function roundBox(x: number, y: number, z: number, bx: number, by: number, bz: number, r: number) {
  const qx = Math.abs(x) - bx + r, qy = Math.abs(y) - by + r, qz = Math.abs(z) - bz + r;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  return Math.hypot(ox, oy, oz) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

/** distance to the segment a→b, thickened by r — the workhorse for limbs */
function capsule(x: number, y: number, z: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number) {
  const px = x - ax, py = y - ay, pz = z - az;
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const t = Math.min(1, Math.max(0, (px * dx + py * dy + pz * dz) / (dx * dx + dy * dy + dz * dz)));
  return Math.hypot(px - dx * t, py - dy * t, pz - dz * t) - r;
}

/** a gable: the roof's triangular section, extruded along z */
function gable(x: number, y: number, z: number, halfW: number, h: number, halfD: number) {
  // 2D triangle (−halfW,0) (halfW,0) (0,h) as the intersection of three half-planes
  const nx = h / Math.hypot(h, halfW), ny = halfW / Math.hypot(h, halfW);
  const d2 = Math.max(-y, Math.abs(x) * nx + y * ny - h * ny);
  const dz = Math.abs(z) - halfD;
  return Math.min(Math.max(d2, dz), 0) + Math.hypot(Math.max(d2, 0), Math.max(dz, 0));
}

const uni = (a: number, b: number) => Math.min(a, b);
/** a − b: carves b out of a */
const sub = (a: number, b: number) => Math.max(a, -b);
/** union with a soft seam, so joints read as one body rather than parts */
function smin(a: number, b: number, k: number) {
  const h = Math.min(1, Math.max(0, 0.5 + (0.5 * (b - a)) / k));
  return b * (1 - h) + a * h - k * h * (1 - h);
}

/* ── the shapes ───────────────────────────────────────────────────── */

export interface ShapeDef {
  readonly name: string;
  /** a baked point cloud to use instead of the field: the mark's own copy of a
   *  real model, sampled at build time. The mesh never reaches the browser —
   *  only the points do, quantised to 16 bits. See scripts/bakeShape.py. */
  readonly src?: string;
  /** a baked rig: the same points, plus the bones that move them, so the form
   *  can stand there breathing instead of standing there. See skin.ts. */
  readonly skin?: string;
  /** signed distance, authored with y up and the feet near y = 0. A baked
   *  shape keeps one as the fallback for when its file cannot be fetched. */
  readonly sdf: (x: number, y: number, z: number) => number;
  /** the box to sample inside: [minX, minY, minZ, maxX, maxY, maxZ] */
  readonly bounds: readonly [number, number, number, number, number, number];
  /** multiplied onto the authored coordinates before they reach the mark */
  readonly scale: number;
  /** a slow lean, strongest at the top and nothing at the foot — for things
   *  that are rooted and would move in air */
  readonly sway?: number;
  /** a slow rise and fall of the whole form, for things that would not */
  readonly bob?: number;
  /** lifted by this after scaling, so the shape sits centred on the pivot */
  readonly lift: number;
}

/** A standing figure — the fallback field, for when the rig cannot be
 *  fetched. Not a likeness: a maquette, the thing on a modeller's shelf. */
const FIGURE: ShapeDef = {
  name: 'figure',
  skin: '/shapes/figure.skin',
  scale: 2.05,
  lift: -0.5,
  bounds: [-0.55, -0.06, -0.34, 0.55, 1.02, 0.34],
  sdf(x, y, z) {
    // head and neck
    let d = sphere(x, y - 0.865, z - 0.01, 0.105);
    d = uni(d, roundBox(x, y - 0.885, z + 0.055, 0.075, 0.075, 0.02, 0.02));   // the back of the skull, squared off
    d = smin(d, capsule(x, y, z, 0, 0.75, 0, 0, 0.80, 0, 0.045), 0.03);
    // chest → waist → hips, tapered by stacking two rounded boxes
    const chest = roundBox(x, y - 0.63, z, 0.135, 0.115, 0.062, 0.05);
    const waist = roundBox(x, y - 0.46, z, 0.10, 0.09, 0.055, 0.045);
    const hips = roundBox(x - 0.012, y - 0.36, z, 0.115, 0.075, 0.06, 0.05);
    d = smin(d, smin(smin(chest, waist, 0.06), hips, 0.05), 0.04);
    // shoulders, then arms: shoulder → elbow → hand, hanging just clear
    d = smin(d, capsule(x, y, z, -0.135, 0.705, 0, 0.135, 0.705, 0, 0.055), 0.05);
    d = smin(d, capsule(x, y, z, -0.175, 0.70, 0.005, -0.225, 0.50, 0.03, 0.043), 0.04);
    d = smin(d, capsule(x, y, z, -0.225, 0.50, 0.03, -0.205, 0.315, -0.01, 0.036), 0.03);
    d = uni(d, sphere(x + 0.20, y - 0.285, z + 0.02, 0.043));
    d = smin(d, capsule(x, y, z, 0.175, 0.70, -0.005, 0.235, 0.505, -0.045, 0.043), 0.04);
    d = smin(d, capsule(x, y, z, 0.235, 0.505, -0.045, 0.215, 0.325, 0.02, 0.036), 0.03);
    d = uni(d, sphere(x - 0.21, y - 0.295, z - 0.03, 0.043));
    // legs: the standing one straight, the other eased forward and bent
    d = smin(d, capsule(x, y, z, -0.062, 0.335, 0, -0.072, 0.175, 0.005, 0.058), 0.05);
    d = smin(d, capsule(x, y, z, -0.072, 0.175, 0.005, -0.078, 0.015, 0.0, 0.045), 0.04);
    d = smin(d, capsule(x, y, z, 0.066, 0.335, 0.01, 0.086, 0.18, 0.06, 0.058), 0.05);
    d = smin(d, capsule(x, y, z, 0.086, 0.18, 0.06, 0.086, 0.02, 0.035, 0.045), 0.04);
    // feet
    d = uni(d, roundBox(x + 0.078, y - 0.005, z - 0.03, 0.045, 0.018, 0.075, 0.018));
    d = uni(d, roundBox(x - 0.086, y - 0.012, z - 0.065, 0.045, 0.018, 0.075, 0.018));
    return d;
  },
};

/** A tree: the one form here that reads at a glance from any angle, which is
 *  most of why it earns its place. */
const TREE: ShapeDef = {
  name: 'tree',
  src: '/shapes/tree.bin',
  sway: 0.055,
  scale: 2.08,
  lift: -0.5,
  bounds: [-0.42, -0.02, -0.42, 0.42, 1.0, 0.42],
  sdf(x, y, z) {
    // the fallback, for a cloud that never arrives: a trunk and three tufts
    let d = capsule(x, y, z, 0, 0, 0, 0.02, 0.52, 0.01, 0.045);
    d = smin(d, sphere(x, y - 0.72, z, 0.22), 0.09);
    d = smin(d, sphere(x - 0.16, y - 0.60, z - 0.06, 0.15), 0.08);
    d = smin(d, sphere(x + 0.13, y - 0.62, z + 0.09, 0.14), 0.08);
    return d;
  },
};

/** A screen: a slab held a few degrees off
 *  vertical on a stem, the way a monitor stands on a desk — thin enough to
 *  read as a surface, not a brick. */
const SCREEN: ShapeDef = {
  name: 'screen',
  bob: 0.022,
  sway: 0.008,
  scale: 2.15,
  lift: -0.44,
  bounds: [-0.52, -0.04, -0.36, 0.52, 0.92, 0.36],
  sdf(x, y, z) {
    // the panel, tilted back about x
    const c = Math.cos(0.13), s = Math.sin(0.13);
    const py = (y - 0.56) * c + (z - 0.02) * s, pz = -(y - 0.56) * s + (z - 0.02) * c;
    let panel = roundBox(x, py, pz, 0.40, 0.26, 0.022, 0.016);
    panel = sub(panel, roundBox(x, py + 0.015, pz - 0.022, 0.355, 0.205, 0.016, 0.008));      // the screen itself, sunk in
    let d = panel;
    d = smin(d, capsule(x, y, z, 0, 0.30, 0.02, 0, 0.06, 0.02, 0.038), 0.05);                 // stem
    d = uni(d, roundBox(x, y - 0.022, z - 0.01, 0.16, 0.020, 0.115, 0.014));                  // foot
    return d;
  },
};

/* The forms are not an illustration of the three studios — the headline says
   what the work is. They are here to show the mark making things, so the only
   rule is that each one reads at a glance. */
export const SHAPES: readonly ShapeDef[] = [TREE, FIGURE, SCREEN];

/* ── sampling ─────────────────────────────────────────────────────── */

/** the mark's pivot: shapes are centred here so they turn on the spot */
const PIVOT = 1 / 3;
/** the height a form's foot sits at, in the mark's own coordinates */
export const formFloor = (def: ShapeDef) => PIVOT + def.lift * def.scale;

/* ── baked clouds ─────────────────────────────────────────────────── */

/** points in unit space: y up, feet at 0, centred on the ground plane */
const clouds = new Map<string, Float32Array | null>();

/**
 * Fetch a baked cloud, once. A failure is remembered as null rather than
 * retried: the shape falls back to its field, which is always there.
 */
export async function loadCloud(src: string): Promise<Float32Array | null> {
  const held = clouds.get(src);
  if (held !== undefined) return held;
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error(String(res.status));
    const buf = await res.arrayBuffer();
    const head = new DataView(buf);
    const scale = head.getFloat32(0, true), n = head.getUint32(4, true);
    if (!n || buf.byteLength < 8 + n * 6) throw new Error('short file');
    const q = new Int16Array(buf, 8, n * 3), out = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) out[i] = (q[i] / 32767) * scale;
    clouds.set(src, out);
    return out;
  } catch {
    clouds.set(src, null);
    return null;
  }
}

/** whatever has been fetched for this shape, or null */
export const cloudFor = (def: ShapeDef): Float32Array | null => (def.src ? clouds.get(def.src) ?? null : null);

/**
 * `n` points on the shape's surface, in the mark's own coordinates.
 *
 * Rejection sampling: throw a point into the bounding box, keep it if it is
 * within `shell` of the surface, then slide it exactly onto the surface along
 * the gradient. The result is an even scatter over the skin with no mesh and
 * no UV anywhere in sight. A budget guards against a field that never hits.
 */
export function sampleShape(def: ShapeDef, n: number): Float32Array {
  const out = new Float32Array(n * 3);
  const cloud = cloudFor(def);
  if (cloud) {
    // a baked cloud is already an even scatter over the skin: take n of its
    // points at random, and place them the way a field's points are placed
    const m = cloud.length / 3;
    for (let i = 0; i < n; i++) {
      const k = (Math.random() * m) | 0;
      out[i * 3] = PIVOT + cloud[k * 3] * def.scale;
      out[i * 3 + 1] = PIVOT + (cloud[k * 3 + 1] + def.lift) * def.scale;
      out[i * 3 + 2] = PIVOT + cloud[k * 3 + 2] * def.scale;
    }
    return out;
  }
  const [x0, y0, z0, x1, y1, z1] = def.bounds;
  const w = x1 - x0, h = y1 - y0, dp = z1 - z0;
  const shell = 0.02, e = 0.004;
  const { sdf, scale, lift } = def;

  const nx = (x: number, y: number, z: number) => sdf(x + e, y, z) - sdf(x - e, y, z);
  const ny = (x: number, y: number, z: number) => sdf(x, y + e, z) - sdf(x, y - e, z);
  const nz = (x: number, y: number, z: number) => sdf(x, y, z + e) - sdf(x, y, z - e);

  /** how sharply the surface turns near this point: 0 on a flat wall, 1 on a
   *  corner. An edge is what makes a form legible — it is why the cube gives a
   *  third of its particles to its own outline — so edges get a share here too. */
  const R = 0.045;
  function crease(px: number, py: number, pz: number, gx: number, gy: number, gz: number) {
    // two directions across the surface, from the least-aligned world axis
    const ax = Math.abs(gx) < 0.7 ? 1 : 0, ay = ax ? 0 : 1;
    let t1x = gy * (ax ? 0 : 1) - gz * ay, t1y = gz * ax - gx * (ax ? 0 : 1), t1z = gx * ay - gy * ax;
    const l1 = Math.hypot(t1x, t1y, t1z) || 1; t1x /= l1; t1y /= l1; t1z /= l1;
    const t2x = gy * t1z - gz * t1y, t2y = gz * t1x - gx * t1z, t2z = gx * t1y - gy * t1x;
    let worst = 0;
    for (let k = 0; k < 4; k++) {
      const s1 = k < 2 ? (k === 0 ? R : -R) : 0, s2 = k < 2 ? 0 : (k === 2 ? R : -R);
      let qx = px + t1x * s1 + t2x * s2, qy = py + t1y * s1 + t2y * s2, qz = pz + t1z * s1 + t2z * s2;
      const d = sdf(qx, qy, qz);
      let hx = nx(qx, qy, qz), hy = ny(qx, qy, qz), hz = nz(qx, qy, qz);
      const hl = Math.hypot(hx, hy, hz) || 1;
      qx -= (d * hx) / hl; qy -= (d * hy) / hl; qz -= (d * hz) / hl;     // back onto the skin
      hx = nx(qx, qy, qz); hy = ny(qx, qy, qz); hz = nz(qx, qy, qz);
      const l = Math.hypot(hx, hy, hz) || 1;
      worst = Math.max(worst, 1 - (gx * hx + gy * hy + gz * hz) / l);
    }
    return worst;
  }

  const EDGE_SHARE = 0.45, CREASE = 0.16;
  const edgeWant = Math.round(n * EDGE_SHARE);
  let edges = 0, flats = 0, k = 0;
  let tries = 0;
  const budget = n * 400;
  const put = (x: number, y: number, z: number) => {
    out[k * 3] = PIVOT + x * scale;
    out[k * 3 + 1] = PIVOT + (y + lift) * scale;
    out[k * 3 + 2] = PIVOT + z * scale;
    k++;
  };
  while (k < n && tries < budget) {
    tries++;
    let x = x0 + Math.random() * w, y = y0 + Math.random() * h, z = z0 + Math.random() * dp;
    const d = sdf(x, y, z);
    if (Math.abs(d) > shell) continue;
    // one Newton step down the gradient lands the point on the skin
    let gx = nx(x, y, z), gy = ny(x, y, z), gz = nz(x, y, z);
    let g = Math.hypot(gx, gy, gz) || 1;
    x -= (d * gx) / g; y -= (d * gy) / g; z -= (d * gz) / g;
    gx = nx(x, y, z); gy = ny(x, y, z); gz = nz(x, y, z);
    g = Math.hypot(gx, gy, gz) || 1; gx /= g; gy /= g; gz /= g;
    const onEdge = crease(x, y, z, gx, gy, gz) > CREASE;
    if (onEdge) {
      if (edges >= edgeWant && k < n - (edgeWant - edges)) continue;
      edges++;
    } else {
      if (flats >= n - edgeWant) continue;
      flats++;
    }
    put(x, y, z);
  }
  // a field that under-delivers is padded by repeating what it did give, so a
  // caller always gets a full array and never a hole where a target should be
  for (let j = k; j < n && k > 0; j++) {
    const src = (Math.random() * k) | 0;
    out[j * 3] = out[src * 3]; out[j * 3 + 1] = out[src * 3 + 1]; out[j * 3 + 2] = out[src * 3 + 2];
  }
  return out;
}

/**
 * Which of a skinned cloud's points this plate's particles take, ordered the
 * same way as a field's targets: each particle to the point nearest its own
 * seat, so the cloud unfolds into the form rather than shuffling itself.
 */
export function skinnedIndices(bind: Float32Array, home: Float32Array, count: number): Uint16Array {
  const m = bind.length / 3;
  const pick = new Int32Array(count);
  for (let i = 0; i < count; i++) pick[i] = (Math.random() * m) | 0;
  const keyP = new Float32Array(count), keyH = new Float32Array(count);
  for (let j = 0; j < count; j++) {
    const k = pick[j] * 3;
    keyP[j] = bind[k] + bind[k + 1] + bind[k + 2];
    keyH[j] = home[j * 3] + home[j * 3 + 1] + home[j * 3 + 2];
  }
  const byP = Array.from(pick.keys()).sort((a, b) => keyP[a] - keyP[b]);
  const byH = Array.from(pick.keys()).sort((a, b) => keyH[a] - keyH[b]);
  const out = new Uint16Array(count);
  for (let r = 0; r < count; r++) out[byH[r]] = pick[byP[r]];
  return out;
}

/**
 * Write a posed cloud into one plate's targets: the shape's own placement,
 * less the plate's offset along its normal. Called every frame while an
 * animated form is standing, which is why it does nothing but arithmetic.
 */
export function poseInto(def: ShapeDef, pose: Float32Array, src: Uint16Array, out: Float32Array,
                         ox: number, oy: number, oz: number): void {
  const s = def.scale, l = def.lift, n = src.length;
  for (let j = 0; j < n; j++) {
    const k = src[j] * 3, j3 = j * 3;
    out[j3] = PIVOT + pose[k] * s - ox;
    out[j3 + 1] = PIVOT + (pose[k + 1] + l) * s - oy;
    out[j3 + 2] = PIVOT + pose[k + 2] * s - oz;
  }
}

/**
 * Targets for one plate's particles, ordered so each particle travels to the
 * point nearest its own seat: the cloud unfolds into the shape instead of
 * shuffling itself. A coarse spatial sort (by the diagonal the mark turns on)
 * is enough — the eye reads travel direction, not a perfect assignment.
 */
export function shapeTargets(def: ShapeDef, home: Float32Array, count: number): Float32Array {
  const pts = sampleShape(def, count);
  const order = new Int32Array(count), keyP = new Float32Array(count), keyH = new Float32Array(count);
  const idxH = new Int32Array(count);
  for (let j = 0; j < count; j++) {
    keyP[j] = pts[j * 3] + pts[j * 3 + 1] + pts[j * 3 + 2];
    keyH[j] = home[j * 3] + home[j * 3 + 1] + home[j * 3 + 2];
    order[j] = j; idxH[j] = j;
  }
  const byP = Array.from(order).sort((a, b) => keyP[a] - keyP[b]);
  const byH = Array.from(idxH).sort((a, b) => keyH[a] - keyH[b]);
  const out = new Float32Array(count * 3);
  for (let r = 0; r < count; r++) {
    const h = byH[r], p = byP[r];
    out[h * 3] = pts[p * 3]; out[h * 3 + 1] = pts[p * 3 + 1]; out[h * 3 + 2] = pts[p * 3 + 2];
  }
  return out;
}
