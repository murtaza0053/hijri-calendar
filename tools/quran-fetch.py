"""Fetch a surah (Indo-Pak text + Uthmani tajweed-tagged text per word (index 3), per-word positions, Alafasy audio URL + word timings) from the Quran.com API
into dua/quran/<n>.json.  Usage: python3 tools/quran-fetch.py 36 18"""
import json, sys, urllib.request
RECITER = 7  # Mishari Rashid al-Afasy
def get(u): return json.load(urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'hijri-calendar-pwa'})))
for n in map(int, sys.argv[1:]):
    ch = get(f'https://api.quran.com/api/v4/chapters/{n}')['chapter']
    verses, page = [], 1
    while page:
        r = get(f'https://api.quran.com/api/v4/verses/by_chapter/{n}?words=true&word_fields=text_indopak,text_uthmani_tajweed&per_page=50&page={page}')
        verses += r['verses']; page = r['pagination']['next_page']
    au = get(f'https://api.qurancdn.com/api/qdc/audio/reciters/{RECITER}/audio_files?chapter={n}&segments=true')['audio_files'][0]
    tim = {v['verse_key']: v for v in au['verse_timings']}
    out = {'n': n, 'name': ch['name_simple'], 'ar': ch['name_arabic'], 'audio': au['audio_url'], 'reciter': 'Mishari Rashid al-Afasy',
           'source': 'Text, audio and timings: Quran.com API (quranicaudio.com)', 'verses': []}
    for v in verses:
        t = tim[v['verse_key']]
        words = [w for w in v['words'] if w['char_type_name'] == 'word']
        seg = {s[0]: (s[1], s[2]) for s in t.get('segments', []) if len(s) >= 3}
        out['verses'].append({'k': v['verse_number'], 'f': t['timestamp_from'], 't': t['timestamp_to'],
                              'w': [[w['text_indopak'], *seg.get(w['position'], (None, None)), w['text_uthmani_tajweed']] for w in words]})
    json.dump(out, open(f'dua/quran/{n}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    print(n, out['name'], len(out['verses']), 'verses', sum(1 for v in out['verses'] for w in v['w'] if w[1] is None), 'words w/o timing')
