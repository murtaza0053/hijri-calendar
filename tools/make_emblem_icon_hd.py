"""High-res (2048) 3D gold emblem icon. SRC = the emblem reference image (the Dawoodi Bohras logo screenshot, 809x805; not stored in the repo). Usage: python make_emblem_icon_hd.py <ref.png> <out_dir>  -> icon-2048.png + ornament-2048.png (transparent)."""
import sys, numpy as np
from PIL import Image, ImageFilter
SRC, OUT = sys.argv[1], sys.argv[2]
S = 2048; K = S / 1024
im = np.array(Image.open(SRC).convert('RGB')).astype(int)
R, G, B = im[..., 0], im[..., 1], im[..., 2]
soft = np.clip((R - B - 25) / 90.0, 0, 1) * ((R > 100) & (G > 70))
band = slice(489, 501)                           # text-box top line: keep only columns where the emblem really is above/below it
colkeep = ((soft[485] > .5) | (soft[504] > .5)).astype(np.float32)
colkeep = np.maximum.reduce([np.roll(colkeep, d) for d in range(-3, 4)])
soft[band] = soft[band] * colkeep
soft[521:, :] = 0; soft[:, :190] = 0; soft[:, 620:] = 0
ys, xs = np.where(soft > .5); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
m = (soft[y0:y1 + 1, x0:x1 + 1] * 255).astype(np.uint8)
h, w = m.shape
scale = min(0.72 * S / w, 0.62 * S / h)
nw, nh = int(w * scale), int(h * scale)
mi = Image.fromarray(m).resize((nw, nh), Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.1 * K))
mm = np.array(mi).astype(np.float32) / 255
mm = np.clip((mm - 0.5) * 8 + 0.5, 0, 1)       # crisp, smooth edge at full resolution
shape = np.zeros((S, S), np.float32)
ox, oy = (S - nw) // 2, (S - nh) // 2 + int(10 * K)
shape[oy:oy + nh, ox:ox + nw] = mm
def blur(arr, r):
    return np.array(Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r * K))).astype(np.float32) / 255
h_ = blur(shape, 5) * shape + 0.4 * blur(shape, 1.6) * shape
gy, gx = np.gradient(h_ * 22.0 / K)
nrm = np.sqrt(gx ** 2 + gy ** 2 + 1)
nx, ny, nz = -gx / nrm, -gy / nrm, 1 / nrm
L = np.array([-0.55, -0.65, 0.52]); L /= np.linalg.norm(L)
diff = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
Hh = L + np.array([0, 0, 1.0]); Hh /= np.linalg.norm(Hh)
spec = np.clip(nx * Hh[0] + ny * Hh[1] + nz * Hh[2], 0, 1) ** 36
stops = [(0.0, (92, 62, 10)), (0.35, (160, 116, 28)), (0.6, (206, 162, 58)), (0.82, (240, 206, 112)), (1.0, (255, 240, 190))]
def ramp(v):
    out = np.zeros(v.shape + (3,), np.float32)
    for (p, cp), (q, cq) in zip(stops, stops[1:]):
        sel = (v >= p) & (v <= q); t = ((v - p) / (q - p))[..., None]
        out[sel] = (np.array(cp) * (1 - t) + np.array(cq) * t)[sel]
    return out
goldc = np.clip(ramp(np.clip(0.15 + 0.85 * diff, 0, 1)) + spec[..., None] * 230, 0, 255)
yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) / S
rr = np.clip(np.sqrt((xx - 0.45) ** 2 + (yy - 0.38) ** 2) / 0.85, 0, 1)[..., None]
c0, c1, shadow = np.array([255, 253, 247]), np.array([226, 218, 200]), 0.28
bg = c0 * (1 - rr) + c1 * rr
sh = np.roll(np.roll(blur(shape, 10), int(12 * K), axis=0), int(7 * K), axis=1)
bg = bg * (1 - shadow * sh[..., None])
al = shape[..., None]
img = Image.fromarray(np.clip(bg * (1 - al) + goldc * al, 0, 255).astype(np.uint8))
img.save(f'{OUT}/icon-2048.png')
# transparent ornament (splash), tight crop padding inside a square
rgba = np.dstack([goldc, shape * 255]).astype(np.uint8)
Image.fromarray(rgba, 'RGBA').save(f'{OUT}/ornament-2048.png')
print('ok', (x0, x1, y0, y1), nw, nh)
