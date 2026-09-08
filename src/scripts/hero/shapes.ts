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
  /** signed distance, authored with y up and the feet near y = 0 */
  readonly sdf: (x: number, y: number, z: number) => number;
  /** the box to sample inside: [minX, minY, minZ, maxX, maxY, maxZ] */
  readonly bounds: readonly [number, number, number, number, number, number];
  /** multiplied onto the authored coordinates before they reach the mark */
  readonly scale: number;
  /** lifted by this after scaling, so the shape sits centred on the pivot */
  readonly lift: number;
}

/** A standing figure: the studio that builds people and creatures. Not a
 *  likeness — a maquette, the thing that sits on a modeller's shelf. Weight
 *  on one leg, arms just off the body, so the silhouette has air in it. */
const FIGURE: ShapeDef = {
  name: 'figure',
  scale: 1.62,
  lift: -0.475,
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

/** A house: the studio that draws buildings. A gable and a chimney read as
 *  architecture at a glance, which a clever modernist section does not —
 *  at this resolution the silhouette is the whole argument. */
const HOUSE: ShapeDef = {
  name: 'house',
  scale: 1.7,
  lift: -0.40,
  bounds: [-0.6, -0.04, -0.44, 0.6, 0.86, 0.44],
  sdf(x, y, z) {
    // the walls, with the openings cut out of them
    let walls = roundBox(x, y - 0.26, z, 0.40, 0.26, 0.30, 0.012);
    walls = sub(walls, roundBox(x + 0.16, y - 0.135, z - 0.30, 0.075, 0.135, 0.06, 0.01));   // door
    walls = sub(walls, roundBox(x - 0.19, y - 0.34, z - 0.30, 0.085, 0.075, 0.06, 0.01));    // front window
    walls = sub(walls, roundBox(x - 0.40, y - 0.34, z + 0.10, 0.06, 0.075, 0.085, 0.01));    // side window
    walls = sub(walls, roundBox(x - 0.40, y - 0.34, z - 0.10, 0.06, 0.075, 0.085, 0.01));
    // the roof, oversailing the walls a little on every side
    const roof = gable(x, y - 0.50, z, 0.455, 0.30, 0.335);
    let d = uni(walls, roof);
    d = uni(d, roundBox(x - 0.20, y - 0.70, z + 0.09, 0.045, 0.115, 0.045, 0.008));          // chimney
    d = uni(d, roundBox(x, y + 0.005, z, 0.47, 0.018, 0.37, 0.008));                          // the ground it stands on
    return d;
  },
};

/** A screen: the studio that ships software. A slab held a few degrees off
 *  vertical on a stem, the way a monitor stands on a desk — thin enough to
 *  read as a surface, not a brick. */
const SCREEN: ShapeDef = {
  name: 'screen',
  scale: 1.66,
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

export const SHAPES: readonly ShapeDef[] = [FIGURE, HOUSE, SCREEN];

/* ── sampling ─────────────────────────────────────────────────────── */

/** the mark's pivot: shapes are centred here so they turn on the spot */
const PIVOT = 1 / 3;

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
  const [x0, y0, z0, x1, y1, z1] = def.bounds;
  const w = x1 - x0, h = y1 - y0, dp = z1 - z0;
  const shell = 0.02, e = 0.004;
  const { sdf, scale, lift } = def;
  let k = 0, tries = 0;
  const budget = n * 220;
  while (k < n && tries < budget) {
    tries++;
    let x = x0 + Math.random() * w, y = y0 + Math.random() * h, z = z0 + Math.random() * dp;
    const d = sdf(x, y, z);
    if (Math.abs(d) > shell) continue;
    // one Newton step down the gradient lands the point on the skin
    const gx = sdf(x + e, y, z) - sdf(x - e, y, z);
    const gy = sdf(x, y + e, z) - sdf(x, y - e, z);
    const gz = sdf(x, y, z + e) - sdf(x, y, z - e);
    const g = Math.hypot(gx, gy, gz) || 1;
    x -= (d * gx) / g; y -= (d * gy) / g; z -= (d * gz) / g;
    out[k * 3] = PIVOT + x * scale;
    out[k * 3 + 1] = PIVOT + (y + lift) * scale;
    out[k * 3 + 2] = PIVOT + z * scale;
    k++;
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
