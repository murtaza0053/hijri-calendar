# Hijri Calendar (Misri) — PWA

Offline-capable Misri / Fatimi tabular Hijri calendar with miqaats, made to install on iPhone (Safari → Share → Add to Home Screen).

- Month view with Hijri (Arabic numerals) + Gregorian dates, swipe between months
- Miqaats / urus per day, upcoming list, date converter both ways
- Approx. sunrise / zawaal / maghrib / nisful layl for your location

Calendar algorithm and miqaat list based on [mumineencalendar.com](https://www.mumineencalendar.com/) by Murtaza Gulamali.

## Dua (read-along) — `dua/`
Dua e Kamil: audio plays and the PDF scrolls/highlights the current line (merged from the former
`audio-pdf-sync-pwa` project so there is only one app to install). It has its own service worker
(`dua/sw.js`, caches `readalong-*`); the root `sw.js` ignores `dua/` and never deletes those caches.
- `dua/media/config.json` names the audio/PDF/sync files; refine timing in-app with ✎ (Sync mode),
  export `sync.json`, replace `dua/media/sync.json` and push.
- After changing dua app files bump `CACHE` in `dua/sw.js`; after changing audio/PDF bump `MEDIA_CACHE` in `dua/app.js`.

## Quran & Tasbeeh — `dua/quran.html?s=<surah>`, `dua/tasbeeh.html`
- Surah data (Indo-Pak text, word timings, Alafasy audio URL) comes from the Quran.com API via
  `python3 tools/quran-fetch.py 36 18` → `dua/quran/<n>.json`. Audio streams from quranicaudio.com and is
  cached in the browser (`quran-audio-v1`) for offline use. Add a surah: fetch it and add a card in the Dua tab.
- Font: Noto Naskh Arabic (OFL), Arabic subset in `dua/fonts/`.
- Shared theme: `themes.css` + `theme-init.js` (used by every page).
