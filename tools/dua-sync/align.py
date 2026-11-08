"""Align Whisper word timestamps (Arabic) to OCR'd PDF lines -> sync.json marks.

Score: for each text line and each ASR char position, fraction of the line's char-trigrams found in the
ASR window of the same length. A DP picks a monotonic path through an *expanded* script in which
repeat blocks (3x / 11x) may be repeated; any line may be skipped (instruction lines, OCR failures).
"""
import json, re, sys
import numpy as np

words = json.load(open(sys.argv[1]))
ocr = json.load(open('ocr.json'))
OUT = sys.argv[2]

HARAKAT = re.compile(r'[ؐ-ًؚ-ٰٟۖ-ۭـ]')
def norm(s):
    s = HARAKAT.sub('', s)
    s = s.translate(str.maketrans({'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ى': 'ي', 'ة': 'ه', 'ؤ': 'و', 'ئ': 'ي', 'ء': '', 'ک': 'ك', 'ی': 'ي'}))
    return re.sub(r'[^ء-ي]', '', s)

# ---- ASR char stream with times
chars, times = [], []
for w in words:
    c = norm(w['w'])
    if not c: continue
    for i, ch in enumerate(c):
        chars.append(ch); times.append(w['s'] + (w['e'] - w['s']) * i / len(c))
asr = ''.join(chars); times = np.array(times)
NT = len(asr) - 2
tri_ids = {}
asr_tri = np.array([tri_ids.setdefault(asr[i:i+3], len(tri_ids)) for i in range(NT)])
print('asr chars', len(asr))

# ---- text lines
lines = []
for p, L in enumerate(ocr):
    for i, l in enumerate(L):
        lines.append({'p': p + 1, 'i': i, 'y': l['yc'], 'txt': norm(l['text'])})
idx = {(l['p'], l['i']): k for k, l in enumerate(lines)}

URDU = re.compile(r'[ےڑپٹںھگ]')
score = np.full((len(lines), NT), -1.0, dtype=np.float32)
for k, l in enumerate(lines):
    t = l['txt']
    if len(t) < 8: continue
    tset = {tri_ids[t[j:j+3]] for j in range(len(t) - 2) if t[j:j+3] in tri_ids}
    ntri = len(t) - 2
    if not tset: continue
    hit = np.isin(asr_tri, list(tset)).astype(np.float32)
    c = np.concatenate([[0], np.cumsum(hit)])
    win = min(ntri, NT)
    s = (c[win:] - c[:-win]) / ntri  # window starting at pos
    score[k, :len(s)] = s

BASE = float(sys.argv[3]) if len(sys.argv) > 3 else 0.22
gain = score - BASE  # weak matches become negative -> DP prefers to skip

# ---- expanded script with repeat blocks
blocks = [((1, 1), (2, 5), 3), ((2, 8), (2, 10), 11), ((3, 1), (3, 8), 11), ((16, 10), (18, 1), 3)]
exp = []  # list of (line index, rep number)
k = 0
while k < len(lines):
    b = next((b for b in blocks if idx[b[0]] == k), None)
    if b:
        a, z = idx[b[0]], idx[b[1]]
        for r in range(b[2]):
            exp += [(j, r) for j in range(a, z + 1)]
        k = z + 1
    else:
        exp.append((k, 0)); k += 1
K = len(exp); print('expanded', K, 'lines', len(lines))

