"""Transcribe in fixed 20 s windows (bounded decode time), 4 workers, no temperature fallback."""
import json, sys, subprocess
import numpy as np
from multiprocessing import Pool

SR = 16000
WIN, PAD = float(sys.argv[3]) if len(sys.argv) > 3 else 20.0, 1.5

def load(path):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768

model = None
def init():
    global model
    from faster_whisper import WhisperModel
    model = WhisperModel('small', device='cpu', compute_type='int8', cpu_threads=2)

def work(args):
    s, audio = args
    a = max(0.0, s - PAD)
    segs, _ = model.transcribe(audio, language='ar', word_timestamps=True, vad_filter=False, beam_size=3,
                               temperature=0.0, condition_on_previous_text=False,
                               compression_ratio_threshold=None, log_prob_threshold=None, no_speech_threshold=None)
    out = []
    for seg in segs:
        for w in seg.words:
            st = a + w.start
            if s <= st < s + WIN:  # keep only words that start in this window's own range
                out.append({'w': w.word.strip(), 's': round(st, 2), 'e': round(a + w.end, 2)})
    print(f'{s:6.0f}s  {len(out):3d} words  ' + ' '.join(x["w"] for x in out)[:70], flush=True)
    return out

if __name__ == '__main__':
    x = load(sys.argv[1]); dur = len(x) / SR
    starts = [float(v) for v in sys.argv[4].split(',')] if len(sys.argv) > 4 else [i * WIN for i in range(int(dur // WIN) + 1)]
    jobs = []
    for s in starts:
        a = max(0.0, s - PAD); b = min(dur, s + WIN + PAD)
        jobs.append((s, x[int(a * SR):int(b * SR)]))
    with Pool(4, initializer=init) as p:
        res = p.map(work, jobs, chunksize=1)
    words = [w for r in res for w in r]
    json.dump(words, open(sys.argv[2], 'w'), ensure_ascii=False)
    print('done', len(words), 'words')
