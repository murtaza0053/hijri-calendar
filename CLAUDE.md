# Mumin — Misri/Dawoodi Bohra Hijri calendar PWA (+ Android wrapper)

Owner writes and expects replies in **Hinglish** (Hindi in Latin letters). Keep replies short and say plainly what was *not* verified.

## What this is
- Plain HTML/JS PWA, **no build step**. Live: https://murtaza0053.github.io/hijri-calendar/ (GitHub Pages, repo `murtaza0053/hijri-calendar`, branch `main`). Push = deploy (1–2 min).
- Main files: `index.html` (all UI + JS), `i18n.js` (en/gu/hi strings), `hijri.js`, `themes.css`, `sw.js` (network-first service worker), `miqaats.json`, `quotes.json` + `quotes/`, `fonts/`, `dua/` (Dua / Quran / books reader, has its own `dua/sw.js`), `push/` (Cloudflare worker), `download.html` (share page → latest APK).
- Android app: separate folder `~/Projects/mumin-android` (WebView wrapper that loads the live site; see its `CLAUDE.md`). Most changes reach the phone through the website alone.
- Languages: English / Gujarati / Hinglish. Default Hinglish. Themes: many colours × auto/light/dark via CSS vars (`--brand`, `--gold`, `--on-brand` …). Prefer `var(--brand)`/`var(--gold)` over hard-coded colours so themes work.

## Deploy checklist (EVERY change that ships)
1. Bump `APP_V` in `index.html` (`const APP_V = N`).
2. Replace the `?v=N` cache-busters in `index.html`, `ziyarat.html`, `qibla.html`; set `CACHE = "hijri-cal-vN"` in `sw.js`. (`sed -i 's/v=OLD/v=NEW/g;s/vOLD/vNEW/g' sw.js ziyarat.html qibla.html` + the same for index.html.)
3. Prepend a `version.json` history entry `{v, date, en[], gu[], hi[]}` and set the top-level `"v"`. Notes are short and for non-technical users. The app shows an update bar when server v > `APP_V`.
4. If you touched `dua/` files, bump the cache name in `dua/sw.js` (`readalong-shell-vN`).
5. Syntax-check the inline JS before pushing (needs Node ≥ 12 with `?.`; use `source ~/.nvm/nvm.sh; nvm use 22`).
6. Run `python3 tools/make-changelog.py` (rebuilds `CHANGELOG.md` from `version.json` + GitHub APK releases; needs `gh` logged in).
7. `git add -A && git commit && git push`.
   - Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (per current harness setting).
   - Do **not** chain `pkill` into the same command as `git commit` (it killed the whole chain twice → nothing was committed). Run it separately.

## Testing UI
- Headless Chrome: `google-chrome --headless=new --no-sandbox --window-size=390,800 --virtual-time-budget=9000 --screenshot=out.png URL`. Skip popups first by setting localStorage `tourSeen`, `seenVer`, `pushPromptSeen` (a tiny redirect page that sets them then `location.replace('/index.html')`).
- For anything needing clicks/network/timers use Playwright (`pip install playwright` in a venv; launch with `executable_path=/usr/bin/google-chrome`). `python -m http.server` has no Range support — for PDF tests use a small Range-aware server.
- A stale `http.server` from an earlier session can occupy a port and serve an old copy — check `ss -ltnp` / use a fresh port.

## Quote of the day (Raudat Hidayaat Part 1)
- `quotes.json` = `{start:"2026-11-24", q:[English], r:[[aw,ah,uw,uh],…], a:[Arabic], u:[Lisan ud-Dawat (Gujarati in Urdu script)]}`, N = 173. Index 0 = book PDF page 29.
- **Same day→index rule everywhere** (card, push worker, Android alarms): `idx = ((floor((UTC(y,m,d) − UTC(start)) / 864e5) % N) + N) % N`.
- Landing card shows English only (font: Playball, theme-coloured corner art `quotes/corner.webp` via CSS mask); tapping opens a sheet with Arabic + Lisan + English + source. A few items still fall back to scan masks `quotes/NNN{a,u}.webp`.
- Arabic harakat and Lisan spellings were typed by the model → owner should proofread against the book.

## Push notifications (web) — `push/`
- Cloudflare Worker `mumin-push` (D1 `mumin-push`, cron every minute). URL used by the app: `https://mumin-push.masspeshi.workers.dev`.
- Deploy: `source ~/.nvm/nvm.sh; nvm use 22; cd push; npx wrangler@4 deploy` (wrangler 3 fails on the JSON import; wrangler 4 needs Node 22). Needs `wrangler login` already done on the machine; VAPID keys / secrets live in Cloudflare, **never write them in files**.
- Prefs per subscriber include `quote` (default on, 10:00). `/test` sends today's quote.
- Auto mode may block worker deploys until the owner explicitly says "worker deploy karo".

## Android app notes (see also ~/Projects/mumin-android)
- iOS/Safari and plain browsers use web push; the Android WebView has no Push API, so the JS bridge `MuminNative` schedules **native alarms** (`nativeSync()` in `index.html`, 14 days ahead; salaat, azaan, daily quote).
- Update checks: version.json polled on focus/pageshow/online/45 s + a `mumin-resume` event sent by the native app on resume (APK ≥ 1.5).
- `download.html` links `releases/latest/download/mumin.apk` → always the newest GitHub release.

## Book reader (`dua/book.html`)
- Zikre Husain (5350 pages, 38 MB PDF) and Quran Khazain use pdf.js with range requests. `books/*-meta.json` (page count, ratio, contents) lets the page frames and contents appear before the PDF opens. Features: night mode, bookmarks, "Save for offline" (Cache Storage `books-offline-v1`). Hafti uses pre-rendered WebP pages.

## Don't
- Don't put secrets (tokens, VAPID private key, keystore passwords) in any file or commit.
- Don't scrape/copy copyrighted audio into the public app; owner chose YouTube embeds for recitations.

## Android update pop-up
When a new APK is released (`~/Projects/mumin-android`), also set `"android":{"code":<versionCode>,"name":"<versionName>"}` at the top level of `version.json` and deploy. `apkCheck()` in index.html shows the Download pop-up when the installed versionCode (from `MuminNative.info().code`) is lower. Current: code 13 = 2.2.
