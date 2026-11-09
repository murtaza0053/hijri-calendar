"""Madani-mushaf layout for a surah: per-word glyph codes (Quran.com QCF page fonts), page + line numbers.
Writes dua/quran/madani-<n>.json. The page fonts (KFGQPC / Quran.com, not redistributable) are loaded by the app from
Quran.com's CDN at run time (https://verses.quran.com/fonts/quran/hafs/v4/colrv1/woff2/p<page>.woff2) - do NOT commit them.
Usage: python3 tools/quran-madani.py 36"""
import json, sys, os, urllib.request
def get(u): return json.load(urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'hijri-calendar-pwa'})))
for n in map(int, sys.argv[1:]):
    verses, page = [], 1
    while page:
        r = get(f'https://api.quran.com/api/v4/verses/by_chapter/{n}?words=true&word_fields=code_v2,line_number,page_number&per_page=50&page={page}')
        verses += r['verses']; page = r['pagination']['next_page']
    pages = {}
    for vi, v in enumerate(verses):
        j = 0
        for w in v['words']:
            p, l = w['page_number'], w['line_number']
            if w['char_type_name'] == 'word': idx = j; j += 1
            else: idx = -1                      # ayat-end marker
            pages.setdefault(p, {}).setdefault(l, []).append([vi, idx, w['code_v2']])
    out = {'n': n, 'pages': [{'p': p, 'lines': [{'l': l, 'w': pages[p][l]} for l in sorted(pages[p])]} for p in sorted(pages)]}
    json.dump(out, open(f'dua/quran/madani-{n}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    print(n, 'pages', sorted(pages), 'lines', {p: sorted(pages[p]) for p in pages})
