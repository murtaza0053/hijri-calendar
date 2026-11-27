// Mumin push worker (Cloudflare Workers + D1). Stores push subscriptions with the user's city / language / chosen alerts, and a
// cron trigger (every minute) sends the alerts that fall in that minute as encrypted Web Push messages.
import "../hijri.js";                    // sets globalThis.H (same Misri calendar as the app)
import { sendPush, b64u } from "./webpush.js";
import QUOTES from "../quotes.json" with { type: "json" };

const ORIGINS = ["https://murtaza0053.github.io", "http://localhost:8765", "http://127.0.0.1:8765"];
const PUSH_HOSTS = ["fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"];
const SITE = "https://murtaza0053.github.io/hijri-calendar/";
const SAL_KEYS = ["sih", "faj", "fe", "zaw", "ze", "ae", "mag", "nis"];
const MAX_SEND = 30;   // free plan: 50 subrequests per invocation

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

const SAL_API = "https://mumineen.org/api/v1/salaat", SAL_F = ["sihori", "fajr", "sunrise", "zawaal", "zohr_end", "asr_end", "maghrib", "nisful_layl"];
const TZ_ALIAS = { "Asia/Calcutta": "Asia/Kolkata", "Asia/Katmandu": "Asia/Kathmandu", "Asia/Saigon": "Asia/Ho_Chi_Minh", "Asia/Rangoon": "Asia/Yangon", "Asia/Dacca": "Asia/Dhaka", "Asia/Macao": "Asia/Macau", "Asia/Thimbu": "Asia/Thimphu", "Asia/Ulan_Bator": "Asia/Ulaanbaatar", "Africa/Asmera": "Africa/Asmara", "Atlantic/Faeroe": "Atlantic/Faroe", "America/Buenos_Aires": "America/Argentina/Buenos_Aires", "Europe/Kiev": "Europe/Kyiv", "Pacific/Truk": "Pacific/Chuuk" };   // the API rejects old zone names (e.g. Asia/Calcutta)
const apiTz = tz => TZ_ALIAS[tz] || tz;
const locKey = s => (+s.lat).toFixed(2) + "," + (+s.lng).toFixed(2) + "," + (s.tz || "UTC");
const pad2 = n => String(n).padStart(2, "0"), dayStr = (Y, M, D) => `${Y}-${pad2(M + 1)}-${pad2(D)}`;
function tzOff(ms, tz) { const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(ms)).map(x => [x.type, x.value])); return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000; }
function wallMs(str, tz) { const m = str.match(/(\d+)-(\d+)-(\d+) (\d+):(\d+):(\d+)/), u = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]); let o = tzOff(u, tz); o = tzOff(u - o, tz); return u - o; }   // "2026-11-26 05:36:00" in tz → epoch ms

/** The 8 timings of a local civil date. mumineen.org API values when `cache[locKey][day]` is loaded, else the local calculation below. */
function salaatDay(Y, M, D, lat, lng, cache, key) {
  const x = cache && key && cache[key] && cache[key][dayStr(Y, M, D)];
  if (x) return [["sih", new Date(x.sihori)], ["faj", new Date(x.fajr)], ["fe", new Date(x.sunrise)], ["zaw", new Date(x.zawaal)], ["ze", new Date(x.zohr_end)], ["ae", new Date(x.asr_end)], ["mag", new Date(x.maghrib)], ["nis", new Date(x.nisful_layl)]];
  const s = sunTimes(Y, M, D, lat, lng), n = new Date(Date.UTC(Y, M, D + 1)), s2 = sunTimes(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), lat, lng);
  const fe = new Date(s.sunrise.getTime() + 60e3), fj = new Date(fe.getTime() - 65 * 6e4), sih = new Date(fj.getTime() - 10 * 6e4);
  const ze = new Date(s.noon.getTime() + (s.sunset - s.noon) / 3), ae = new Date(s.noon.getTime() + (s.sunset - s.noon) * 2 / 3);
  return [["sih", sih], ["faj", fj], ["fe", fe], ["zaw", s.noon], ["ze", ze], ["ae", ae], ["mag", s.sunset], ["nis", new Date((s.sunset.getTime() + s2.sunrise.getTime()) / 2)]];
}

