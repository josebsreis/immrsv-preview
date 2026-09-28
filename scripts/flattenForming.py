# Bake the forming film to frames on the page's light: each frame divided by its own
# backdrop (estimated around the figure), so the studio grey becomes #f5f5f7.
#   ffmpeg -i ../final-video.mp4 -vf "select='not(mod(n\,4))',scale=720:1280" -vsync vfr -frames:v 121 DIR/frames/%03d.png
#   python3 scripts/flattenForming.py DIR   -> DIR/flat/*.png, then encode to public/forming/*.avif
import numpy as np, glob, os, sys
from PIL import Image
S=sys.argv[1]
fs=sorted(glob.glob(S+'/frames/*.png'))
def box(a,r):
    for ax in (0,1):
        c=np.cumsum(np.pad(a,[(r+1,r) if i==ax else (0,0) for i in range(a.ndim)],mode='edge'),axis=ax)
        a=(np.take(c,range(2*r+1,c.shape[ax]),axis=ax)-np.take(c,range(0,c.shape[ax]-2*r-1),axis=ax))/(2*r+1)
    return a
def blur(a,r,n=3):
    for _ in range(n): a=box(a,r)
    return a
def fill(v,w,r):
    return blur(v*w,r)/np.maximum(blur(w,r),1e-4), blur(w,r)
page=np.array([0xf5,0xf5,0xf7],dtype=np.float32)/255
os.makedirs(S+'/flat',exist_ok=True)
for f in fs:
    fr=np.asarray(Image.open(f).convert('RGB'),dtype=np.float32)/255
    lum=fr.mean(2)
    # the figure: dark, or strongly coloured (the teal wireframe); grown a little
    sat=fr.max(2)-fr.min(2)
    fig=((lum<0.5)|(sat>0.08)).astype(np.float32)
    fig=(blur(fig,6,2)>0.02).astype(np.float32)
    w=1-fig
    plate=np.zeros_like(fr)
    for c in range(3):
        near,wn=fill(fr[...,c],w,18)
        far,_=fill(fr[...,c],w,90)
        t=np.clip(wn*8,0,1)
        plate[...,c]=near*t+far*(1-t)
    out=np.clip(fr/np.maximum(plate,0.05),0,1)*page
    Image.fromarray((out*255+0.5).astype(np.uint8)).save(S+'/flat/'+os.path.basename(f))
