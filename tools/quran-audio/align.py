import json, re, difflib, sys
R = '/home/ulap236/Projects/hijri-calendar-pwa/dua/quran/'
D = json.load(open('/home/ulap236/Projects/hijri-calendar-pwa/tools/quran-audio/18-mishary-orig.json'))
A = json.load(open(sys.argv[1]))
DI = re.compile(r'[ً-ٰٟۖ-ۭـ۟-ۨٓ-ٕ]')
def norm(s):
    s = re.sub(r'<[^>]+>', '', s); s = DI.sub('', s)
    s = re.sub('[إأآٱ]', 'ا', s).replace('ى', 'ي').replace('ة', 'ه').replace('ؤ', 'و').replace('ئ', 'ي').replace('ٰ', '')
    return re.sub(r'[^ء-ي]', '', s)
Q = []   # (verse index, word index, norm)
for vi, v in enumerate(D['verses']):
    for wi, w in enumerate(v['w']): Q.append((vi, wi, norm(w[3] or w[0])))
An = [(norm(x['w']), x['s'], x['e']) for x in A]
n, m = len(Q), len(An)
band = 140
sim_cache = {}
def sim(a, b):
    k = (a, b)
    if k not in sim_cache: sim_cache[k] = difflib.SequenceMatcher(None, a, b).ratio() if a and b else 0
    return sim_cache[k]
NEG = -1e9
dp = [dict() for _ in range(n + 1)]; bt = [dict() for _ in range(n + 1)]
def rng(i): c = int(i * m / n); return max(0, c - band), min(m, c + band)
dp[0][0] = 0
for i in range(0, n + 1):
    lo, hi = rng(i)
    for j in range(lo, hi + 1):
        if i == 0 and j == 0: continue
        best = (NEG, None)
        if i > 0 and (j in dp[i-1]): best = max(best, (dp[i-1][j] - 0.3, 'a'))
        if j > 0 and (j-1) in dp[i]: best = max(best, (dp[i][j-1] - 0.25, 'b'))
        if i > 0 and j > 0 and (j-1) in dp[i-1]:
            s = sim(Q[i-1][2], An[j-1][0]); best = max(best, (dp[i-1][j-1] + (s - 0.5) * 2, 'd'))
        if best[1]: dp[i][j] = best[0]; bt[i][j] = best[1]
i, j = n, m
if j not in dp[n]: j = max(dp[n], key=lambda k: dp[n][k])
match = {}
while i > 0 or j > 0:
    mv = bt[i].get(j)
    if mv == 'd':
        if sim(Q[i-1][2], An[j-1][0]) >= 0.6: match[i-1] = An[j-1][1]
        i -= 1; j -= 1
    elif mv == 'a': i -= 1
    elif mv == 'b': j -= 1
    else: break
print('matched', len(match), 'of', n, round(len(match) / n * 100), '%', 'asr words', m)
# fill unmatched words: linear interpolation between neighbouring matched words (by letter weight)
times = [match.get(k) for k in range(n)]
dur = A[-1]['e']
idx = [k for k in range(n) if times[k] is not None]
if not idx: raise SystemExit('no matches')
for k in range(n):
    if times[k] is not None: continue
    p = max([q for q in idx if q < k], default=None); nx = min([q for q in idx if q > k], default=None)
    if p is None: times[k] = max(0, times[nx] - (nx - k) * 0.5)
    elif nx is None: times[k] = times[p] + (k - p) * 0.5
    else:
        w = [max(1, len(Q[x][2])) for x in range(p, nx)]; tot = sum(w); cum = sum(w[:k - p])
        times[k] = times[p] + (times[nx] - times[p]) * cum / tot
# enforce monotone
for k in range(1, n): times[k] = max(times[k], times[k-1] + 0.02)
ms = [int(t * 1000) for t in times]
out = json.loads(json.dumps(D))
pos = 0
for vi, v in enumerate(out['verses']):
    ws = v['w']
    for wi in range(len(ws)):
        s = ms[pos]; e = ms[pos + 1] if pos + 1 < n else int(dur * 1000)
        ws[wi][1] = s; ws[wi][2] = e; pos += 1
    v['f'] = ws[0][1]; v['t'] = ws[-1][2]
out['audio'] = 'media/kahf-husain.mp3'
out['reciter'] = 'Shehzada Husain Bhai Saheb'
out['source'] = 'Text: Quran.com API. Audio: Shehzada Husain Bhai Saheb (Sura Al Kahf). Word timings: auto-aligned with speech recognition (approximate).'
json.dump(out, open(sys.argv[2], 'w'), ensure_ascii=False, separators=(',', ':'))
print('verses', len(out['verses']), 'first f/t', out['verses'][0]['f'], out['verses'][0]['t'], 'last', out['verses'][-1]['f'], out['verses'][-1]['t'])
