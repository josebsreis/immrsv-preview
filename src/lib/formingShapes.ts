/* The handover cards' marks, as thin-line solids: each is a set of polylines
   in three dimensions, drawn as one hairline path. The page draws them seen
   straight on; scripts/ui/formingMarks.ts turns them slowly on the spot and
   draws them again each frame. Units are px from the middle of a 48px box,
   z towards the reader. One per card, in the order of the cards. */

export type P3 = [number, number, number];
export type Shape = P3[][];

const TAU = Math.PI * 2;

/** a circle of radius r about the given axis, closed */
const circle = (r: number, axis: 'x' | 'y' | 'z', n = 40, at: P3 = [0, 0, 0]): P3[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * TAU, c = Math.cos(a) * r, s = Math.sin(a) * r;
    const p: P3 = axis === 'z' ? [c, s, 0] : axis === 'y' ? [c, 0, s] : [0, c, s];
    return [p[0] + at[0], p[1] + at[1], p[2] + at[2]];
  });

/** a cube's twelve edges, half-size e */
const cube = (e: number): P3[][] => {
  const v = (x: number, y: number, z: number): P3 => [x * e, y * e, z * e];
  return [
    [v(-1, -1, -1), v(1, -1, -1), v(1, 1, -1), v(-1, 1, -1), v(-1, -1, -1)],
    [v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1), v(-1, -1, 1)],
    [v(-1, -1, -1), v(-1, -1, 1)], [v(1, -1, -1), v(1, -1, 1)],
    [v(1, 1, -1), v(1, 1, 1)], [v(-1, 1, -1), v(-1, 1, 1)],
  ];
};

export const SHAPES: Shape[] = [
  /* scale without the overhead: a focus — two rings at right angles */
  [circle(17, 'y'), circle(17, 'x'), circle(4, 'z', 20)],
  /* one partner, more capabilities: a lattice — a cube with its middles crossed */
  [...cube(12),
    [[-12, 0, 0], [12, 0, 0]], [[0, -12, 0], [0, 12, 0]], [[0, 0, -12], [0, 0, 12]]],
  /* built into your workflow: a sphere — rings of latitude and a meridian */
  [circle(18, 'y'), ...[-11, 11].map((y) => circle(Math.sqrt(18 * 18 - y * y), 'y', 40, [0, y, 0])),
    circle(18, 'x'), circle(18, 'z')],
  /* from concept to experience: a helix, rising */
  [Array.from({ length: 121 }, (_, i) => {
    const a = (i / 120) * TAU * 2.5, r = 13;
    return [Math.cos(a) * r, (i / 120 - 0.5) * 36, Math.sin(a) * r] as P3;
  })],
  /* capacity when it matters: a cube — the mark's own form */
  cube(13),
  /* more than production: a torus — a ring of rings */
  Array.from({ length: 8 }, (_, k) => {
    const u = (k / 8) * TAU, R = 13, r = 5.5;
    return Array.from({ length: 21 }, (_, i) => {
      const v = (i / 20) * TAU;
      return [(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)] as P3;
    });
  }).concat([circle(13, 'y', 48)]),
];

/** the axis leans out of the screen, so a ring is never seen edge-on for long */
export const TILT = 0.55;

/** the shape turned by `th` about the upright, leaned by TILT, as a path */
export function pathOf(shape: Shape, th: number): string {
  const c = Math.cos(th), s = Math.sin(th), ct = Math.cos(TILT), st = Math.sin(TILT);
  let d = '';
  for (const line of shape) {
    line.forEach(([x, y, z], i) => {
      const x1 = x * c + z * s, z1 = -x * s + z * c;
      const y2 = y * ct - z1 * st;
      d += `${i ? 'L' : 'M'}${(x1 + 24).toFixed(2)} ${(y2 + 24).toFixed(2)}`;
    });
  }
  return d;
}
