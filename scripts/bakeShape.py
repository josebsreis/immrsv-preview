"""Bake a Blender mesh into a cloud of surface points for the hero's mark.

Run through Blender, never on its own:

  blender --background <file.blend> --python scripts/bakeShape.py -- \
      --out public/shapes/figure.bin [--action Female_Idle --frame 12 --points 7200]

The mesh is evaluated with its modifiers and its pose, triangulated, and
sampled area-weighted so the density is even over the skin rather than
bunched where the topology happens to be dense. The result is normalised —
y up, feet at the floor, centred on the ground plane, longest axis one unit
— then quantised to 16 bits, which is finer than a particle a third of a
pixel wide could ever show.

The file is [float32 scale][uint32 count][int16 xyz]*count, little-endian.
Nothing of Blender, the .blend, or the mesh reaches the browser.
"""
import bpy, sys, struct, random, math, argparse

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--out', required=True)
ap.add_argument('--action', default=None)
ap.add_argument('--frame', type=int, default=0)
ap.add_argument('--points', type=int, default=7200)
ap.add_argument('--seed', type=int, default=7)
a = ap.parse_args(argv)

# pose the rig, if one was asked for
if a.action:
    for ob in bpy.data.objects:
        if ob.type == 'ARMATURE':
            if not ob.animation_data:
                ob.animation_data_create()
            act = bpy.data.actions.get(a.action)
            if act is None:
                raise SystemExit('no action named ' + a.action)
            ob.animation_data.action = act
bpy.context.scene.frame_set(a.frame)

dg = bpy.context.evaluated_depsgraph_get()
tris = []          # (v0, v1, v2) in world space
for ob in bpy.context.scene.objects:
    if ob.type != 'MESH' or ob.hide_render:
        continue
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    M = ob.matrix_world
    vs = [M @ v.co for v in me.vertices]
    for t in me.loop_triangles:
        i, j, k = t.vertices
        tris.append((vs[i], vs[j], vs[k]))
    ev.to_mesh_clear()
if not tris:
    raise SystemExit('no mesh found')

# area-weighted sampling: a big triangle takes proportionally more points, so
# the cloud reads as a skin and not as a map of the modeller's topology
areas, total = [], 0.0
for v0, v1, v2 in tris:
    ar = (v1 - v0).cross(v2 - v0).length * 0.5
    total += ar
    areas.append(total)

random.seed(a.seed)
pts = []
for _ in range(a.points):
    r = random.random() * total
    lo, hi = 0, len(areas) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if areas[mid] < r: lo = mid + 1
        else: hi = mid
    v0, v1, v2 = tris[lo]
    u, v = random.random(), random.random()
    if u + v > 1.0: u, v = 1.0 - u, 1.0 - v
    pts.append(v0 + (v1 - v0) * u + (v2 - v0) * v)

# normalise: y up, feet on the floor, centred on the ground plane, unit tall
xs = [p.x for p in pts]; ys = [p.y for p in pts]; zs = [p.z for p in pts]
# Blender is z-up; the mark's frame is y-up
cx = (min(xs) + max(xs)) * 0.5
cy = (min(ys) + max(ys)) * 0.5
h = max(max(zs) - min(zs), 1e-6)
floor = min(zs)
out = []
for p in pts:
    out.append(((p.x - cx) / h, (p.z - floor) / h, (p.y - cy) / h))

span = max(max(abs(c) for c in q) for q in out)
scale = span * 1.0000305                       # keep the quantiser inside range
with open(a.out, 'wb') as f:
    f.write(struct.pack('<fI', scale, len(out)))
    for q in out:
        f.write(struct.pack('<3h', *(int(round(c / scale * 32767)) for c in q)))
print('baked', len(out), 'points ->', a.out, '| scale', round(scale, 4))
