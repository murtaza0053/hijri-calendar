# Auto-sync a dua audio to its PDF

Produces `dua/media/sync.json` (marks: time → page/line) without tapping through the audio by hand.
Run from a scratch dir (needs `pip install faster-whisper numpy pillow`, `tesseract` + `ara.traineddata`
from tessdata_best in `./tessdata`, `ffmpeg`, `pdftoppm`):

1. `pdftoppm -r 150 -gray -png <pdf> pg`, then `python lines.py` — finds the frame and text lines per page → `lines.json`
2. `python ocr.py` — OCRs each line (Arabic) → `ocr.json`
3. `python tx_windows.py <audio> words.json` — Whisper `small`, 20 s windows, 4 workers → word timestamps.
   Re-run weak ranges with smaller windows: `python tx_windows.py <audio> fix.json 5 0,5,10,15` and merge.
4. `python align.py words.json sync.json` — trigram matching + DP over the script with repeat blocks
   (`blocks` in align.py: 3x opening, 11x tasbih ×2, optional 3x dua on p19–20), interpolates unmatched lines.

5. `python frames.py sync.json` — adds each page's printed-border x-range so the highlight stays inside it.

For Dua e Kamil (2026-11-07) 213 of 468 script lines matched directly; spot checks were on the right line.

## Text version of Dua e Kamil (2026-11-10)
`dua/media/kamil-text.json` = the new PDF retyped (Google Drive OCR of each page, proofread line by line against the page
images; draft until a reader confirms it — see `kamil-text-review.txt` for the uncertain words). `ys` are the line
centres of each printed page, so the existing `sync.json` marks (page, y) work unchanged. The reader's "New — Indo-Pak text"
version lays the lines at those positions in the Quran.com/QUL "Indopak Nastaleeq" font (loaded from their CDN, cached).

## Enhanced audio (2026-11-10)
`dua-e-kamil-enhanced.m4a` = original run through ffmpeg:
`highpass=f=90, afftdn=nr=14:nf=-45:tn=1:tr=1, dynaudnorm=f=400:g=25:p=0.9:m=6:s=6, volume=-3.7dB, alimiter=limit=0.89`, AAC 128k stereo.
LRA 11.0 → 4.8 LU, 5 s loudness std 3.84 → 1.63 dB, clipped samples 699 → 0, integrated −14 LUFS; duration/timing identical
(envelope cross-correlation lag 0), so sync.json is unchanged. No pitch correction (that would alter the recitation).
`audioKey` in config.json keeps saved positions/hand-made sync marks valid across both audio files.
