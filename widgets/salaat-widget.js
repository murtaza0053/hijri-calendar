// Mumin — Salaat timings widget (looks like the app, gold theme) for the iPhone "Scriptable" app (official mumineen.org times).
// Long-press the home screen → + → Scriptable → pick Large (best) / Medium / Small → long-press the widget → Edit Widget →
// Script = this script. Optional "Parameter":  City,latitude,longitude[,altitude]   e.g.  Indore, MP, India,22.7196,75.8577,550
// (the last 2–3 values are numbers; everything before them is the city text). Needs internet once a day; the last times are kept for offline.
// app themes [hdr, gold, card, ink, muted, chip, brand, on-brand] for light / dark — generated from themes.css
const TH = {"green":{"l":["#0f5132","#f0cb6a","#fffdf7","#1d2a22","#5f6e64","#efe8d6","#0f5132","#fff"],"d":["#123524","#f0cb6a","#16201b","#e8efe9","#93a39a","#1f2b25","#3fbf7f","#08130d"]},"maroon":{"l":["#6b1824","#f0cb6a","#fffaf6","#2b1a1a","#7d6a66","#f1e3da","#7a1f2b","#fff"],"d":["#3d1219","#f0cb6a","#211416","#f3e7e6","#a8918f","#2c1b1e","#e0707c","#1a0a0c"]},"navy":{"l":["#1a3363","#f0cb6a","#fbfcfe","#16202e","#5f6b7c","#e1e8f2","#1d3a6e","#fff"],"d":["#14223f","#f0cb6a","#131a26","#e6ecf5","#8e9ab0","#1b2436","#7aa7ff","#0a1222"]},"teal":{"l":["#0c5f5b","#f0cb6a","#fbfefd","#132826","#5d7472","#dfeeec","#0e6e6a","#fff"],"d":["#0f3a37","#f0cb6a","#12201f","#e3f1ef","#8ba7a4","#1a2c2a","#4fd1c5","#06201d"]},"rose":{"l":["#f9d5e1","#f0cb6a","#fffafb","#3a1f28","#7f606a","#fbe8ee","#b83b6b","#fff"],"d":["#4a2233","#f0cb6a","#22151b","#f6e8ee","#b0919d","#2e1c24","#f48fb1","#2a0a17"]},"sky":{"l":["#cfe7f8","#f0cb6a","#fbfdff","#15283a","#5f7387","#e2f0fa","#1f78b4","#fff"],"d":["#173452","#f0cb6a","#121d29","#e5f0fa","#8fa5ba","#1a2939","#7cc4f5","#06192a"]},"lavender":{"l":["#e2d8f5","#f0cb6a","#fdfbff","#2a2140","#74698a","#eee8f8","#6a4fb3","#fff"],"d":["#2e2350","#f0cb6a","#1b1625","#eee8fa","#a59bb8","#251e33","#b9a2f2","#1a0f33"]},"mono":{"l":["#111111","#d4d4d4","#f7f7f7","#111111","#6a6a6a","#e1e1e1","#111111","#fff"],"d":["#000000","#d4d4d4","#171717","#eeeeee","#9a9a9a","#232323","#f0f0f0","#111"]},"midnight":{"l":["#262540","#ffb07a","#2d2c47","#f1f0fb","#a09fc0","#3a3959","#ff8a4c","#1a1020"],"d":["#262540","#ffb07a","#2d2c47","#f1f0fb","#a09fc0","#3a3959","#ff8a4c","#1a1020"]},"nightviolet":{"l":["#26213f","#c4b5fd","#2c2748","#f1f0fb","#a5a8c4","#3a3560","#a78bfa","#140f2b"],"d":["#26213f","#c4b5fd","#2c2748","#f1f0fb","#a5a8c4","#3a3560","#a78bfa","#140f2b"]},"nightocean":{"l":["#12293b","#7dd3fc","#183246","#f1f0fb","#a5a8c4","#1f3d54","#38bdf8","#04202e"],"d":["#12293b","#7dd3fc","#183246","#f1f0fb","#a5a8c4","#1f3d54","#38bdf8","#04202e"]},"nightgreen":{"l":["#123027","#6ee7b7","#173a2e","#f1f0fb","#a5a8c4","#1f4639","#34d399","#03241a"],"d":["#123027","#6ee7b7","#173a2e","#f1f0fb","#a5a8c4","#1f4639","#34d399","#03241a"]},"nightpink":{"l":["#331f36","#f9a8d4","#3b2540","#f1f0fb","#a5a8c4","#4a2f50","#f472b6","#2a0b1c"],"d":["#331f36","#f9a8d4","#3b2540","#f1f0fb","#a5a8c4","#4a2f50","#f472b6","#2a0b1c"]},"gold":{"l":["#2b2108","#f0cb6a","#fffdf4","#2a2008","#6e5f35","#f3e8c4","#8a6508","#fff"],"d":["#2b2108","#f0cb6a","#1d1809","#f5ecd5","#b3a275","#2a2310","#e2b84a","#1a1200"]}};
const raw = (args.widgetParameter || "Indore, MP, India,22.7196,75.8577,553").split(",").map(s => s.trim());
let DARK = false, THEME = "gold"; if (raw[raw.length - 1] === "dark") { DARK = true; raw.pop(); } if (TH[raw[raw.length - 1]]) THEME = raw.pop();   // optional last values: theme name [,dark]
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
// the app's theme (parameter: ...,theme[,dark]; default gold)
const P = TH[THEME][DARK ? "d" : "l"], C = h => new Color(h), mix = (h, k) => { const n = parseInt(h.slice(1), 16), c = x => Math.round(((n >> x) & 255) * (1 - k) + 255 * k).toString(16).padStart(2, "0"); return "#" + c(16) + c(8) + c(0); };
const HDR = C(P[0]), STRIP = C(mix(P[0], 0.12)), GOLD = C(P[1]), CARD = C(P[2]), INK = C(P[3]), MUTED = C(P[4]), CHIP = C(P[5]), BRAND = C(P[6]), ONB = C(P[7]), WHITE = Color.white(), DARKCARD = (parseInt(P[2].slice(1, 3), 16) + parseInt(P[2].slice(3, 5), 16) + parseInt(P[2].slice(5, 7), 16)) < 384;
const fam = config.widgetFamily || "large", small = fam === "small";