const TXT = {
  en: { sih: "Sihori", faj: "Fajr", fe: "Fajr end", zaw: "Zawaal", ze: "Zohr end", ae: "Asr end", mag: "Maghrib", nis: "Nisful Layl", now: "It is {n} time.", soon: "{n} in {m} minutes.",
        rozi: "📖 Rozi amal: Surat {s}", roziB: "Hijri {d} — recite it once for barakat in rozi.", tas: "📿 Today's tasbeeh", tasB: "{t} — 100 times.",
        sdq: "🤲 Today's sadaqah", sdqB: "Give sadaqah today: {i}.", miq: "🕌 Miqaat", miqN: "🌙 Tonight: {t}", miqT: "📅 Tomorrow: {t}", wsq: "🌙 Washeq raat in 1 month", wsqB: "{t} — {d}. Time to prepare.",
        qt: "✨ Quote of the day ✨", qtG: "Open Mumin to read today’s quote from Raudat Hidayaat.", kum: "🌙 Shab-e-Juma", kumB: "Tonight, after Maghrib: recite Dua e Kumail.", test: "🔔 Alerts are on", testB: "You will get your Salaat and amal alerts on this device." },
  gu: { sih: "સિહોરી", faj: "ફજર", fe: "ફજર અંત", zaw: "ઝવાલ", ze: "ઝોહર અંત", ae: "અસર અંત", mag: "મગરિબ", nis: "નિસ્ફુલ લૈલ", now: "{n} નો સમય થયો.", soon: "{m} મિનિટમાં {n}.",
        rozi: "📖 રોઝી અમલ: સૂરત {s}", roziB: "હિજરી {d} — રોઝીમાં બરકત માટે એક વાર પઢો.", tas: "📿 આજની તસ્બીહ", tasB: "{t} — 100 વાર.",
        sdq: "🤲 આજનો સદકો", sdqB: "આજે સદકો આપો: {i}.", miq: "🕌 મિકાત", miqN: "🌙 આજે રાત્રે: {t}", miqT: "📅 આવતી કાલે: {t}", wsq: "🌙 વાશિક રાત 1 મહિના પછી", wsqB: "{t} — {d}. તૈયારીનો સમય.",
        qt: "✨ આજનું સુવચન ✨", qtG: "રૌઝતુલ હિદાયાતનું આજનું સુવચન વાંચવા મુમિન ખોલો.", kum: "🌙 શબે જુમા", kumB: "આજે રાત્રે, મગરિબ પછી: દુઆ એ કુમૈલ પઢો.", test: "🔔 અલર્ટ ચાલુ છે", testB: "આ ડિવાઇસ પર તમને સલાત અને અમલના અલર્ટ મળશે." },
  hi: { sih: "Sihori", faj: "Fajr", fe: "Fajr end", zaw: "Zawaal", ze: "Zohr end", ae: "Asr end", mag: "Maghrib", nis: "Nisful Layl", now: "{n} ka waqt ho gaya.", soon: "{n} me {m} minute baaki.",
        rozi: "📖 Rozi amal: Surat {s}", roziB: "Hijri {d} — rozi me barakat ke liye ek baar padho.", tas: "📿 Aaj ki tasbeeh", tasB: "{t} — 100 baar.",
        sdq: "🤲 Aaj ka sadaqah", sdqB: "Aaj sadaqah do: {i}.", miq: "🕌 Miqaat", miqN: "🌙 Aaj raat: {t}", miqT: "📅 Kal: {t}", wsq: "🌙 Washeq raat 1 mahine baad", wsqB: "{t} — {d}. Taiyari ka waqt.",
        qt: "✨ Aaj ka quote ✨", qtG: "Raudat Hidayaat ka aaj ka quote padhne ke liye Mumin kholo.", kum: "🌙 Shab-e-Juma", kumB: "Aaj raat, Maghrib ke baad: Dua e Kumail padho.", test: "🔔 Alerts on hain", testB: "Is device par aapko Salaat aur amal ke alerts milenge." }
};
const ROZI = [[2, "Yaseen"], [3, "ar-Rahman"], [4, "al-Waqiah"], [5, "al-Hashr"], [6, "al-Jumuah"], [7, "al-Jinn"]];
const WEEK = ["Iyyaka Na'budu Wa Iyyaka Nasta'een", "Ya Ghafoor, Ya Raheem", "SubhanAllahi wal Hamdu Lillah", "Ya Rahman, Ya Raheem", "HasbunAllahu Wa Ni'mal Wakeel", "Ya Zal Jalali Wal Ikram", "Ya Hayyu, Ya Qayyum"];
const SADAQAH = ["Rice (Chawal)", "Rice (Chawal)", "Moong dal", "Tuwar dal", "Rice (Chawal)", "Wheat (Ghau)", "Rice (Chawal)"];
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

