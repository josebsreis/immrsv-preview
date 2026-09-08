"""Bake a rigged Blender character into an animated cloud of surface points.

  blender --background <file.blend> --python scripts/bakeSkinned.py -- \
      --out public/shapes/figure.skin --action Female_Idle \
      --start 0 --end 100 --step 4 --points 7200

Per-frame point positions would be the obvious thing to bake, and they are
far too heavy: a frame is a full set of coordinates, so a second of motion
runs to a megabyte. Instead this bakes what the animation actually is — a
few bones moving — and lets the browser do the skinning it was always going
to be cheap enough to do.

So: points are sampled once over the bind pose and carry the bones that move
them, and each frame is 31 small matrices. A whole idle loop costs less than
four baked frames would.

The file is little-endian:
  'IMSK'                       magic
  uint32 points, bones, frames
  float32 bindScale, fps
  int16  bind[points*3]        bind position, quantised by bindScale
  uint8  index[points*4]       which bones move it
  uint8  weight[points*4]      by how much, /255
  float32 mat[frames*bones*12] row-major 3x4: pose · bind-inverse, already
                               carrying the y-up, feet-at-nought, unit-tall
                               normalisation the mark works in
"""
import bpy, sys, struct, random, argparse
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--out', required=True)
ap.add_argument('--action', required=True)
ap.add_argument('--start', type=int, default=0)
ap.add_argument('--end', type=int, default=None)
ap.add_argument('--step', type=int, default=4)
ap.add_argument('--fps', type=float, default=24.0)
ap.add_argument('--points', type=int, default=7200)
ap.add_argument('--seed', type=int, default=7)
a = ap.parse_args(argv)

mesh_ob = next((o for o in bpy.context.scene.objects if o.type == 'MESH'), None)
arm_ob = next((o for o in bpy.context.scene.objects if o.type == 'ARMATURE'), None)
if mesh_ob is None or arm_ob is None:
    raise SystemExit('need one mesh and one armature')

act = bpy.data.actions.get(a.action)
if act is None:
    raise SystemExit('no action named ' + a.action)
if not arm_ob.animation_data:
    arm_ob.animation_data_create()
arm_ob.animation_data.action = act
end = a.end if a.end is not None else int(act.frame_range[1])

bones = [b.name for b in arm_ob.data.bones]
bone_at = {n: i for i, n in enumerate(bones)}
if len(bones) > 255:
    raise SystemExit('too many bones for a byte index')

# ── the bind pose: vertices in world space, and the bones that move them ──
me = mesh_ob.data
MW = mesh_ob.matrix_world
verts = [MW @ v.co for v in me.vertices]
groups = {g.index: g.name for g in mesh_ob.vertex_groups}
vw = []                                    # per vertex: {bone index: weight}
for v in me.vertices:
    w = {}
    for g in v.groups:
        name = groups.get(g.group)
        if name in bone_at and g.weight > 0:
            w[bone_at[name]] = w.get(bone_at[name], 0.0) + g.weight
    s = sum(w.values())
    vw.append({k: x / s for k, x in w.items()} if s > 0 else {})

me.calc_loop_triangles()
tris = [tuple(t.vertices) for t in me.loop_triangles]
areas, total = [], 0.0
for i, j, k in tris:
    total += (verts[j] - verts[i]).cross(verts[k] - verts[i]).length * 0.5
    areas.append(total)

bvh = BVHTree.FromPolygons([v.copy() for v in verts], tris, all_triangles=True)

random.seed(a.seed)
pts, idx, wgt, tries = [], [], [], 0
while len(pts) < a.points and tries < a.points * 60:
    tries += 1
    r = random.random() * total
    lo, hi = 0, len(areas) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if areas[mid] < r: lo = mid + 1
        else: hi = mid
    i, j, k = tris[lo]
    u, v = random.random(), random.random()
    if u + v > 1.0: u, v = 1.0 - u, 1.0 - v
    bary = (1.0 - u - v, u, v)
    nrm = (verts[j] - verts[i]).cross(verts[k] - verts[i])
    if nrm.length < 1e-9:
        continue
    p = verts[i] * bary[0] + verts[j] * bary[1] + verts[k] * bary[2]
    if bvh.ray_cast(p + nrm.normalized() * 1e-4, nrm.normalized(), 1e4)[0] is not None:
        continue                            # buried: nothing can see it
    w = {}
    for c, vi in zip(bary, (i, j, k)):
        for b, x in vw[vi].items():
            w[b] = w.get(b, 0.0) + c * x
    top = sorted(w.items(), key=lambda kv: -kv[1])[:4]
    s = sum(x for _, x in top)
    if s <= 0:
        continue
    pts.append(p)
    ids = [b for b, _ in top] + [0] * (4 - len(top))
    ws = [x / s for _, x in top] + [0.0] * (4 - len(top))
    q = [max(0, min(255, int(round(x * 255)))) for x in ws]
    q[0] += 255 - sum(q)                    # the weights must still sum to one
    idx.append(ids); wgt.append(q)
if len(pts) < a.points:
    raise SystemExit('only sampled %d points' % len(pts))

# ── the normalisation the mark works in ──────────────────────────────────
# Blender is z-up; the mark is y-up with the feet at nought, centred on the
# ground plane and one unit tall. As an affine it can ride on the bone
# matrices, so the browser never has to know any of this happened.
xs = [p.x for p in pts]; ys = [p.y for p in pts]; zs = [p.z for p in pts]
cx = (min(xs) + max(xs)) * 0.5
cy = (min(ys) + max(ys)) * 0.5
h = max(max(zs) - min(zs), 1e-6)
floor = min(zs)
N = Matrix(((1 / h, 0, 0, -cx / h),
            (0, 0, 1 / h, -floor / h),
            (0, 1 / h, 0, -cy / h),
            (0, 0, 0, 1)))

binds = {}
for bi, name in enumerate(bones):
    binds[bi] = (arm_ob.matrix_world @ arm_ob.data.bones[name].matrix_local).inverted()

frames = list(range(a.start, end + 1, a.step))
mats = []
for f in frames:
    bpy.context.scene.frame_set(f)
    for bi, name in enumerate(bones):
        pb = arm_ob.pose.bones[name]
        M = N @ (arm_ob.matrix_world @ pb.matrix) @ binds[bi]
        mats.append(M)

span = max(max(abs(c) for c in (p.x, p.y, p.z)) for p in pts)
bind_scale = span * 1.0000305
with open(a.out, 'wb') as f:
    f.write(b'IMSK')
    f.write(struct.pack('<3I2f', len(pts), len(bones), len(frames), bind_scale, a.fps / a.step))
    for p in pts:
        f.write(struct.pack('<3h', *(int(round(c / bind_scale * 32767)) for c in (p.x, p.y, p.z))))
    for ids in idx:
        f.write(struct.pack('<4B', *ids))
    for q in wgt:
        f.write(struct.pack('<4B', *q))
    for M in mats:
        for r in range(3):
            f.write(struct.pack('<4f', *M[r]))
print('baked', len(pts), 'points |', len(bones), 'bones |', len(frames), 'frames ->', a.out)
