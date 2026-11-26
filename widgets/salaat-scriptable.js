// Mumin — Salaat timings widget (looks like the app, gold theme) for the iPhone "Scriptable" app (official mumineen.org times).
// Long-press the home screen → + → Scriptable → pick Large (best) / Medium / Small → long-press the widget → Edit Widget →
// Script = this script. Optional "Parameter":  City,latitude,longitude[,altitude]   e.g.  Indore, MP, India,22.7196,75.8577,550
// (the last 2–3 values are numbers; everything before them is the city text). Needs internet once a day; the last times are kept for offline.
const raw = (args.widgetParameter || "Indore, MP, India,22.7196,75.8577,553").split(",").map(s => s.trim());
let ALT = 0; if (raw.length >= 4 && !isNaN(parseFloat(raw[raw.length - 1])) && !isNaN(parseFloat(raw[raw.length - 2])) && !isNaN(parseFloat(raw[raw.length - 3]))) ALT = parseFloat(raw.pop());
const LNG = parseFloat(raw.pop()), LAT = parseFloat(raw.pop()), CITY = raw.join(", ");
const fm = FileManager.local(), CACHE = fm.joinPath(fm.documentsDirectory(), "mumin-widget.json");
const AR_M = ["محرم", "صفر", "ربيع الاول", "ربيع الاخر", "جمادى الاولى", "جمادى الاخرى", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];
const arNum = n => String(n).replace(/\d/g, c => "٠١٢٣٤٥٦٧٨٩"[c]);
const API = "https://mumineen.org/api/v1/";
const getJSON = u => new Request(u).loadJSON();
const ymdIn = (d, tz) => d.toLocaleDateString("en-CA", { timeZone: tz });   // "2026-11-26" in the city's own time zone