function localParts(ms, tz) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", weekday: "short" });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return { y: +p.year, m: +p.month - 1, d: +p.day, hh: +p.hour, mm: +p.minute, dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
}

/** Major miqaats (everything except "Urus") of a Gregorian date, from the mumineen.org data in `miq` ({ "hijriYear-month0": [{d, n, t}] }): [{title, phase, washeq}] */
function miqOn(y, m, d, miq) {
  const h = H.fromAJD(H.gToAJD(y, m, d)), list = (miq && miq[h.y + "-" + h.m]) || [];
  return list.filter(q => q.d === h.d && q.t !== "Urus").map(q => ({ title: q.n, phase: /raat|laylat|layl/i.test(q.t + " " + q.n) ? "night" : "day", washeq: /washeq/i.test(q.n) }));
}
const ymd = (y, m, d, add) => { const x = new Date(Date.UTC(y, m, d + add)); return [x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()]; };
/** English text of the day's quote ("" when that quote has no proof-read text); same day→quote rule as the app */
function quoteOn(p) {
  const [y, m, d] = QUOTES.start.split("-").map(Number), n = QUOTES.q.length;
  return QUOTES.q[((Math.floor((Date.UTC(p.y, p.m, p.d) - Date.UTC(y, m - 1, d)) / 864e5) % n) + n) % n];
}
/** Friday reminder text (the user\'s own wording). Today is a Friday, so it is the ((day-1)/7+1)th Friday of the Hijri month. */
const ORD = n => n + (["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || "th");
export const jumoaBody = h => `AsSalaam o Walaikum.\n✔ Cutting nails  ✔ Do Gusul  ✔ Wear nice cloth  ✔ Apply Ittar\n\n${ORD(Math.floor((h.d - 1) / 7) + 1)} JUMOA MUBARAK OF ${H.NAMES[h.m].toUpperCase()} ${h.y}H\n\nJUMO'A NA DIN: 1) Imamat si Namaz  2) Dua-e-Kaamil  3) Suratul Kehaf  4) Qardan Hasana\n\n🤲 Dua ni khaas iltemas`;
/** Alerts of one subscription that fall in the minute starting at ws (ms). */
export function dueEvents(s, ws, cache, miq) {
  const pr = JSON.parse(s.prefs || "{}"), T = TXT[s.lang] || TXT.en, out = [];
  let p; try { p = localParts(ws, s.tz || "UTC"); } catch { p = localParts(ws, "UTC"); }
  const city = s.city || "";
  const lead = Math.min(120, Math.max(0, +pr.lead || 0)) * 60000, tm = pr.t || {};
  const at = (k, def) => { const m = /^(\d\d):(\d\d)$/.exec(tm[k] || def) || /^(\d\d):(\d\d)$/.exec(def); return +m[1] === p.hh && +m[2] === p.mm; };
  if (pr.sal && pr.sal.length) for (const off of [-1, 0, 1]) {
    const d0 = new Date(Date.UTC(p.y, p.m, p.d + off));
    for (const [k, t] of salaatDay(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate(), s.lat, s.lng, cache, locKey(s))) {
      const due = t.getTime() - lead;
      if (pr.sal.includes(k) && due >= ws && due < ws + 60000)
        out.push({ title: `🕌 ${T[k]}${city ? " — " + city : ""}`, body: lead ? fill(T.soon, { n: T[k], m: Math.round(lead / 60000) }) : fill(T.now, { n: T[k] }), url: ["faj", "zaw", "mag"].includes(k) ? "./#azaan" : "./#sl", tag: "sal-" + k });
    }
  }
  if (at("rozi", "08:00") && pr.rozi) { const h = H.fromAJD(H.gToAJD(p.y, p.m, p.d)), r = ROZI.find(x => x[0] === h.d); if (r) out.push({ title: fill(T.rozi, { s: r[1] }), body: fill(T.roziB, { d: h.d }), url: "./#dua", tag: "rozi" }); }
  if (at("tasbeeh", "07:00") && pr.tasbeeh) out.push({ title: T.tas, body: fill(T.tasB, { t: WEEK[p.dow] }), url: "./dua/tasbeeh.html?m=week", tag: "tasbeeh" });
  if (at("sadaqah", "08:00") && pr.sadaqah) out.push({ title: T.sdq, body: fill(T.sdqB, { i: SADAQAH[p.dow] }), url: "./#dua", tag: "sadaqah" });
  if (at("miq", "20:00") && pr.miq) {
    const tm2 = miqOn(...ymd(p.y, p.m, p.d, 1), miq).filter(q => q.phase === "day"), tn = miqOn(p.y, p.m, p.d, miq).filter(q => q.phase === "night");
    if (tm2.length) out.push({ title: T.miq, body: fill(T.miqT, { t: tm2.map(q => q.title).join(" · ") }), url: "./", tag: "miq-day" });
    if (tn.length) out.push({ title: T.miq, body: fill(T.miqN, { t: tn.map(q => q.title).join(" · ") }), url: "./", tag: "miq-night" });
    // Washeq raat: heads-up one month before
    const [wy, wm, wd] = ymd(p.y, p.m, p.d, 30), ws2 = miqOn(wy, wm, wd, miq).filter(q => q.washeq);
    if (ws2.length) { const h2 = H.fromAJD(H.gToAJD(wy, wm, wd)); out.push({ title: T.wsq, body: fill(T.wsqB, { t: ws2.map(q => q.title).join(" · "), d: `${h2.d} ${H.SHORT[h2.m]} ${h2.y}H` }), url: "./", tag: "miq-washeq" }); }
  }
  if (at("jumoa", "07:00") && p.dow === 5 && pr.jumoa) out.push({ title: "🕌 Friday Reminder", body: jumoaBody(H.fromAJD(H.gToAJD(p.y, p.m, p.d))), url: "./#fri", tag: "jumoa" });
  if (at("kumail", "19:00") && p.dow === 4 && pr.kumail) out.push({ title: T.kum, body: T.kumB, url: "./dua/kumail.html", tag: "kumail" });
  if (at("quote", "10:00") && pr.quote) out.push({ title: T.qt, body: quoteOn(p), url: "./", tag: "quote" });
  return out;
}

const cors = req => { const o = req.headers.get("Origin"); return { "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0], "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" }; };
const json = (req, obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors(req) } });
const sha = async s => b64u.enc(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))).slice(0, 32);
function cleanPrefs(p = {}) {
  const t = {}; for (const k of ["rozi", "tasbeeh", "sadaqah", "kumail", "miq", "quote", "jumoa"]) if (/^([01]\d|2[0-3]):[0-5]\d$/.test((p.t || {})[k])) t[k] = p.t[k];
  return { sal: (Array.isArray(p.sal) ? p.sal : []).filter(k => SAL_KEYS.includes(k)), lead: [0, 5, 10, 15, 20, 30, 45, 60].includes(+p.lead) ? +p.lead : 0, t, rozi: !!p.rozi, tasbeeh: !!p.tasbeeh, sadaqah: !!p.sadaqah, kumail: !!p.kumail, jumoa: !!p.jumoa, miq: !!p.miq, quote: !!p.quote };
}
const okEndpoint = e => { try { const u = new URL(e); return u.protocol === "https:" && PUSH_HOSTS.some(h => u.hostname === h || u.hostname.endsWith("." + h)); } catch { return false; } };

