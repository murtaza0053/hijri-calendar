// Mumin — Salaat timings widget for the iPhone "Scriptable" app (official mumineen.org times).
// Long-press the home screen → + → Scriptable → pick Large (best) / Medium / Small → long-press the widget → Edit Widget →
// Script = this script. Optional "Parameter":  City,latitude,longitude[,altitude]   e.g.  Indore, MP, India,22.7196,75.8577,550
// (the last 2–3 values are numbers; everything before them is the city text). Needs internet once a day; the last times are kept for offline.
const raw = (args.widgetParameter || "Indore, MP, India,22.7196,75.8577").split(",").map(s => s.trim());
let ALT = 0; if (raw.length >= 4 && !isNaN(parseFloat(raw[raw.length - 1])) && !isNaN(parseFloat(raw[raw.length - 2])) && !isNaN(parseFloat(raw[raw.length - 3]))) ALT = parseFloat(raw.pop());
const LNG = parseFloat(raw.pop()), LAT = parseFloat(raw.pop()), CITY = raw.join(", ");
const fm = FileManager.local(), CACHE = fm.joinPath(fm.documentsDirectory(), "mumin-widget.json");
const AR_M = ["محرم", "صفر", "ربيع الاول", "ربيع الاخر", "جمادى الاولى", "جمادى الاخرى", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];
const arNum = n => String(n).replace(/\d/g, c => "٠١٢٣٤٥٦٧٨٩"[c]);
const API = "https://mumineen.org/api/v1/";
const getJSON = u => new Request(u).loadJSON();
const ymdIn = (d, tz) => d.toLocaleDateString("en-CA", { timeZone: tz });   // "2026-11-26" in the city's own time zone

async function load() {
  let c = {}; try { c = JSON.parse(fm.readString(CACHE)); } catch (e) {}
  try {
    // the city's time zone comes from the official location list (the phone may be somewhere else)
    let tz = c.pos === LAT + "," + LNG ? c.tz : null;
    if (!tz) { const n = (await getJSON(`${API}location/nearest?latitude=${LAT}&longitude=${LNG}`)).data; tz = n && n.timezone || "Asia/Kolkata"; }
    const now = new Date(), t0 = ymdIn(now, tz), t1 = ymdIn(new Date(now.getTime() + 864e5), tz);
    const key = LAT + "," + LNG + "," + ALT + "," + t0;
    if (c.key === key && c.times && c.hijri) return c;
    const t = await getJSON(`${API}salaat?start=${t0}&end=${t1}&latitude=${LAT}&longitude=${LNG}&timezone=${encodeURIComponent(tz)}&altitude=${ALT}`);
    const h = await getJSON(`${API}convert/to-hijri/${t0}`);
    const out = { key, pos: LAT + "," + LNG, tz, t0, t1, off: (t.meta.timezone_offset || 0) * 1000, times: t.data, hijri: h.data.date };
    fm.writeString(CACHE, JSON.stringify(out)); return out;
  } catch (e) { return c.times ? c : null; }   // offline → last saved
}
const data = await load();
const w = new ListWidget();
if (!data || !data.times || !data.times[data.t0]) {
  w.backgroundColor = new Color("#fbf4df"); const t = w.addText("Mumin — no timings yet.\nOpen the widget once with internet."); t.font = Font.systemFont(12); t.textColor = new Color("#6b4515");
  if (config.runsInWidget) Script.setWidget(w); else await w.presentMedium(); Script.complete(); return;
}
const OFF = data.off, now = new Date(), D0 = data.times[data.t0], D1 = data.times[data.t1];
const wall = s => { const m = s.match(/(\d+)-(\d+)-(\d+) (\d+):(\d+):(\d+)/); return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - OFF); };   // the API gives the city's wall-clock time
const mk = o => o ? [["Sihori End", wall(o.sihori), "sunrise.fill"], ["Sunrise", wall(o.sunrise), "sun.horizon.fill"], ["Zawal", wall(o.zawaal), "sun.max.fill"], ["Zuhr End", wall(o.zohr_end), "sun.max.circle.fill"],
  ["Asr End", wall(o.asr_end), "sun.max.fill"], ["Maghrib", wall(o.maghrib), "sunset.fill"], ["Nisf ul Layl Start", wall(o.nisful_layl), "moon.stars.fill"], ["Nisf ul Layl End", wall(o.nisful_layl_end || o.nisful_layl), "moon.stars.fill"]] : [];
