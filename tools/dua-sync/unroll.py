"""Dua e Kamil text: write the repeated parts out in full (3x intro, 11x tahlil, 11x tasbih, 3x faraj) with an
Arabic-Indic number before each round, so the read-along just flows downward. Input: kamil-text-src.json (one
text page per printed page) + sync.json (marks, unchanged order/count so kamil-words.json stays valid).
Output: dua/media/kamil-text.json (new pages) + dua/media/sync-text.json (marks re-pointed)."""
import json
R='/home/ulap236/Projects/hijri-calendar-pwa/'
src=json.load(open(R+'tools/dua-sync/kamil-text-src.json')); S=json.load(open(R+'dua/media/sync.json'))
G=[(p,k) for p,pg in enumerate(src['pages']) for k in range(len(pg['lines']))]
gi={pk:i for i,pk in enumerate(G)}
line=lambda g: src['pages'][G[g][0]]['lines'][G[g][1]]
AR='٠١٢٣٤٥٦٧٨٩'; ar=lambda n:''.join(AR[int(c)] for c in str(n))
# blocks: first line, last line (printed page, line), repeats, mark -> round
def passA(i): return 0 if i<=16 else 1 if i<=32 else 2
def passB(i): return (i-48)//4
def passC(i): return min((i-91)//9,10)
def passD(i): return 0 if i<=345 else 1 if i<=360 else 2
BLOCKS=[dict(a=(0,2),b=(1,5),n=3,m=range(1,48),f=passA),
        dict(a=(1,8),b=(1,10),n=11,m=range(48,91),f=passB),
        dict(a=(2,1),b=(2,8),n=11,m=range(91,189),f=passC),
        dict(a=(15,10),b=(17,1),n=3,m=range(331,375),f=passD)]
DROP={(1,6),(1,7),(2,0),(15,9)}          # the printed "read 3 / 11 times" notes: replaced by the numbers
starts={gi[b['a']]:b for b in BLOCKS}
seq=[]; pos={}                           # seq: lines; pos[(g,round)] -> index in seq
g=0
while g<len(G):
    if G[g] in DROP: g+=1; continue
    b=starts.get(g)
    if b:
        e=gi[b['b']]
        for r in range(b['n']):
            seq.append({'t':ar(r+1),'r':1})
            for x in range(g,e+1): pos[(x,r)]=len(seq); seq.append(dict(line(x)))
        g=e+1; continue
    pos[(g,0)]=len(seq); seq.append(dict(line(g))); g+=1
# pages: first one keeps its printed line positions, the rest use a standard 11-line grid
ys0=src['pages'][0]['ys']; ysN=src['pages'][1]['ys']
pages=[]; cur={'ys':[],'lines':[]}; lim=len(ys0)
loc={}
for i,l in enumerate(seq):
    if len(cur['lines'])==lim-1 and l.get('r'):     # never leave a number alone at the page bottom
        pages.append(cur); cur={'ys':[],'lines':[]}; lim=len(ysN)
    if len(cur['lines'])==lim: pages.append(cur); cur={'ys':[],'lines':[]}; lim=len(ysN)
    grid=ys0 if not pages else ysN
    cur['ys'].append(grid[len(cur['lines'])]); cur['lines'].append(l); loc[i]=(len(pages)+1,grid[len(cur['lines'])-1])
pages.append(cur)
def old_line(m):
    pg=src['pages'][m['p']-1]; best=None;bd=9
    for k,y in enumerate(pg['ys']):
        if pg['lines'][k].get('h')==2: continue
        d=abs(y-m['y'])
        if d<bd: bd=d;best=k
    return gi[(m['p']-1,best)]
marks=[]
for i,m in enumerate(S['marks']):
    g=old_line(m); r=0
    for b in BLOCKS:
        if i in b['m']: r=b['f'](i); assert b['n']>r
    k=(g,r)
    if k not in pos:   # the mark sits on a dropped note: use the next kept line
        h=g
        while (h,r) not in pos: h+=1
        k=(h,r)
    p,y=loc[pos[k]]; marks.append({'t':m['t'],'p':p,'y':y})
note=src['note']+' Repeated parts (3x, 11x, 11x, 3x) written out in full with a number before each round; built by tools/dua-sync/unroll.py.'
json.dump({'note':note,'pages':pages},open(R+'dua/media/kamil-text.json','w'),ensure_ascii=False,separators=(',',':'))
S2=dict(S); S2['marks']=marks; S2.pop('frames',None); S2['note']='text-version marks: same times as sync.json, re-pointed at the unrolled text pages (unroll.py)'
json.dump(S2,open(R+'dua/media/sync-text.json','w'),ensure_ascii=False,separators=(',',':'))
print(len(pages),'pages',len(seq),'lines',len(marks),'marks')