async function handle(req, env) {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method === "GET" && url.pathname.startsWith("/widget/")) {   // the iPhone widget reads the app's theme + city saved under its random code
    const code = url.pathname.slice(8); if (!/^[a-z0-9]{12,32}$/.test(code)) return json(req, { error: "code" }, 400);
    const r = await env.DB.prepare("SELECT data FROM widgetcfg WHERE code=?").bind(code).first();
    return r ? json(req, JSON.parse(r.data)) : json(req, { error: "none" }, 404);
  }
  if (req.method === "GET") return json(req, { ok: true, service: "mumin-push" });
  if (req.method !== "POST") return json(req, { error: "method" }, 405);
  let b; try { b = await req.json(); } catch { return json(req, { error: "json" }, 400); }
  if (url.pathname === "/widget") {   // the app saves theme / city under a random code (no account, nothing else is stored)
    const code = String(b.code || ""), num = (v, lo, hi) => Number.isFinite(+v) && +v >= lo && +v <= hi ? +v : null;
    const cfg = { theme: /^[a-z]{3,16}$/.test(b.theme) ? b.theme : "gold", dark: !!b.dark, city: String(b.city || "").slice(0, 80), lat: num(b.lat, -90, 90), lng: num(b.lng, -180, 180), alt: num(b.alt, -500, 9000) || 0 };
    if (!/^[a-z0-9]{12,32}$/.test(code) || cfg.lat === null || cfg.lng === null) return json(req, { error: "bad" }, 400);
    await env.DB.prepare("INSERT INTO widgetcfg(code,data,at) VALUES(?,?,?) ON CONFLICT(code) DO UPDATE SET data=excluded.data, at=excluded.at").bind(code, JSON.stringify(cfg), Date.now()).run();
    return json(req, { ok: true });
  }
  if (url.pathname === "/subscribe") {
    const sub = b.subscription || {}, k = sub.keys || {};
    if (!okEndpoint(sub.endpoint) || !k.p256dh || !k.auth) return json(req, { error: "subscription" }, 400);
    const lat = +b.lat, lng = +b.lng; if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return json(req, { error: "location" }, 400);
    const id = await sha(sub.endpoint), tz = String(b.tz || "UTC").slice(0, 60), city = String(b.city || "").slice(0, 60), lang = ["en", "gu", "hi"].includes(b.lang) ? b.lang : "en";
    try { new Intl.DateTimeFormat("en", { timeZone: tz }); } catch { return json(req, { error: "tz" }, 400); }
    await env.DB.prepare("INSERT INTO subs(id,endpoint,p256dh,auth,prefs,lat,lng,tz,city,lang,created,last_tick) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,prefs=excluded.prefs,lat=excluded.lat,lng=excluded.lng,tz=excluded.tz,city=excluded.city,lang=excluded.lang")
      .bind(id, sub.endpoint, k.p256dh, k.auth, JSON.stringify(cleanPrefs(b.prefs)), lat, lng, tz, city, lang, Date.now(), Math.floor(Date.now() / 60000) * 60000).run();
    return json(req, { ok: true, id });
  }
  if (url.pathname === "/unsubscribe") {
    if (!b.endpoint) return json(req, { error: "endpoint" }, 400);
    const id = await sha(b.endpoint); await env.DB.batch([env.DB.prepare("DELETE FROM outbox WHERE sub_id=?").bind(id), env.DB.prepare("DELETE FROM subs WHERE id=?").bind(id)]);
    return json(req, { ok: true });
  }
  if (url.pathname === "/test") {
    if (!b.endpoint) return json(req, { error: "endpoint" }, 400);
    const s = await env.DB.prepare("SELECT * FROM subs WHERE id=?").bind(await sha(b.endpoint)).first();
    if (!s) return json(req, { error: "not subscribed" }, 404);
    const T = TXT[s.lang] || TXT.en, pr = JSON.parse(s.prefs || "{}");
    let msg = { title: T.test, body: T.testB, url: "./", tag: "test" };
    if (pr.quote) { let p; try { p = localParts(Date.now(), s.tz || "UTC"); } catch { p = localParts(Date.now(), "UTC"); } msg = { title: T.qt, body: quoteOn(p), url: "./", tag: "quote-now" }; }   // turning alerts on / the test button shows today's quote
    const st = await sendPush(s, msg, env);
    return json(req, { ok: st >= 200 && st < 300, status: st });
  }
  return json(req, { error: "not found" }, 404);
}


