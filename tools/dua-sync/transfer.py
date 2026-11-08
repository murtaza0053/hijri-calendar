"""Map the good old-PDF sync onto the new PDF: align new-PDF OCR lines to the old-PDF OCR char stream,
build a monotonic old-pos -> new-pos map, and re-project every old mark through it."""
import json, re
import numpy as np
HAR = re.compile(r'[ؐ-ًؚ-ٰٟۖ-ۭـ]')
def norm(s):
    s = HAR.sub('', s); s = s.translate(str.maketrans({'أ':'ا','إ':'ا','آ':'ا','ٱ':'ا','ى':'ي','ة':'ه','ؤ':'و','ئ':'ي','ء':''}))
    return re.sub(r'[^ء-ي]', '', s)
old = json.load(open('../asr/ocr.json')); new = json.load(open('ocr.json'))
OLD_SKIP = {(2, 8), (2, 9), (2, 10), (3, 4), (4, 2), (4, 10), (19, 2), (19, 3), (20, 10)}
NEW_SKIP = {(1, 0), (2, 6), (2, 7), (3, 0), (3, 9), (16, 8), (16, 9), (18, 2)}
# old char stream with an old-document position per char
chars, pos = [], []
flat = [(p + 1, i, l) for p, L in enumerate(old) for i, l in enumerate(L) if (p + 1, i) not in OLD_SKIP]
for k, (p, i, l) in enumerate(flat):
    t = norm(l['text'])
    y0 = (p - 1) + l['yc']
    y1 = ((flat[k + 1][0] - 1) + flat[k + 1][2]['yc']) if k + 1 < len(flat) else y0 + 0.07
    for j, ch in enumerate(t):
        chars.append(ch); pos.append(y0 + (y1 - y0) * j / max(1, len(t)))
S = ''.join(chars); pos = np.array(pos); NT = len(S) - 2
ids = {}; st = np.array([ids.setdefault(S[i:i+3], len(ids)) for i in range(NT)])
nl = [(p + 1, i, l) for p, L in enumerate(new) for i, l in enumerate(L) if (p + 1, i) not in NEW_SKIP]
score = np.full((len(nl), NT), -1.0, np.float32)
for k, (p, i, l) in enumerate(nl):
    t = norm(l['text'])
    if len(t) < 8: continue
    ts = {ids[t[j:j+3]] for j in range(len(t) - 2) if t[j:j+3] in ids}
    if not ts: continue
    hit = np.isin(st, list(ts)).astype(np.float32); c = np.concatenate([[0], np.cumsum(hit)])
    w = min(len(t) - 2, NT); s = (c[w:] - c[:-w]) / (len(t) - 2); score[k, :len(s)] = s
gain = score - 0.25
# monotonic DP with skips
G = np.zeros(NT); Gk = np.full(NT, -1); Gp = np.arange(NT); back = []
for k in range(len(nl)):
    adv = 6
    sh = np.zeros(NT); sk = np.full(NT, -1); sp = np.full(NT, -1)
    sh[adv:] = G[:-adv]; sk[adv:] = Gk[:-adv]; sp[adv:] = Gp[:-adv]
    cand = np.where(gain[k] > 0, gain[k] + sh, -1e9); back.append((sk, sp))
    best = np.maximum.accumulate(cand); arg = np.maximum.accumulate(np.where(cand == best, np.arange(NT), 0))
    better = best > G; Gk = np.where(better, k, Gk); Gp = np.where(better, arg, Gp); G = np.where(better, best, G)
path = []; k, p = int(Gk[-1]), int(Gp[-1])
while k >= 0:
    path.append((k, p)); sk, sp = back[k]; k, p = int(sk[p]), int(sp[p])
path.reverse()
pairs = [(0.0, 0.0)]
for k, p in path:
    P, i, l = nl[k]; npos = (P - 1) + l['yc']; opos = float(pos[p])
    if opos > pairs[-1][0] and npos > pairs[-1][1]: pairs.append((opos, npos))
pairs.append((len(old) * 1.0, len(new) * 1.0))
print('matched', len(path), 'of', len(nl), '-> map points', len(pairs))
O = np.array([a for a, b in pairs]); N = np.array([b for a, b in pairs])
f = lambda x: float(np.interp(x, O, N))
M = json.load(open('old_sync.json'))['marks']
out = []
for m in M:
    x = f((m['p'] - 1) + m['y']); pg = int(x)
    out.append({'t': m['t'], 'p': pg + 1, 'y': round(x - pg, 4)})
json.dump({'note': 'mapped from the old-PDF alignment (Whisper + OCR) onto the new PDF', 'marks': out}, open('sync_mapped.json', 'w'), indent=1)
json.dump(pairs, open('map_pairs.json', 'w'))
print('marks', len(out))
