"""3D gold app icon from an emblem image (the user's reference, not stored in the repo): gold mask -> smooth upscale -> bevel lighting.
Usage: python make_emblem_icon.py <source.png> <out_dir> [white|green]"""
import sys
import numpy as np
from PIL import Image, ImageFilter

SRC, OUT, BG = sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else 'white'
S = 1024
im = np.array(Image.open(SRC).convert('RGB')).astype(int)
R, G, B = im[..., 0], im[..., 1], im[..., 2]
gold = ((R - B > 55) & (R > 110) & (G > 80))
# drop the text-box top line (rows 492-497) except where the emblem crosses it
for y in range(491, 499):
    keep = gold[y - 6] & gold[y + 6]
    gold[y] &= keep
gold[521:, :] = False
gold[:, :190] = False; gold[:, 620:] = False  # box sides
ys, xs = np.where(gold)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
m = gold[y0:y1 + 1, x0:x1 + 1].astype(np.float32)

# fit emblem into the icon (keep inside the maskable safe zone ~72%)
h, w = m.shape
scale = min(0.72 * S / w, 0.62 * S / h)
nw, nh = int(w * scale), int(h * scale)
mi = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
mi = mi.resize((nw, nh), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2))
mm = (np.array(mi).astype(np.float32) / 255)
mm = np.clip((mm - 0.5) * 6 + 0.5, 0, 1)  # re-sharpen edge after upscale
shape = np.zeros((S, S), np.float32)
ox, oy = (S - nw) // 2, (S - nh) // 2 + 10
shape[oy:oy + nh, ox:ox + nw] = mm

def blur(a, r):
    return np.array(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255

h_ = blur(shape, 5) * shape + 0.4 * blur(shape, 1.6) * shape
gy, gx = np.gradient(h_ * 22.0)
nrm = np.sqrt(gx ** 2 + gy ** 2 + 1)
nx, ny, nz = -gx / nrm, -gy / nrm, 1 / nrm
L = np.array([-0.55, -0.65, 0.52]); L /= np.linalg.norm(L)
diff = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
Hh = L + np.array([0, 0, 1.0]); Hh /= np.linalg.norm(Hh)
spec = np.clip(nx * Hh[0] + ny * Hh[1] + nz * Hh[2], 0, 1) ** 36
stops = [(0.0, (92, 62, 10)), (0.35, (160, 116, 28)), (0.6, (206, 162, 58)), (0.82, (240, 206, 112)), (1.0, (255, 240, 190))]
def ramp(v):
    out = np.zeros(v.shape + (3,), np.float32)
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        sel = (v >= a) & (v <= b); t = ((v - a) / (b - a))[..., None]
        out[sel] = (np.array(ca) * (1 - t) + np.array(cb) * t)[sel]
    return out
goldc = np.clip(ramp(np.clip(0.15 + 0.85 * diff, 0, 1)) + spec[..., None] * 230, 0, 255)

yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) / S
rr = np.clip(np.sqrt((xx - 0.45) ** 2 + (yy - 0.38) ** 2) / 0.85, 0, 1)[..., None]
if BG == 'white':
    c0, c1, shadow = np.array([255, 253, 247]), np.array([226, 218, 200]), 0.28
else:
    c0, c1, shadow = np.array([24, 110, 72]), np.array([4, 34, 22]), 0.55
bg = c0 * (1 - rr) + c1 * rr
sh = np.roll(np.roll(blur(shape, 10), 12, axis=0), 7, axis=1)
bg = bg * (1 - shadow * sh[..., None])
a = shape[..., None]
img = Image.fromarray(np.clip(bg * (1 - a) + goldc * a, 0, 255).astype(np.uint8))
img.save(f'{OUT}/icon-1024.png')
for size, name in [(512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png')]:
    img.resize((size, size), Image.LANCZOS).save(f'{OUT}/{name}')
print('ok', (x0, x1, y0, y1))
