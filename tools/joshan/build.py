"""Dua Jaushan Kabeer -> dua/joshan.json (100 fasl, 10 names each). Source: Wikishia 'نص:دعاء الجوشن الكبير'
(from al-Kaf'ami, al-Balad al-Amin). The raw text has broken stacked harakat; they are tidied here."""
import re,json
R='/home/ulap236/Projects/hijri-calendar-pwa/'
seg=open(R+'tools/joshan/wikishia-raw.txt').read()
parts=re.split(r'\(\s*(\d{1,3})\)',seg)
d={int(parts[i]):re.sub(r'\s+',' ',parts[i+1]).strip() for i in range(1,len(parts),2)}
assert sorted(d)==list(range(1,101)),[n for n in range(1,101) if n not in d]
REF='سُبْحانَكَ يا لا اِلـهَ إلاّ اَنْتَ الْغَوْثَ الْغَوْثَ خَلِّصْنا مِنَ النّارِ يا رَبِّ'
def fix(s):
    s=re.split(r'[\[<]',s.replace(REF,''))[0].strip(' .')
    s=s.replace('ـ','' ) if False else s
    s=re.sub(r'([َُِ])[َُِ]*ْ',r'\1',s)      # vowel + stacked marks + sukun -> vowel
    s=re.sub(r'([َُِ])\1+',r'\1',s)
    s=s.replace('اِلـهَ','إِلٰهَ').replace('اللّـه','اللّٰه').replace('اَللّـه','اَللّٰه').replace('لّـه','لّٰه')
    s=s.replace('ـ','')
    s=re.sub(r'(^| |ال)ا([َُ])(?!ل)',lambda m:m.group(1)+'أ'+m.group(2),s)    # hamza on alif + fatha/damma (not 'al-')
    s=re.sub(r'(^| |ال)ا(ِ)',lambda m:m.group(1)+'إ'+m.group(2),s)
    s=s.replace(' اخِرُ',' آخِرُ').replace('اْلبَ','الْبَ').replace('الَْم','الْمَ')
    return s
out=[{'n':n,'t':fix(d[n])} for n in range(1,101)]
json.dump({'note':'Dua Jaushan Kabeer: 100 fasl; after every fasl say the refrain. Text from Wikishia (al-Kaf\'ami, al-Balad al-Amin) - DRAFT, to be checked against the Dawoodi Bohra printed book.','refrain':fix(REF+'x')[:-1] if False else REF.replace('اِلـهَ','إِلٰهَ').replace('اَنْتَ','أَنْتَ').replace('اَ','أَ') ,'fasl':out},open(R+'dua/joshan.json','w'),ensure_ascii=False,separators=(',',':'))
print(out[0]['t']);print(out[16]['t'][:120]);print(out[99]['t'][-120:])
