"""Add per-page printed-border x-range ("frames": [[left, right], ...] as page-width fractions) to a sync.json,
so the app's highlight stays inside the border. Run after `pdftoppm -r 150 -gray -png <pdf> pg`."""
import glob, json, sys
import numpy as np
from PIL import Image
frames = []
for f in sorted(glob.glob('pg-*.png')):
    im = np.array(Image.open(f).convert('L')) < 185; H, W = im.shape
    c = im.mean(0); idx = np.where(c > .25)[0]
    a = idx[0]
    while a + 1 < W and c[a + 1] > .25: a += 1
    b = idx[-1]
    while b - 1 >= 0 and c[b - 1] > .25: b -= 1
    frames.append([round(float(a + 1) / W, 4), round(float(b) / W, 4)])
s = json.load(open(sys.argv[1])); s['frames'] = frames
json.dump(s, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
print(len(frames), 'pages')