const L0 = mk(D0), L1 = mk(D1), all = L0.concat(L1);
let ni = all.findIndex(x => x[1] > now); if (ni < 0) ni = all.length - 1;
const nx = all[ni], onToday = ni < L0.length;
const fmt = d => { const x = new Date(d.getTime() + OFF); return String(x.getUTCHours()).padStart(2, "0") + ":" + String(x.getUTCMinutes()).padStart(2, "0"); };
const dur = ms => { const m = Math.round(ms / 6e4); return Math.floor(m / 60) + "h " + (m % 60) + "m"; };
const dayMs = wall(D0.maghrib) - wall(D0.sunrise);
const [hy, hm, hd] = data.hijri.split("-").map(Number);
const GOLD = new Color("#d49a33"), CREAM = new Color("#fbf4df"), BROWN = new Color("#6b4515"), SOFT = new Color("#efe6cf");
const fam = config.widgetFamily || "large";

w.backgroundColor = CREAM; w.setPadding(0, 0, 0, 0);
// ---- header (gold) ----
const head = w.addStack(); head.backgroundColor = GOLD; head.layoutHorizontally(); head.setPadding(fam === "small" ? 10 : 14, 16, fam === "small" ? 10 : 12, 16); head.centerAlignContent();
const hl = head.addStack(); hl.layoutVertically();
const tt = hl.addText(fmt(nx[1])); tt.font = Font.regularSystemFont(fam === "small" ? 34 : 44); tt.textColor = Color.white();
const tn = hl.addText(nx[0]); tn.font = Font.boldSystemFont(fam === "small" ? 13 : 16); tn.textColor = Color.white(); tn.minimumScaleFactor = 0.7;
if (!onToday) { const tm = hl.addText("tomorrow"); tm.font = Font.systemFont(10); tm.textColor = new Color("#ffffff", 0.8); }
if (fam !== "small") {
  head.addSpacer();
  const hr = head.addStack(); hr.layoutVertically();
  const r1 = hr.addStack(); r1.layoutHorizontally(); r1.addSpacer(); r1.centerAlignContent();
  const hm1 = r1.addText(arNum(hy) + " " + AR_M[hm - 1]); hm1.font = Font.systemFont(13); hm1.textColor = Color.white(); hm1.rightAlignText();
  const hd1 = r1.addText("  " + arNum(hd)); hd1.font = Font.boldSystemFont(26); hd1.textColor = Color.white();
  const [gy, gm, gd] = data.t0.split("-").map(Number); const g = hr.addText(gd + " " + ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][gm - 1] + " " + gy); g.font = Font.systemFont(13); g.textColor = Color.white(); g.rightAlignText();
  const dn = hr.addText("Day: " + dur(dayMs) + " - Night: " + dur(864e5 - dayMs)); dn.font = Font.systemFont(11); dn.textColor = Color.white(); dn.rightAlignText(); dn.minimumScaleFactor = 0.7;
  const lc = hr.addText("📍 " + CITY); lc.font = Font.systemFont(11); lc.textColor = Color.white(); lc.rightAlignText(); lc.minimumScaleFactor = 0.7; lc.lineLimit = 1;
}
// ---- body: 2 columns × 4 rows ----
if (fam !== "small") {
  const body = w.addStack(); body.layoutHorizontally(); body.setPadding(fam === "large" ? 14 : 8, 14, 8, 14); body.spacing = 10;
  const rows = fam === "large" ? 4 : 4, sz = fam === "large" ? 34 : 22;
  [0, 1].forEach(col => {
    const c = body.addStack(); c.layoutVertically(); c.spacing = fam === "large" ? 12 : 4;
    for (let r = 0; r < rows; r++) {
      const i = col * 4 + r, it = L0[i]; if (!it) continue;
      const isNx = onToday && i === ni;
      const row = c.addStack(); row.layoutHorizontally(); row.centerAlignContent(); row.spacing = 8;
      const ic = row.addStack(); ic.size = new Size(sz, sz); ic.cornerRadius = sz / 2; ic.backgroundColor = isNx ? BROWN : SOFT; ic.centerAlignContent();
      const im = ic.addImage(SFSymbol.named(it[2]).image); im.imageSize = new Size(sz * 0.55, sz * 0.55); im.tintColor = isNx ? CREAM : BROWN;
      const tx = row.addStack(); tx.layoutVertically(); tx.spacing = 0;
      const n = tx.addText(it[0]); n.font = Font.systemFont(fam === "large" ? 14 : 10); n.textColor = BROWN; n.minimumScaleFactor = 0.6; n.lineLimit = 2;
      const t2 = tx.addText(fmt(it[1])); t2.font = Font.boldSystemFont(fam === "large" ? 14 : 11); t2.textColor = BROWN;
    }
  });
}
w.refreshAfterDate = new Date(Math.min(nx[1].getTime() + 60e3, now.getTime() + 30 * 6e4));
if (config.runsInWidget) Script.setWidget(w); else if (fam === "small") await w.presentSmall(); else await w.presentLarge();
Script.complete();
