import glob, json, sys
from PIL import Image
import numpy as np
out = []
for f in sorted(glob.glob('pg-*.png')):
    im = np.array(Image.open(f).convert('L')) < 128
    H, W = im.shape
    # find inner frame: the thick border is the first/last rows/cols with very high ink across the page
    c = im.mean(0); r = im.mean(1)
    def edges(v):
        idx = np.where(v > .25)[0]
        a = idx[0]
        while a + 1 < len(v) and v[a + 1] > .25: a += 1
        b = idx[-1]
        while b - 1 >= 0 and v[b - 1] > .25: b -= 1
        return a, b
    x0, x1 = edges(c); y0, y1 = edges(r)
    m = 14
    inner = im[y0+m:y1-m, x0+m:x1-m]
    prof = inner.mean(1)
    # smooth and threshold to find text bands
    k = 5; sm = np.convolve(prof, np.ones(k)/k, mode='same')
    on = sm > 0.02
    bands = []; i = 0; n = len(on)
    while i < n:
        if on[i]:
            j = i
            while j < n and on[j]: j += 1
            bands.append([i, j]); i = j
        else: i += 1
    # merge bands separated by tiny gaps (harakat), drop tiny bands
    merged = []
    for b in bands:
        if merged and b[0] - merged[-1][1] < 8: merged[-1][1] = b[1]
        else: merged.append(b)
    merged = [b for b in merged if b[1]-b[0] > 18]
    lines = []
    for a, b in merged:
        ink = inner[a:b].sum()
        lines.append({"y0": (y0+m+a)/H, "y1": (y0+m+b)/H, "ink": int(ink), "h": b-a,
                      "crop": [int(x0+m), int(y0+m+a), int(x1-m), int(y0+m+b)]})
    out.append({"file": f, "lines": lines})
    print(f, len(lines), [round(float(l["y0"]),3) for l in lines], (x0,x1,y0,y1))
json.dump(out, open('lines.json', 'w'))