# ---- DP: G[p] = best total of a path whose last matched line started at <= p
NEG = -1e9
G = np.full(NT, 0.0); Gk = np.full(NT, -1, dtype=np.int32); Gp = np.arange(NT, dtype=np.int32)  # origin of G[p]
back = []  # per expanded line: (prevk, prevp) for each p where it was chosen
for e, (li, rep) in enumerate(exp):
    g = gain[li]
    minadv = max(4, len(lines[e and exp[e-1][0]]['txt']) // 2)
    # best predecessor ending at <= p - minadv
    shifted = np.full(NT, 0.0); sk = np.full(NT, -1, dtype=np.int32); sp = np.full(NT, -1, dtype=np.int32)
    shifted[minadv:] = G[:-minadv]; sk[minadv:] = Gk[:-minadv]; sp[minadv:] = Gp[:-minadv]
    cand = np.where(g > 0, g + shifted, NEG)
    back.append((sk.copy(), sp.copy()))
    # prefix max of cand
    best = np.maximum.accumulate(cand)
    arg = np.zeros(NT, dtype=np.int64)
    m = cand == best
    arg = np.where(m, np.arange(NT), 0); arg = np.maximum.accumulate(arg)
    better = best > G
    Gk = np.where(better, e, Gk).astype(np.int32)
    Gp = np.where(better, arg, Gp).astype(np.int32)
    G = np.where(better, best, G)

# backtrack
path = []
e, p = int(Gk[-1]), int(Gp[-1])
while e >= 0:
    path.append((e, p))
    sk, sp = back[e]
    e, p = int(sk[p]), int(sp[p])
path.reverse()
print('matched expanded lines', len(path), 'total', round(float(G[-1]), 2))

# ---- fill unmatched expanded lines by interpolating on text length
import os
# known block spans for this audio (from the earlier, better-OCR alignment): {block start: (from, to)}
KNOWN = {(2, 8): (93.5, 159.4), (3, 1): (159.4, 329.0), (16, 10): (626.8, 713.8)} if os.environ.get('KAMIL_NEW') else {}
INSTR = {(1, 0), (2, 6), (2, 7), (3, 0), (3, 9), (16, 8), (16, 9), (18, 2)}
def weight(li):
    l = lines[li]
    return 0 if (l['p'], l['i']) in INSTR else max(len(l['txt']), 14)
tmatch = {e: float(times[p]) for e, p in path}
if KNOWN:  # pin known block starts/ends as anchors, then drop matches that break time order
    for (b0, b1, N) in blocks:
        if b0 in KNOWN:
            es = [e for e in range(K) if idx[b0] <= exp[e][0] <= idx[b1]]
            nxt = es[-1] + 1
            while nxt < K and weight(exp[nxt][0]) == 0: nxt += 1
            tmatch = {e: v for e, v in tmatch.items() if not (es[0] <= e <= es[-1])}
            tmatch[es[0]] = KNOWN[b0][0]
            if nxt < K: tmatch[nxt] = KNOWN[b0][1]
    keep, last = {}, -1
    for e in sorted(tmatch):
        if tmatch[e] > last: keep[e] = tmatch[e]; last = tmatch[e]
    tmatch = keep
dur = float(times[-1]) + 2
anchors = [(-1, 0.0)] + sorted(tmatch.items()) + [(K, dur)]
etime = {}
for (ea, ta), (eb, tb) in zip(anchors, anchors[1:]):
    if ea >= 0: etime[ea] = ta
    mid = list(range(ea + 1, eb))
    if not mid: continue
    ws = [weight(exp[e][0]) for e in mid]
    tot = sum(ws) + (weight(exp[ea][0]) if ea >= 0 else 0)
    acc = weight(exp[ea][0]) if ea >= 0 else 0
    for e, w in zip(mid, ws):
        etime[e] = ta + (tb - ta) * (acc / tot if tot else 0)
        acc += w

# ---- uniform repeats (tasbih blocks): spread N reps evenly between block start and the next line
for (b0, b1, N) in (blocks[1:] if KNOWN else blocks[1:3]):
    a, z = idx[b0], idx[b1]
    es = [e for e in range(K) if a <= exp[e][0] <= z]
    first, after = es[0], es[-1] + 1
    while after < K and weight(exp[after][0]) == 0: after += 1
    T0, T1 = etime[first], etime[after]
    ov = KNOWN.get(b0)
    if ov: T0, T1 = ov
    per = (T1 - T0) / N
    blk = list(range(a, z + 1)); ws = [weight(li) for li in blk]; tot = sum(ws)
    for e in es:
        li, r = exp[e]
        off = sum(ws[:blk.index(li)]) / tot
        etime[e] = T0 + per * (r + off)
    print(f'block {b0}-{b1}: {N} reps x {per:.2f}s from {T0:.1f} to {T1:.1f}')

marks = []
prev = None
for e in range(K):
    li, rep = exp[e]
    if weight(li) == 0: continue
    l = lines[li]; t = round(etime[e], 2)
    if marks and t <= marks[-1]['t']: t = round(marks[-1]['t'] + 0.05, 2)
    pos = (l['p'] - 1) + l['y']
    if prev and pos < prev[0] - 0.01:  # repetition: hold on the previous line, then jump back
        marks.append({'t': round(t - 0.1, 2), 'p': prev[1]['p'], 'y': round(min(1, prev[1]['y'] + 0.03), 4)})
    marks.append({'t': t, 'p': l['p'], 'y': round(l['y'], 4)})
    prev = (pos, l)
    if e in tmatch: print(f"{t:7.1f}  p{l['p']:>2} l{l['i']:>2} r{rep}  {'MATCH' if e in tmatch else ''}")
json.dump({'note': 'auto-aligned (Whisper + OCR); refine in Sync mode if needed', 'marks': marks}, open(OUT, 'w'), ensure_ascii=False, indent=1)
print('marks', len(marks), 'matched', len(tmatch), 'of', K)
