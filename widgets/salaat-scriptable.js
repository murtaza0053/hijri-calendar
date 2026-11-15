// Mumin — Salaat timings widget for the iPhone "Scriptable" app.
// Long-press the home screen → + → Scriptable → pick Small / Medium → long-press the widget → Edit Widget →
// Script = this script. Optional "Parameter": City,latitude,longitude   e.g.  Indore,22.7196,75.8577
// Timings are calculated on the phone (no internet needed), same method as the Mumin app / aajnodin.
const P = (args.widgetParameter || "Indore,22.7196,75.8577").split(",");
const CITY = P[0].trim(), LAT = parseFloat(P[1]), LNG = parseFloat(P[2]);
const H = { gToAJD: (Y, M, D) => Date.UTC(Y, M, D) / 864e5 + 2440587.5 };
function sunTimes(Y, M, D, lat, lng) {
  const rad = Math.PI / 180;
  const jd = H.gToAJD(Y, M, D) + 0.5 - lng / 360; // ~local noon
  const T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360;
  const Ma = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(Ma * rad) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * Ma * rad) * (0.019993 - 0.000101 * T) + Math.sin(3 * Ma * rad) * 0.000289;
  const lam = L0 + C - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * T) * rad);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos((125.04 - 1934.136 * T) * rad);
  const decl = Math.asin(Math.sin(eps * rad) * Math.sin(lam * rad));
  const yv = Math.tan(eps / 2 * rad) ** 2;
  const eqt = 4 / rad * (yv * Math.sin(2 * L0 * rad) - 2 * e * Math.sin(Ma * rad) + 4 * e * yv * Math.sin(Ma * rad) * Math.cos(2 * L0 * rad) - 0.5 * yv * yv * Math.sin(4 * L0 * rad) - 1.25 * e * e * Math.sin(2 * Ma * rad));
  const noon = 720 - 4 * lng - eqt; // minutes UTC
  const cosH = (Math.cos(90.833 * rad) - Math.sin(lat * rad) * Math.sin(decl)) / (Math.cos(lat * rad) * Math.cos(decl));
  const ha = Math.acos(Math.max(-1, Math.min(1, cosH))) / rad;
  const at = min => new Date(Date.UTC(Y, M, D) + min * 6e4);
  return { sunrise: at(noon - 4 * ha), noon: at(noon), sunset: at(noon + 4 * ha) };
}

const NAMES = ["Sihori", "Fajr", "Fajr end", "Zawaal", "Zohr end", "Asr end", "Maghrib", "Isha end"];
function day(d0) {   // 8 timings of the civil date d0 (Date at local midnight)
  const Y = d0.getFullYear(), M = d0.getMonth(), D = d0.getDate();
  const s = sunTimes(Y, M, D, LAT, LNG), n = new Date(Y, M, D + 1), s2 = sunTimes(n.getFullYear(), n.getMonth(), n.getDate(), LAT, LNG);
  const fe = new Date(s.sunrise.getTime() + 60e3), fj = new Date(fe.getTime() - 65 * 6e4), sih = new Date(fj.getTime() - 10 * 6e4);
  const z = new Date(s.noon.getTime() + (s.sunset - s.noon) / 3), a = new Date(s.noon.getTime() + (s.sunset - s.noon) * 2 / 3);
  return [sih, fj, fe, s.noon, z, a, s.sunset, new Date((s.sunset.getTime() + s2.sunrise.getTime()) / 2)].map((t, i) => [NAMES[i], t]);
}
const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const tomorrow = new Date(today.getTime() + 864e5);
const list = day(today), all = list.concat([day(tomorrow)[0]]);
let ni = all.findIndex(x => x[1] > now); if (ni < 0) ni = all.length - 1;
const fmt = d => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const left = ms => { const m = Math.max(0, Math.round(ms / 6e4)), h = Math.floor(m / 60); return h ? h + "h " + (m % 60) + "m" : m + "m"; };

const w = new ListWidget();
const g = new LinearGradient(); g.colors = [new Color("#7a1c2a"), new Color("#4d0f19")]; g.locations = [0, 1]; w.backgroundGradient = g;
w.setPadding(12, 14, 12, 14);
const head = w.addText("🕌 " + CITY); head.font = Font.semiboldSystemFont(12); head.textColor = new Color("#ffffff", 0.75);
const nx = all[ni];
w.addSpacer(4);
const nl = w.addText(nx[0].toUpperCase()); nl.font = Font.semiboldSystemFont(11); nl.textColor = new Color("#e3b341");
const nt = w.addText(fmt(nx[1])); nt.font = Font.boldSystemFont(config.widgetFamily === "small" ? 28 : 34); nt.textColor = Color.white();
const nin = w.addText("in " + left(nx[1] - now)); nin.font = Font.systemFont(12); nin.textColor = new Color("#ffffff", 0.85);
if (config.widgetFamily !== "small") {
  w.addSpacer(8);
  const rows = [list.slice(0, 4), list.slice(4)];
  const box = w.addStack(); box.layoutHorizontally(); box.spacing = 16;
  rows.forEach(col => {
    const c = box.addStack(); c.layoutVertically(); c.spacing = 2;
    col.forEach(([n, t]) => {
      const r = c.addStack(); r.layoutHorizontally(); r.spacing = 6;
      const a = r.addText(n); a.font = Font.systemFont(11); a.textColor = new Color("#ffffff", t < now ? 0.45 : 0.85);
      r.addSpacer();
      const b = r.addText(fmt(t)); b.font = Font.semiboldSystemFont(11); b.textColor = t < now ? new Color("#ffffff", 0.5) : Color.white();
    });
  });
}
w.refreshAfterDate = new Date(Math.min(nx[1].getTime(), now.getTime() + 15 * 6e4));
if (config.runsInWidget) Script.setWidget(w); else await w.presentMedium();
Script.complete();
