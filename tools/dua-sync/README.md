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

For Dua e Kamil (2026-11-07) 213 of 468 script lines matched directly; spot checks were on the right line.
