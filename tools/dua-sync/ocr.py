import json, subprocess, os, statistics
from PIL import Image
pages = json.load(open('lines.json'))
hs = [l['h'] for p in pages for l in p['lines']]; med = statistics.median(hs)
env = dict(os.environ, TESSDATA_PREFIX=os.path.abspath('tessdata'))
res = []
for pi, p in enumerate(pages):
    im = Image.open(p['file']); H = im.size[1]
    L = []
    for l in p['lines']:
        n = max(1, round(l['h'] / med)) if l['h'] > 1.4 * med else 1
        x0, y0, x1, y1 = l['crop']
        for k in range(n):
            a = y0 + (y1 - y0) * k // n; b = y0 + (y1 - y0) * (k + 1) // n
            crop = im.crop((x0, max(0, a - 6), x1, b + 6)); crop.save('line.png')
            txt = subprocess.run(['tesseract', 'line.png', '-', '-l', 'ara', '--psm', '7'], capture_output=True, text=True, env=env).stdout.strip()
            L.append({"y": round(a / H, 4), "yc": round((a + b) / 2 / H, 4), "w": (x1 - x0), "text": txt, "split": n > 1})
    res.append(L)
    print(pi + 1, len(L), ' | '.join(x['text'][:25] for x in L[:3]), flush=True)
json.dump(res, open('ocr.json', 'w'), ensure_ascii=False, indent=0)
