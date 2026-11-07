"""Original 3D app icon: gold mihrab arch + crescent + 8-point star on deep emerald, bevel-lit."""
import math, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 1024
SS = 2  # supersample for crisp edges
N = S * SS
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'

def blank(): return Image.new('L', (N, N), 0)

# ---------- shapes (in 1024 units, scaled by SS) ----------
def P(x, y): return (x * SS, y * SS)

def arch_path(cx, base, w, h, k=0.62, steps=120):
    """Pointed (mihrab) arch outline: vertical sides then two arcs meeting at a point."""
    half = w / 2
    spring = base - h * (1 - k)          # where the arcs start
    top = base - h
    # each arc: circle through (cx-half, spring) and apex (cx, top), centered on spring line
    # center x = cx - half + r ; r chosen so circle passes the apex
    dx = half; dy = spring - top
    r = (dx * dx + dy * dy) / (2 * dx)
    pts = [(cx - half, base)]
    cxl = cx - half + r
    a0 = math.pi; a1 = math.atan2(top - spring, cx - cxl)  # left arc from 180deg up to apex
    if a1 < a0: a1 += 2 * math.pi  # go 'up' (screen coords) from the left side to the apex
    for i in range(steps + 1):
        a = a0 + (a1 - a0) * i / steps
        pts.append((cxl + r * math.cos(a), spring + r * math.sin(a)))
    cxr = cx + half - r
    b0 = math.atan2(top - spring, cx - cxr); b1 = 0.0
    for i in range(steps + 1):
        a = b0 + (b1 - b0) * i / steps
        pts.append((cxr + r * math.cos(a), spring + r * math.sin(a)))
    pts.append((cx + half, base))
    return pts

def poly(img, pts, fill=255):
    ImageDraw.Draw(img).polygon([P(x, y) for x, y in pts], fill=fill)

def star8(cx, cy, R, r):
    pts = []
    for i in range(16):
        a = -math.pi / 2 + i * math.pi / 8
        rr = R if i % 2 == 0 else r
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts

# arch frame (ring)
outer = blank(); poly(outer, arch_path(512, 840, 560, 660))
inner = blank(); poly(inner, arch_path(512, 808, 492, 600))
arch = Image.fromarray(np.minimum(np.array(outer), 255 - np.array(inner)).astype(np.uint8))
# base bar under the arch
d = ImageDraw.Draw(arch)
d.rounded_rectangle([P(196, 832), P(828, 872)], radius=14 * SS, fill=255)

# crescent
cres = blank(); dc = ImageDraw.Draw(cres)
dc.ellipse([P(512 - 205, 470 - 205), P(512 + 205, 470 + 205)], fill=255)
cut = blank(); ImageDraw.Draw(cut).ellipse([P(512 - 168 + 78, 470 - 178), P(512 + 168 + 78, 470 + 158)], fill=255)
cres = Image.fromarray(np.minimum(np.array(cres), 255 - np.array(cut)).astype(np.uint8))

# 8-point star in the crescent's opening
star = blank(); poly(star, star8(600, 452, 96, 52))
hole = blank(); ImageDraw.Draw(hole).ellipse([P(600 - 26, 452 - 26), P(600 + 26, 452 + 26)], fill=255)
star = Image.fromarray(np.minimum(np.array(star), 255 - np.array(hole)).astype(np.uint8))

# small finial on the arch apex
fin = blank(); df = ImageDraw.Draw(fin)
df.ellipse([P(512 - 20, 150), P(512 + 20, 190)], fill=255)
poly(fin, [(512, 92), (530, 150), (512, 166), (494, 150)])

shape = np.maximum.reduce([np.array(arch), np.array(cres), np.array(star), np.array(fin)]).astype(np.float32) / 255

# ---------- 3D bevel lighting ----------
def blur(a, r):
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    return np.array(im.filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255

h = blur(shape, 9 * SS) * shape                 # rounded bevel height
h = h + 0.35 * blur(shape, 3 * SS) * shape      # sharper rim detail
gy, gx = np.gradient(h * 40.0)
nz = np.ones_like(h)
nrm = np.sqrt(gx ** 2 + gy ** 2 + nz ** 2)
nx, ny, nz = -gx / nrm, -gy / nrm, nz / nrm
L = np.array([-0.55, -0.65, 0.52]); L /= np.linalg.norm(L)
diff = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
Hh = L + np.array([0, 0, 1.0]); Hh /= np.linalg.norm(Hh)
spec = np.clip(nx * Hh[0] + ny * Hh[1] + nz * Hh[2], 0, 1) ** 40

# gold ramp
stops = [(0.0, (92, 62, 10)), (0.35, (160, 116, 28)), (0.6, (214, 170, 62)), (0.82, (246, 214, 120)), (1.0, (255, 243, 196))]
def ramp(v):
    out = np.zeros(v.shape + (3,), np.float32)
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        m = (v >= a) & (v <= b)
        t = ((v - a) / (b - a))[..., None]
        out[m] = (np.array(ca) * (1 - t) + np.array(cb) * t)[m]
    return out
gold = ramp(np.clip(0.15 + 0.85 * diff, 0, 1))
gold = np.clip(gold + spec[..., None] * 255 * 0.9, 0, 255)

# ---------- background: deep emerald radial gradient + subtle pattern ----------
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32) / N
rr = np.sqrt((xx - 0.45) ** 2 + (yy - 0.38) ** 2)
c0, c1 = np.array([24, 110, 72]), np.array([4, 34, 22])
bg = c0 * (1 - np.clip(rr / 0.85, 0, 1))[..., None] + c1 * np.clip(rr / 0.85, 0, 1)[..., None]
# faint geometric lattice
lat = (np.abs(np.sin(xx * math.pi * 14 + yy * math.pi * 14)) < 0.04) | (np.abs(np.sin(xx * math.pi * 14 - yy * math.pi * 14)) < 0.04)
bg = bg + lat[..., None] * 6

# drop shadow
sh = blur(shape, 14 * SS)
sh = np.roll(np.roll(sh, 14 * SS, axis=0), 8 * SS, axis=1)
bg = bg * (1 - 0.55 * sh[..., None])

a = shape[..., None]
img = bg * (1 - a) + gold * a
im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).resize((S, S), Image.LANCZOS)
im.save(f'{OUT}/icon-1024.png')
for size, name in [(512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png'), (32, 'favicon-32.png')]:
    im.resize((size, size), Image.LANCZOS).save(f'{OUT}/{name}')
print('ok')