w.backgroundColor = CARD; w.setPadding(0, 0, 0, 0); w.spacing = 0;
// floral nakkashi on the left / right edges, fading toward the middle (brown on the cream card, gold on the dark header); skipped if the pictures can't be fetched
let EDGE = null;
if (!small) try {
  const pic = async n => { const f = fm.joinPath(fm.documentsDirectory(), "mumin-" + n + ".png"); if (fm.fileExists(f)) return fm.readImage(f); const im = await new Request("https://murtaza0053.github.io/hijri-calendar/widgets/" + n + ".png").loadImage(); fm.writeImage(f, im); return im; };
  EDGE = { bl: await pic("floral-edge-l-brown"), br: await pic("floral-edge-r-brown"), gl: await pic("floral-edge-l-gold"), gr: await pic("floral-edge-r-gold") };
} catch (e) { EDGE = null; }
const paint = (fill, l, r, W, H, tiles) => {   // one background picture: colour + left/right edge ornaments (tiled down the height when tiles)
  const dc = new DrawContext(); dc.size = new Size(W, H); dc.opaque = true; dc.respectScreenScale = false;   // 1x pixels: a widget has only ~30 MB of memory, 3x pictures made the floral vanish on the home screen
  dc.setFillColor(fill); dc.fillRect(new Rect(0, 0, W, H));
  if (EDGE) { const iw = 190, ih = iw * 656 / 240; for (let y = 0; y < (tiles ? H : 1); y += ih) { dc.drawImageInRect(l, new Rect(0, y, iw, ih)); dc.drawImageInRect(r, new Rect(W - iw, y, iw, ih)); } }
  if (tiles) { dc.setFillColor(HDR); dc.fillRect(new Rect(0, 0, W, H * TOP)); }
  return dc.getImage();
};
// iOS can leave a gap above the header; paint the top of the card in the header colour so it merges (the header always covers this band)
const TOP = small ? 0.35 : 0.25;
// only one background: Scriptable draws a backgroundGradient over the backgroundImage, which hid the floral edges (v244)
if (EDGE) w.backgroundImage = paint(CARD, DARKCARD ? EDGE.gl : EDGE.bl, DARKCARD ? EDGE.gr : EDGE.br, 800, fam === "large" ? 840 : 380, true);
else { const g = new LinearGradient(); g.colors = [HDR, HDR, CARD, CARD]; g.locations = [0, TOP, TOP, 1]; w.backgroundGradient = g; }
// ---- header: weekday / big dates, like the app ----
const head = w.addStack(); head.backgroundColor = HDR; if (EDGE) head.backgroundImage = paint(HDR, EDGE.gl, EDGE.gr, 800, 230, false); head.layoutHorizontally(); head.setPadding(small ? 10 : 14, 16, small ? 8 : 10, 16);
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
  const body = w.addStack(); body.layoutHorizontally(); body.setPadding(fam === "large" ? 12 : 6, 16, fam === "large" ? 12 : 6, 16); body.spacing = 12;
  const sz = fam === "large" ? 34 : 22;
  // no fixed widths (Device.screenSize() is wrong inside widgets): trailing spacers make both columns share the full width, spacers between rows spread them down the full height
  [0, 1].forEach(col => {
    const c = body.addStack(); c.layoutVertically(); c.spacing = 0;
    for (let r = 0; r < 4; r++) {
      const i = col * 4 + r, it = L0[i]; if (!it) continue;
      if (r) c.addSpacer();
      const isNx = onToday && i === ni;
      const row = c.addStack(); row.layoutHorizontally(); row.centerAlignContent(); row.spacing = 8;
      const ic = row.addStack(); ic.size = new Size(sz, sz); ic.cornerRadius = sz / 2; ic.backgroundColor = isNx ? BRAND : CHIP; ic.centerAlignContent();
      const im = ic.addImage(SFSymbol.named(it[2]).image); im.imageSize = new Size(sz * 0.55, sz * 0.55); im.tintColor = isNx ? ONB : BRAND;
      const tx = row.addStack(); tx.layoutVertically(); tx.spacing = 0;
      const n = tx.addText(it[0]); n.font = Font.systemFont(fam === "large" ? 12 : 10); n.textColor = isNx ? BRAND : MUTED; n.minimumScaleFactor = 0.6; n.lineLimit = 2;
      const t2 = tx.addText(fmt(it[1])); t2.font = Font.boldSystemFont(fam === "large" ? 15 : 11); t2.textColor = isNx ? BRAND : INK;
      row.addSpacer();
    }
  });
} else w.addSpacer();   // small: keep the header at the very top
w.refreshAfterDate = new Date(Math.min(nx[1].getTime() + 60e3, now.getTime() + 30 * 6e4));
if (config.runsInWidget) Script.setWidget(w); else if (small) await w.presentSmall(); else await w.presentLarge();
Script.complete();
