# HANDOFF — where things stand (written 2026-11-25, app v199 / Android 1.5)

Read `CLAUDE.md` first (conventions + deploy checklist). This file is the history and the open items.

## What was done in the latest long session (v163 → v199)
- **Daily Quote feature** (book "RS Raudat Hidayaat Part 1", PDF in personal Drive `Claude Workspace/Dawoodi Bohra App/`): 173 quotes, English + hand-typed Arabic + Lisan ud-Dawat. Starts 24 Nov 2026 with PDF page 29 and goes in book order, one per day.
  - Landing card: English only, Courgette font, theme-coloured corner art; tap → detail sheet (all three texts + source).
  - 10:00 notification: web push via the `mumin-push` worker; Android via native alarms.
  - Settings: "Daily quote alert" (Android row) + push toggle.
- **Header cleanup**: Salaat card and separate Ashara card removed. Ashara countdown now sits in the city line (tap → that date in the calendar). Prayer-times strip is tappable → Salaat page. Notification banner is a compact single line (tap → date sheet / dua screen). Header date tap → scrolls to calendar. Next-miqaat line in the header was added then removed again at the owner's request.
- **Theme colours**: Rozi-amal day borders and the audio word/line highlights (dua + quran pages) follow the theme.
- **Android app (`~/Projects/mumin-android`)**: native alarms for salaat/azaan/quote; azaan can be stopped (tap notification, Stop button, swipe, in-app Stop bar); APK 1.5 sends `mumin-resume` on resume for instant update checks. Versions 1.0–1.3 all had versionCode 1 by mistake (hard-coded in the manifest) — fixed from 1.4 (code 5), 1.5 = code 6.
- **Book reader**: lazy frames/contents, night mode, bookmarks, offline save, once-per-book opening tip. Update checks no longer need an app kill (poll + focus events).
- **Releases**: GitHub releases `android-v1.3 … v1.5`; `download.html` always serves the latest.

## Not verified / known gaps
- Nothing was tested on a real phone: APK 1.4/1.5 install-over-old, native azaan stop, alarm timing under battery saver, instant update-on-resume.
- Light theme and desktop width were not checked for most of the recent UI changes (header Ashara line, banner, quote corners, book night mode).
- Quote content: Arabic harakat + Lisan spellings are model-typed (proofread against the book). 5 quotes still show Lisan as scan images; 1 has no typed Arabic; 3 quotes lack Lisan; 3 quotes are missing from the book sequence. Push/native notification shows English only.
- Native alarms cover 14 days from the last app open.
- Courgette (owner picked it; before: Courgette); swap = change the `.qcard .qt` font rule + `@font-face` + font file.
- Book reader: first page of the 38 MB Zikre PDF still needs ~3.3 MB from the network the first time (about 25 s on a slow 4G test); "Save for offline" fixes it. No full-text search across the 5350 pages.
- Night mode inverts colours, so red/green text looks different.

## Ideas offered but not done
- Ashara: progress bar, per-day names, reminder notifications (30/7/1 day before, daily during Ashara), calendar highlight of the 10 days, share card, a home-screen widget.
- Azaan: "always silent" option, "play first N seconds only" (needs native change).
- Quote: proofreading pass, typing the remaining Lisan/Arabic, Part 2 quotes, Lisan in notifications.
- Corner art on other cards; showing quote corners in other themes was only checked in gold/navy/green/maroon.

## Where things live
- Repo `~/Projects/hijri-calendar-pwa` (GitHub `murtaza0053/hijri-calendar`); Android `~/Projects/mumin-android` (not a git repo; APKs are published as GitHub releases of the web repo).
- Scratch work from the quote extraction (PDF → text) was in a session scratchpad and is not preserved; `quotes.json` is the source of truth now.
- Owner's memory notes for Claude Code live in `~/.claude/projects/-home-ulap236/memory/` (only visible to that machine/account).