/** Make sure D1 holds mumineen.org times for every subscriber location (one API call per location per ~month), and return them as { locKey: { "YYYY-MM-DD": {sihori…: epoch} } }. */
const salFail = new Map();   // locKey → last failed attempt (ms): do not hammer the API from every minute's tick
async function loadSalaat(env, subs, ws) {
  const keys = new Map(); for (const s of subs) keys.set(locKey(s), s);
  const cache = {}; if (!keys.size) return cache;
  const need = [];
  for (const [k, s] of keys) {
    let p; try { p = localParts(ws, s.tz || "UTC"); } catch { p = localParts(ws, "UTC"); }
    const days = [-1, 0, 1, 2].map(o => dayStr(...ymd(p.y, p.m, p.d, o)));
    keys.get(k).days = days;
  }
  const lo = [...keys.values()].map(s => s.days[0]).sort()[0];
  const { results } = await env.DB.prepare("SELECT loc, day, data FROM saltimes WHERE day >= ?").bind(lo).all();
  for (const r of results) { (cache[r.loc] = cache[r.loc] || {})[r.day] = JSON.parse(r.data); }
  for (const [k, s] of keys) if (!s.days.every(d => cache[k] && cache[k][d]) && ws - (salFail.get(k) || 0) > 10 * 60000) need.push(k);
  for (const k of need.slice(0, 8)) {   // free plan: 50 subrequests per invocation, MAX_SEND are reserved for pushes
    const s = keys.get(k), tz = s.tz || "UTC", a = s.days[0], [y, m, d] = a.split("-").map(Number), e = new Date(Date.UTC(y, m - 1, d + 31));
    try {
      const r = await fetch(`${SAL_API}?start=${a}&end=${dayStr(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate())}&latitude=${+s.lat}&longitude=${+s.lng}&timezone=${encodeURIComponent(apiTz(tz))}&altitude=0`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      const j = await r.json(), st = [];
      for (const [day, o] of Object.entries(j.data || {})) { const x = {}; for (const f of SAL_F) { if (!o[f]) throw new Error("bad"); x[f] = wallMs(o[f], tz); } (cache[k] = cache[k] || {})[day] = x; st.push(env.DB.prepare("INSERT OR REPLACE INTO saltimes(loc,day,data) VALUES(?,?,?)").bind(k, day, JSON.stringify(x))); }
      if (!st.length) throw new Error("empty");
      for (let i = 0; i < st.length; i += 40) await env.DB.batch(st.slice(i, i + 40));
    } catch { salFail.set(k, ws); }
  }
  return cache;
}

/** mumineen.org miqaats of the Hijri months the subscribers need (today, tomorrow, +30 days), cached in D1 table miqapi for 30 days. */
const MQ_API = "https://mumineen.org/api/v1/calendar/", miqFail = new Map();
async function loadMiq(env, subs, ws) {
  const need = new Set();
  for (const s of subs) { let p; try { p = localParts(ws, s.tz || "UTC"); } catch { p = localParts(ws, "UTC"); } for (const off of [0, 1, 30]) { const [y, m, d] = ymd(p.y, p.m, p.d, off), h = H.fromAJD(H.gToAJD(y, m, d)); need.add(h.y + "-" + h.m); } }
  const miq = {}, at = {}; if (!need.size) return miq;
  const { results } = await env.DB.prepare("SELECT ym, data, at FROM miqapi").all();
  for (const r of results) { miq[r.ym] = JSON.parse(r.data); at[r.ym] = r.at; }
  const todo = [...need].filter(k => (!at[k] || ws - at[k] > 30 * 864e5) && ws - (miqFail.get(k) || 0) > 10 * 60000);
  for (const k of todo.slice(0, 4)) {
    const [y, m] = k.split("-").map(Number);
    try {
      const r = await fetch(`${MQ_API}${y}-${pad2(m + 1)}-15`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      const j = await r.json(); if (!Array.isArray(j.miqats)) throw new Error("bad");
      const list = j.miqats.map(q => ({ d: +q.day, n: String(q.name), t: q.type && q.type.name || "" }));
      await env.DB.prepare("INSERT OR REPLACE INTO miqapi(ym,data,at) VALUES(?,?,?)").bind(k, JSON.stringify(list), ws).run(); miq[k] = list;
    } catch { miqFail.set(k, ws); }
  }
  return miq;
}

export async function tick(env, now = Date.now()) {
  const ws = Math.floor(now / 60000) * 60000;
  const { results: subs } = await env.DB.prepare("SELECT * FROM subs WHERE last_tick < ?").bind(ws).all();
  const stmts = [], cache = await loadSalaat(env, subs, ws).catch(() => ({})), miq = await loadMiq(env, subs, ws).catch(() => ({}));   // any failure → local calculation / no miqaat alerts
  for (const s of subs) {
    for (const e of dueEvents(s, ws, cache, miq)) stmts.push(env.DB.prepare("INSERT INTO outbox(sub_id,payload,due,tries) VALUES(?,?,?,0)").bind(s.id, JSON.stringify(e), ws));
    stmts.push(env.DB.prepare("UPDATE subs SET last_tick=? WHERE id=?").bind(ws, s.id));
  }
  for (let i = 0; i < stmts.length; i += 40) await env.DB.batch(stmts.slice(i, i + 40));
  await env.DB.prepare("DELETE FROM outbox WHERE due < ?").bind(ws - 2 * 3600e3).run();
  if (new Date(ws).getUTCMinutes() === 7 && new Date(ws).getUTCHours() === 3) { await env.DB.prepare("DELETE FROM saltimes WHERE day < ?").bind(new Date(ws - 5 * 864e5).toISOString().slice(0, 10)).run(); await env.DB.prepare("DELETE FROM widgetcfg WHERE at < ?").bind(ws - 400 * 864e5).run(); }   // daily clean-up
  const { results: q } = await env.DB.prepare("SELECT o.id AS oid, o.payload, o.tries, s.* FROM outbox o JOIN subs s ON s.id=o.sub_id ORDER BY o.id LIMIT ?").bind(MAX_SEND).all();
  const dels = [];
  await Promise.all(q.map(async r => {
    let st = 0; try { st = await sendPush(r, JSON.parse(r.payload), env); } catch { st = 0; }
    if (st >= 200 && st < 300) dels.push(env.DB.prepare("DELETE FROM outbox WHERE id=?").bind(r.oid));
    else if (st === 404 || st === 410) { dels.push(env.DB.prepare("DELETE FROM outbox WHERE sub_id=?").bind(r.id), env.DB.prepare("DELETE FROM subs WHERE id=?").bind(r.id)); }
    else if (r.tries >= 3) dels.push(env.DB.prepare("DELETE FROM outbox WHERE id=?").bind(r.oid));
    else dels.push(env.DB.prepare("UPDATE outbox SET tries=tries+1 WHERE id=?").bind(r.oid));
  }));
  for (let i = 0; i < dels.length; i += 40) await env.DB.batch(dels.slice(i, i + 40));
  return { subs: subs.length, queued: stmts.length, sent: q.length };
}

export default {
  fetch: (req, env) => handle(req, env).catch(e => json(req, { error: String(e && e.message || e) }, 500)),
  scheduled: (ev, env, ctx) => ctx.waitUntil(tick(env))
};
