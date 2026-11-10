import json,re,difflib,sys
R='/home/ulap236/Projects/hijri-calendar-pwa/dua/media/'
S=json.load(open(R+'sync.json')); T=json.load(open(R+'kamil-text.json'))
W=json.load(open('asr/words_merged.json'))
DI=re.compile(r'[ً-ٰٟۖ-ۭـ‏‎]')
def norm(w):
    w=DI.sub('',w); w=re.sub('[إأآٱ]','ا',w); w=w.replace('ى','ي').replace('ة','ه').replace('ؤ','و').replace('ئ','ي'); return w
marks=sorted(S['marks'],key=lambda m:m['t'])
def line_of(m):
    pg=T['pages'][m['p']-1]; best=None;bd=9
    for k,y in enumerate(pg['ys']):
        if pg['lines'][k].get('h'): continue
        d=abs(y-m['y'])
        if d<bd: bd=d;best=k
    return pg['lines'][best],best
wn=[(norm(x['w']),x['s'],x['e']) for x in W]
out=[];stat=[0,0]
for i,m in enumerate(marks):
    ln,k=line_of(m)
    n=marks[i+1]['t'] if i+1<len(marks) else m['t']+4
    if ln.get('n'): out.append(None); continue
    words=[w for w in ln['t'].split() if w!='*']
    nw=[norm(w) for w in words]
    win=[x for x in wn if x[1]>=m['t']-0.4 and x[1]<n+0.2]
    # DP alignment (monotone), score = similarity
    A=len(nw);B=len(win)
    import math
    sim=lambda a,b: difflib.SequenceMatcher(None,a,b).ratio()
    NEG=-1e9; dp=[[0]*(B+1) for _ in range(A+1)]; bt=[[None]*(B+1) for _ in range(A+1)]
    for a in range(A+1):
        for b in range(B+1):
            if a==0 and b==0: continue
            c=[]
            if a>0: c.append((dp[a-1][b]-0.15,'a'))
            if b>0: c.append((dp[a][b-1]-0.15,'b'))
            if a>0 and b>0:
                s=sim(nw[a-1],win[b-1][0]); c.append((dp[a-1][b-1]+(s-0.5)*2,'d'))
            dp[a][b],bt[a][b]=max(c)
    a,b=A,B; match={}
    while a>0 or b>0:
        mv=bt[a][b]
        if mv=='d':
            s=sim(nw[a-1],win[b-1][0])
            if s>=0.6: match[a-1]=win[b-1][1]
            a-=1;b-=1
        elif mv=='a': a-=1
        else: b-=1
    stat[0]+=len(match);stat[1]+=A
    # fill gaps by letter weights between matched anchors (line start m.t .. line end n*0.94)
    wt=[max(1,len(x)) for x in nw]; tot=sum(wt)
    t0=m['t']; t1=m['t']+(n-m['t'])*0.94
    starts=[None]*A
    for j,v in match.items(): starts[j]=v
    # anchors: add virtual start/end
    idx=[j for j in range(A) if starts[j] is not None]
    cum=[0]
    for x in wt: cum.append(cum[-1]+x)
    for j in range(A):
        if starts[j] is not None: continue
        prev=max([q for q in idx if q<j],default=None); nxt=min([q for q in idx if q>j],default=None)
        ta,ca=(starts[prev],cum[prev]) if prev is not None else (t0,0)
        tb,cb=(starts[nxt],cum[nxt]) if nxt is not None else (t1,cum[-1])
        starts[j]=ta+(tb-ta)*((cum[j]-ca)/max(1,(cb-ca)))
    # enforce monotone and within [t0-0.2, ...]
    for j in range(1,A): starts[j]=max(starts[j],starts[j-1]+0.05)
    out.append([round(x,2) for x in starts])
print('matched words',stat, round(stat[0]/stat[1],2))
json.dump(out,open('kamil-words.json','w'),separators=(',',':'))
print(len(out))
