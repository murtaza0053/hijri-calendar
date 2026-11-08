/* Read Along — audio + PDF sync PWA. No build step. */
pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';

const $ = (id) => document.getElementById(id);
const audio = $('audio'), viewer = $('viewer'), pagesEl = $('pages'), cursorEl = $('cursor');
const MEDIA_CACHE = 'readalong-media-v1';

const state = {
  pdf: null, pageEls: [], marks: [], history: [], key: '', editing: false,
  followPausedUntil: 0, lastTap: null, source: 'bundled', config: {},
};

/* ---------- helpers ---------- */
const fmt = (s) => {
  if (!isFinite(s)) return '0:00';
  s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`;
};
let toastTimer;
function toast(msg, ms = 2200) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
function status(msg) { const s = $('status'); s.textContent = msg || ''; s.classList.toggle('hidden', !msg); }
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

/* ---------- IndexedDB for files picked from the phone ---------- */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('readalong', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function idbGet(k) {
  const db = await idb();
  return new Promise((res, rej) => { const q = db.transaction('files').objectStore('files').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
}
async function idbPut(k, v) {
  const db = await idb();
  return new Promise((res, rej) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
}

/* ---------- fetching bundled media (cached for offline) ---------- */
async function fetchCached(url, onProgress) {
  let cache = null;
  try { cache = await caches.open(MEDIA_CACHE); } catch {}
  let resp = cache && await cache.match(url);
  if (!resp) {
    const net = await fetch(url);
    if (!net.ok) throw new Error(`${url} not found (${net.status})`);
    const total = +net.headers.get('content-length') || 0;
    const reader = net.body.getReader(); const chunks = []; let got = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      chunks.push(value); got += value.length; if (onProgress) onProgress(got, total);
    }
    const blob = new Blob(chunks, { type: net.headers.get('content-type') || '' });
    if (cache) try { await cache.put(url, new Response(blob, { headers: { 'content-type': blob.type } })); } catch {}
    return blob;
  }
  return resp.blob();
}

/* ---------- loading ---------- */
// ?d=<id> opens media/<id>/ (another dua); no param = the default Dua e Kamil in media/
const DUA_ID = (new URLSearchParams(location.search).get('d') || '').replace(/[^a-z0-9_-]/gi, '');
const BASE = DUA_ID ? `media/${DUA_ID}/` : 'media/';
async function loadBundled() {
  status('Loading…');
  let cfg = await fetch(BASE + 'config.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => ({}));
  state.config = cfg = Object.assign({ title: 'Read Along', pdf: 'book.pdf' }, cfg);
  if (cfg.versions && cfg.versions.length) {  // several PDF editions of the same dua, each with its own sync
    const want = ls.get('ver:' + BASE, cfg.versions[0].id);
    const v = cfg.versions.find(x => x.id === want) || cfg.versions[0];
    cfg.pdf = v.pdf; cfg.sync = v.sync; state.version = v.id; renderVersions(cfg.versions);
  }
  const mb = (n) => (n / 1048576).toFixed(1);
  const pdfBlob = await fetchCached(BASE + cfg.pdf);
  const audioBlob = !cfg.audio ? null : await fetchCached(BASE + cfg.audio, (g, t) =>
    status(t ? `Audio download: ${Math.round(g / t * 100)}% (${mb(g)} / ${mb(t)} MB)` : `Audio download: ${mb(g)} MB`));
  let fileMarks = null, frames = null;
  let step = false;
  if (cfg.sync) try { const r = await fetch(BASE + cfg.sync, { cache: 'no-cache' }); if (r.ok) { const j = await r.json(); fileMarks = j.marks; frames = j.frames || null; step = !!j.step; } } catch {}
  await openMedia({ title: cfg.title, pdfBlob, audioBlob, key: `bundled:${cfg.pdf}|${cfg.audio}`, fileMarks, frames, step });
}

async function loadPicked() {
  const rec = await idbGet('current');
  if (!rec) return false;
  await openMedia({ title: rec.title, pdfBlob: rec.pdf, audioBlob: rec.audio, key: rec.key, fileMarks: null });
  return true;
}

async function openMedia({ title, pdfBlob, audioBlob, key, fileMarks, frames, step }) {
  status('Opening PDF…');
  state.key = key;
  state.frames = frames || null; // per page [left, right] of the printed border, as fractions of page width
  $('title').textContent = title; document.title = title;
  if (audio.src) URL.revokeObjectURL(audio.src);
  document.body.classList.toggle('noaudio', !audioBlob);  // read-only PDF (no recitation available)
  if (audioBlob) audio.src = URL.createObjectURL(audioBlob); else audio.removeAttribute('src');

  const saved = ls.get('sync:' + key, null);
  const useSaved = !!(saved && saved.length);
  state.marks = normalize(useSaved ? saved : (fileMarks || []));
  // dense per-line auto sync: jump line to line (never slide through page gaps); hand-made sparse marks: interpolate
  state.step = !!step && !useSaved;
  state.history = [];

  state.pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await pdfBlob.arrayBuffer()) }).promise;
  await buildPages();
  status('');

  const last = ls.get('pos:' + key, 0);
  audio.addEventListener('loadedmetadata', () => { if (last && last < audio.duration - 2) audio.currentTime = last; tick(true); }, { once: true });
  if (!audioBlob) return;
  setupMediaSession(title);
  if (!state.marks.length) toast('Sync abhi nahi hua — ✎ dabao aur sync karo', 4000);
}

/* ---------- PDF rendering (lazy) ---------- */
let observer;
async function buildPages() {
  pagesEl.querySelectorAll('.page').forEach(e => e.remove());
  state.pageEls = [];
  if (observer) observer.disconnect();
  observer = new IntersectionObserver(onIntersect, { root: viewer, rootMargin: '150% 0px' });
  for (let i = 1; i <= state.pdf.numPages; i++) {
    const page = await state.pdf.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const el = document.createElement('div');
    el.className = 'page'; el.dataset.n = i;
    el.style.aspectRatio = `${vp.width} / ${vp.height}`;
    el.innerHTML = `<canvas></canvas><span class="num">${i}</span>`;
    pagesEl.appendChild(el); state.pageEls.push(el); observer.observe(el);
  }
  drawTicks();
}

const rendering = new Map();
function onIntersect(entries) {
  for (const e of entries) {
    const el = e.target, c = el.querySelector('canvas');
    if (e.isIntersecting) renderPage(el);
    else if (c.width) { c.width = 0; c.height = 0; el.dataset.rw = ''; } // free memory (iOS limit)
  }
}
async function renderPage(el) {
  const n = +el.dataset.n, w = el.clientWidth;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const want = Math.round(w * dpr);
  if (!w || +el.dataset.rw === want || rendering.has(el)) return;
  const page = await state.pdf.getPage(n);
  const vp = page.getViewport({ scale: want / page.getViewport({ scale: 1 }).width });
  const off = document.createElement('canvas'); off.width = vp.width; off.height = vp.height;
  const task = page.render({ canvasContext: off.getContext('2d'), viewport: vp });
  rendering.set(el, task);
  try { await task.promise; } catch { rendering.delete(el); return; }
  rendering.delete(el);
  const c = el.querySelector('canvas'); c.width = off.width; c.height = off.height;
  c.getContext('2d').drawImage(off, 0, 0);
  el.dataset.rw = want;
}
let resizeT;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    const vr = viewer.getBoundingClientRect();
    state.pageEls.forEach(el => { const r = el.getBoundingClientRect(); if (r.bottom > vr.top - vr.height && r.top < vr.bottom + vr.height) renderPage(el); });
    tick(true);
  }, 200);
});

/* ---------- sync model ----------
   A mark = { t: seconds, p: page (1-based), y: 0..1 within page }.
   pos = (p-1) + y is a continuous "reading position" through the document. */
const posOf = (m) => (m.p - 1) + m.y;
function normalize(arr) {
  return (arr || []).filter(m => isFinite(m.t) && m.p >= 1).map(m => ({ t: +m.t, p: +m.p, y: Math.min(1, Math.max(0, +m.y || 0)) }))
    .sort((a, b) => a.t - b.t);
}
function anchors() {
  const a = state.marks.map(m => ({ t: m.t, pos: posOf(m) }));
  if (!a.length || a[0].t > 0) a.unshift({ t: 0, pos: 0 });
  return a;
}
function posAt(t) {
  if (!state.marks.length) return null;
  const a = anchors();
  for (let i = a.length - 1; i >= 0; i--) {
    if (t >= a[i].t) {
      const n = a[i + 1];
      if (!n || state.step) return a[i].pos;
      return a[i].pos + (n.pos - a[i].pos) * ((t - a[i].t) / (n.t - a[i].t));
    }
  }
  return 0;
}
function timeAt(pos) {
  const a = anchors();
  if (a.length < 2) return null;
  for (let i = a.length - 1; i >= 0; i--) {
    if (pos >= a[i].pos) {
      const n = a[i + 1];
      if (!n) return a[i].t;
      return a[i].t + (n.t - a[i].t) * ((pos - a[i].pos) / (n.pos - a[i].pos || 1));
    }
  }
  return 0;
}
function pxOf(pos) {
  const i = Math.min(state.pageEls.length - 1, Math.max(0, Math.floor(pos)));
  const el = state.pageEls[i]; if (!el) return 0;
  return el.offsetTop + (pos - i) * el.offsetHeight;
}

function saveMarks() { ls.set('sync:' + state.key, state.marks); drawTicks(); tick(true); }
function pushHistory() { state.history.push(JSON.stringify(state.marks)); if (state.history.length > 100) state.history.shift(); }
function addMark(t, p, y) {
  pushHistory();
  const pos = (p - 1) + y;
  // keep the mapping monotonic: drop marks that contradict the new one
  state.marks = state.marks.filter(m => (m.t < t - 0.05 && posOf(m) < pos) || (m.t > t + 0.05 && posOf(m) > pos));
  state.marks.push({ t: +t.toFixed(2), p, y: +y.toFixed(4) });
  state.marks.sort((a, b) => a.t - b.t);
  saveMarks();
}
function drawTicks() {
  pagesEl.querySelectorAll('.tick').forEach(e => e.remove());
  state.marks.forEach((m, idx) => {
    const el = state.pageEls[m.p - 1]; if (!el) return;
    const d = document.createElement('div'); d.className = 'tick'; d.style.top = (m.y * 100) + '%';
    d.innerHTML = `<span data-i="${idx}">${fmt(m.t)} ✕</span>`;
    el.appendChild(d);
  });
}

/* ---------- playback UI loop ---------- */
let rafId = 0;
function loop() { tick(false); rafId = audio.paused ? 0 : requestAnimationFrame(loop); }
function tick(force) {
  const t = audio.currentTime || 0, d = audio.duration || 0;
  if (!seeking) { $('seek').max = d || 1; $('seek').value = t; }
  $('cur').textContent = fmt(t); $('dur').textContent = fmt(d);
  const pos = posAt(t);
  const n = state.pageEls.length;
  if (pos == null) { cursorEl.style.display = 'none'; $('pageInfo').textContent = n ? `${visiblePage()} / ${n}` : ''; return; }
  const y = pxOf(pos);
  cursorEl.style.display = 'block'; cursorEl.style.top = y + 'px';
  placeCursorX(pos);
  $('pageInfo').textContent = `${Math.min(n, Math.floor(pos) + 1)} / ${n}`;
  if ((!audio.paused || force) && Date.now() > state.followPausedUntil) follow(y, force);
  $('follow').style.display = Date.now() > state.followPausedUntil ? 'none' : 'block';
}
function follow(y, force) {
  const top = viewer.scrollTop, h = viewer.clientHeight;
  const rel = (y - top) / h;
  if (!(force || rel < 0.18 || rel > 0.65)) return;
  const target = Math.max(0, Math.min(y - h * 0.3, viewer.scrollHeight - h));
  const now = Date.now();
  if (!force && Math.abs(target - (state.scrollTarget ?? -1e9)) < 40 && now - state.scrollAt < 1500) return; // already heading there
  state.scrollTarget = target; state.scrollAt = now;
  viewer.scrollTo({ top: target, behavior: force ? 'auto' : 'smooth' });
}
// keep the highlight inside the page's printed border (if known), else span the page area
function placeCursorX(pos) {
  const i = Math.min(state.pageEls.length - 1, Math.max(0, Math.floor(pos)));
  const el = state.pageEls[i], fr = state.frames && state.frames[i];
  if (!el || !fr) { cursorEl.style.left = ''; cursorEl.style.width = ''; cursorEl.style.right = ''; return; }
  cursorEl.style.left = (el.offsetLeft + fr[0] * el.offsetWidth) + 'px';
  cursorEl.style.width = ((fr[1] - fr[0]) * el.offsetWidth) + 'px';
  cursorEl.style.right = 'auto';
}
function visiblePage() {
  const mid = viewer.scrollTop + viewer.clientHeight / 3;
  let p = 1; for (const el of state.pageEls) { if (el.offsetTop <= mid) p = +el.dataset.n; else break; }
  return p;
}
const pauseFollow = () => { if (state.marks.length) { state.followPausedUntil = Date.now() + 6000; $('follow').style.display = 'block'; } };
['touchstart', 'wheel'].forEach(ev => viewer.addEventListener(ev, pauseFollow, { passive: true }));
viewer.addEventListener('scroll', () => { if (!state.marks.length || audio.paused) $('pageInfo').textContent = state.pageEls.length ? `${visiblePage()} / ${state.pageEls.length}` : ''; }, { passive: true });
$('follow').onclick = () => { state.followPausedUntil = 0; tick(true); };

/* ---------- taps on the PDF ---------- */
pagesEl.addEventListener('click', (e) => {
  const del = e.target.closest('.tick span');
  if (del) { pushHistory(); state.marks.splice(+del.dataset.i, 1); saveMarks(); toast('Mark hata diya'); return; }
  const el = e.target.closest('.page'); if (!el) return;
  const r = el.getBoundingClientRect();
  const p = +el.dataset.n, y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
  if (state.editing) {
    addMark(audio.currentTime, p, y);
    toast(`Mark: page ${p} = ${fmt(audio.currentTime)}`);
    return;
  }
  // double-tap to jump the audio to that spot
  const now = Date.now(), lt = state.lastTap;
  if (lt && now - lt.time < 400 && Math.abs(lt.x - e.clientX) < 40 && Math.abs(lt.y - e.clientY) < 40) {
    state.lastTap = null;
    const t = timeAt((p - 1) + y);
    if (t == null) { toast('Pehle sync karo (✎)'); return; }
    audio.currentTime = t; state.followPausedUntil = 0; tick(true);
    toast(`Jump → ${fmt(t)}`);
  } else state.lastTap = { time: now, x: e.clientX, y: e.clientY };
});

/* ---------- controls ---------- */
const playBtn = $('play');
playBtn.onclick = () => audio.paused ? audio.play() : audio.pause();
audio.onplay = () => { playBtn.textContent = '❚❚'; if (!rafId) loop(); };
audio.onpause = () => { playBtn.textContent = '▶'; ls.set('pos:' + state.key, audio.currentTime); };
audio.onseeked = () => tick(false);
audio.onended = () => ls.set('pos:' + state.key, 0);
setInterval(() => { if (!audio.paused) ls.set('pos:' + state.key, audio.currentTime); }, 5000);
$('back').onclick = () => { audio.currentTime = Math.max(0, audio.currentTime - 10); };
$('fwd').onclick = () => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); };
let seeking = false;
$('seek').oninput = (e) => { seeking = true; $('cur').textContent = fmt(+e.target.value); };
$('seek').onchange = (e) => { seeking = false; audio.currentTime = +e.target.value; state.followPausedUntil = 0; };
const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
$('speed').innerHTML = speeds.map(v => `<option value="${v}">${v}×</option>`).join('');
audio.playbackRate = speeds.includes(ls.get('speed', 1)) ? ls.get('speed', 1) : 1;
$('speed').value = String(audio.playbackRate);
$('speed').onchange = () => { audio.playbackRate = +$('speed').value; ls.set('speed', audio.playbackRate); };
audio.addEventListener('loadedmetadata', () => { audio.playbackRate = +$('speed').value; });
function setEditing(on) {
  state.editing = on; document.body.classList.toggle('editing', on);
  if (on) toast('Sync mode ON — jo line padhi ja rahi hai us pe tap karo', 3500);
}
$('syncBtn').onclick = () => setEditing(!state.editing);
$('doneEdit').onclick = () => { setEditing(false); toast(`${state.marks.length} marks saved`); };
$('undo').onclick = () => {
  if (!state.history.length) return toast('Undo ke liye kuch nahi');
  state.marks = JSON.parse(state.history.pop()); saveMarks();
};
$('markNext').onclick = () => {
  const cur = posAt(audio.currentTime) ?? 0;
  const p = Math.floor(cur) + 2;
  if (p > state.pageEls.length) return toast('Last page hai');
  addMark(audio.currentTime, p, 0); toast(`Page ${p} starts at ${fmt(audio.currentTime)}`);
};
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); playBtn.click(); }
  else if (e.key === 'ArrowLeft') $('back').click();
  else if (e.key === 'ArrowRight') $('fwd').click();
  else if (e.key === 'n' && state.editing) $('markNext').click();
});

/* ---------- menu ---------- */
function renderVersions(vs) {
  const box = $('versions'); if (!box) return;
  box.innerHTML = vs.map(v => `<button data-ver="${v.id}">📄 ${v.label}${v.id === state.version ? ' ✓' : ''}</button>`).join('');
  box.onclick = e => { const b = e.target.closest('[data-ver]'); if (!b || b.dataset.ver === state.version) return; ls.set('ver:' + BASE, b.dataset.ver); location.reload(); };
}
$('menuBtn').onclick = (e) => { e.stopPropagation(); $('menu').classList.toggle('open'); };
document.addEventListener('click', () => $('menu').classList.remove('open'));
$('openFiles').onclick = () => $('filePick').click();
$('filePick').onchange = async (e) => {
  const files = [...e.target.files]; e.target.value = '';
  let pdf = files.find(f => /pdf/i.test(f.type) || /\.pdf$/i.test(f.name));
  let aud = files.find(f => /^audio\//.test(f.type) || /\.(mp3|m4a|aac|wav|ogg|opus)$/i.test(f.name));
  if (!pdf || !aud) return toast('Audio aur PDF dono ek saath select karo', 3500);
  const title = (pdf.name || 'Read Along').replace(/\.pdf$/i, '');
  const key = `picked:${pdf.name}:${pdf.size}|${aud.name}:${aud.size}`;
  await idbPut('current', { pdf, audio: aud, title, key });
  ls.set('source', 'picked'); audio.pause();
  await openMedia({ title, pdfBlob: pdf, audioBlob: aud, key, fileMarks: null }).catch(err => status('Error: ' + err.message));
};
$('useBundled').onclick = () => { ls.set('source', 'bundled'); audio.pause(); loadBundled().catch(err => status(err.message)); };
$('exportSync').onclick = () => {
  const blob = new Blob([JSON.stringify({ marks: state.marks }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sync.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};
$('importSync').onclick = () => $('syncPick').click();
$('syncPick').onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const j = JSON.parse(await f.text()); pushHistory(); state.marks = normalize(j.marks || j); saveMarks(); toast(`${state.marks.length} marks imported`); }
  catch { toast('Invalid sync.json'); }
};
$('clearSync').onclick = () => { if (confirm('Saare sync marks delete karein?')) { pushHistory(); state.marks = []; saveMarks(); } };

/* ---------- lock screen controls ---------- */
function setupMediaSession(title) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({ title, artist: 'Read Along', artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] });
  const h = { play: () => audio.play(), pause: () => audio.pause(), seekbackward: () => $('back').click(), seekforward: () => $('fwd').click(),
    seekto: (d) => { audio.currentTime = d.seekTime; } };
  for (const [k, fn] of Object.entries(h)) try { navigator.mediaSession.setActionHandler(k, fn); } catch {}
}

/* ---------- full screen (reading mode) ---------- */
function setFull(on) {
  document.body.classList.toggle('fs', on);
  const el = document.documentElement;
  try {
    if (on && el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => {});
    if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  } catch {}
  $('fsPlay').textContent = audio.paused ? '▶' : '⏸';
}
$('fsBtn').onclick = () => setFull(true);
$('fsExit').onclick = () => setFull(false);
$('fsPlay').onclick = () => { audio.paused ? audio.play() : audio.pause(); };
audio.addEventListener('play', () => $('fsPlay').textContent = '⏸');
audio.addEventListener('pause', () => $('fsPlay').textContent = '▶');
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && document.body.classList.contains('fs')) document.body.classList.remove('fs'); });

/* ---------- start ---------- */
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
(async () => {
  try {
    if (!DUA_ID && ls.get('source', 'bundled') === 'picked' && await loadPicked()) return;
    await loadBundled();
  } catch (err) {
    status('Files nahi mili. media/ folder me audio + PDF daalo (media/config.json dekho), ya ⋮ → "Open audio + PDF from phone".\n\n' + err.message);
  }
})();