let ERR = "";
async function load() {
  let c = {}; try { c = JSON.parse(fm.readString(CACHE)) || {}; } catch (e) {}   // readString gives null (not an error) when there is no saved file yet
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
  } catch (e) { ERR = String(e); return c.times ? c : null; }   // offline → last saved
}
const data = await load();
const w = new ListWidget();
if (!data || !data.times || !data.times[data.t0]) {
  w.backgroundColor = new Color("#fffdf4"); const t = w.addText("Mumin — no timings yet.\nOpen the widget once with internet.\n" + ERR); t.font = Font.systemFont(12); t.textColor = new Color("#6b4515");
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
const [hy, hm, hd] = data.hijri.split("-").map(Number);
const EN_M = ["Moharram al-Haraam", "Safar al-Muzaffar", "Rabi al-Awwal", "Rabi al-Aakhar", "Jumada al-Ula", "Jumada al-Ukhra", "Rajab al-Asab", "Shabaan al-Karim", "Ramadaan al-Moazzam", "Shawwal al-Mukarram", "Zilqadah al-Haraam", "Zilhaj al-Haraam"];
const GM = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const [gy, gm, gd] = data.t0.split("-").map(Number), WD = new Date(Date.UTC(gy, gm - 1, gd)).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toUpperCase();
// the app's gold theme
const HDR = new Color("#2b2108"), STRIP = new Color("#3a3018"), GOLD = new Color("#b8892b"), CARD = new Color("#fffdf4"), INK = new Color("#2a2008"), MUTED = new Color("#6e5f35"), CHIP = new Color("#f3e8c4"), BRAND = new Color("#8a6508"), WHITE = Color.white();
const fam = config.widgetFamily || "large", small = fam === "small";

w.backgroundColor = CARD; w.setPadding(0, 0, 0, 0); w.spacing = 0;
// floral nakkashi corners (the app's quote-card ornament) drawn into the widget background; skipped if the pictures can't be fetched
if (!small) try {
  const BASE = "https://murtaza0053.github.io/hijri-calendar/widgets/", pic = async n => { const f = fm.joinPath(fm.documentsDirectory(), "mumin-" + n + ".png"); if (fm.fileExists(f)) return fm.readImage(f); const im = await new Request(BASE + n + ".png").loadImage(); fm.writeImage(f, im); return im; };
  const bl = await pic("floral-bl"), br = await pic("floral-br"), W = 800, H = fam === "large" ? 840 : 380, iw = fam === "large" ? 230 : 120, ih = iw * 410 / 300;
  const dc = new DrawContext(); dc.size = new Size(W, H); dc.opaque = true; dc.respectScreenScale = true;
  dc.setFillColor(CARD); dc.fillRect(new Rect(0, 0, W, H));
  dc.drawImageInRect(bl, new Rect(0, H - ih, iw, ih)); dc.drawImageInRect(br, new Rect(W - iw, H - ih, iw, ih));
  w.backgroundImage = dc.getImage();
} catch (e) {}
// ---- header: weekday / big dates, like the app ----
const head = w.addStack(); head.backgroundColor = HDR; head.layoutHorizontally(); head.setPadding(small ? 10 : 14, 16, small ? 8 : 10, 16);
const hl = head.addStack(); hl.layoutVertically(); hl.spacing = 0;
const wd = hl.addText(small ? WD.slice(0, 3) : WD); wd.font = Font.systemFont(10); wd.textColor = new Color("#ffffff", 0.75);
const gdn = hl.addText(String(gd)); gdn.font = Font.boldSystemFont(small ? 34 : 38); gdn.textColor = GOLD;
const gmt = hl.addText(GM[gm - 1] + " " + gy); gmt.font = Font.systemFont(12); gmt.textColor = WHITE;
head.addSpacer();
const hr = head.addStack(); hr.layoutVertically(); hr.spacing = 0;
const hdn = hr.addText(arNum(hd)); hdn.font = Font.boldSystemFont(small ? 34 : 38); hdn.textColor = GOLD; hdn.rightAlignText();
if (!small) {
  const a1 = hr.addText(AR_M[hm - 1] + " " + arNum(hy)); a1.font = Font.systemFont(14); a1.textColor = WHITE; a1.rightAlignText();
  const e1 = hr.addText(EN_M[hm - 1] + " " + hy + "H"); e1.font = Font.systemFont(11); e1.textColor = new Color("#ffffff", 0.75); e1.rightAlignText(); e1.minimumScaleFactor = 0.7; e1.lineLimit = 1;
}
// ---- strip: city + next timing ----
const st = w.addStack(); st.backgroundColor = STRIP; st.layoutHorizontally(); st.centerAlignContent(); st.setPadding(6, 16, 6, 16);
if (!small) { const lc = st.addText("📍 " + CITY); lc.font = Font.systemFont(12); lc.textColor = WHITE; lc.lineLimit = 1; lc.minimumScaleFactor = 0.7; st.addSpacer(); }
const nt = st.addText((small ? "" : nx[0] + "  ") + fmt(nx[1]) + (onToday ? "" : " ↷")); nt.font = Font.boldSystemFont(small ? 14 : 13); nt.textColor = GOLD; nt.lineLimit = 1; nt.minimumScaleFactor = 0.6;
if (small) { st.addSpacer(); const nn = st.addText(nx[0]); nn.font = Font.systemFont(10); nn.textColor = WHITE; nn.lineLimit = 1; nn.minimumScaleFactor = 0.5; }
// ---- body: 2 columns × 4 rows ----
if (!small) {
  const body = w.addStack(); body.layoutHorizontally(); body.setPadding(fam === "large" ? 14 : 8, 14, 8, 14); body.spacing = 10;
  const sz = fam === "large" ? 34 : 22, colW = Math.floor((Device.screenSize().width * 0.84 - 28 - 10) / 2);   // widget width ≈ 84% of the screen width
  [0, 1].forEach(col => {
    const c = body.addStack(); c.layoutVertically(); c.spacing = fam === "large" ? 12 : 4; c.size = new Size(colW, 0);
    for (let r = 0; r < 4; r++) {
      const i = col * 4 + r, it = L0[i]; if (!it) continue;
      const isNx = onToday && i === ni;
      const row = c.addStack(); row.layoutHorizontally(); row.centerAlignContent(); row.spacing = 8;
      const ic = row.addStack(); ic.size = new Size(sz, sz); ic.cornerRadius = sz / 2; ic.backgroundColor = isNx ? BRAND : CHIP; ic.centerAlignContent();
      const im = ic.addImage(SFSymbol.named(it[2]).image); im.imageSize = new Size(sz * 0.55, sz * 0.55); im.tintColor = isNx ? WHITE : BRAND;
      const tx = row.addStack(); tx.layoutVertically(); tx.spacing = 0;
      const n = tx.addText(it[0]); n.font = Font.systemFont(fam === "large" ? 12 : 10); n.textColor = isNx ? BRAND : MUTED; n.minimumScaleFactor = 0.6; n.lineLimit = 2;
      const t2 = tx.addText(fmt(it[1])); t2.font = Font.boldSystemFont(fam === "large" ? 15 : 11); t2.textColor = isNx ? BRAND : INK;
    }
  });
}
w.addSpacer();   // keep the header at the very top
w.refreshAfterDate = new Date(Math.min(nx[1].getTime() + 60e3, now.getTime() + 30 * 6e4));
if (config.runsInWidget) Script.setWidget(w); else if (small) await w.presentSmall(); else await w.presentLarge();
Script.complete();
