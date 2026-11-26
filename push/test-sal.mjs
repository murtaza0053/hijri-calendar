// Checks the mumineen.org API path of the push worker (needs internet): loads times through an in-memory fake D1, then runs dueEvents.
import { dueEvents, tick } from "./worker.js";
const rows = new Map(), miqRows = new Map();   // "loc|day" → data
const env = { DB: { prepare(sql) { return { sql, a: [], bind(...a) { this.a = a; return this; },
  async all() { if (/FROM miqapi/.test(sql)) return { results: [...miqRows].map(([ym, v]) => ({ ym, data: v.data, at: v.at })) }; if (/FROM saltimes/.test(sql)) return { results: [...rows].filter(([k]) => k.split("|")[1] >= this.a[0]).map(([k, v]) => ({ loc: k.split("|")[0], day: k.split("|")[1], data: v })) }; return { results: [] }; },
  async run() { if (/INSERT OR REPLACE INTO miqapi/.test(sql)) miqRows.set(this.a[0], { data: this.a[1], at: this.a[2] }); }, _ins() { if (/INSERT OR REPLACE INTO saltimes/.test(sql)) rows.set(this.a[0] + "|" + this.a[1], this.a[2]); } }; }, async batch(st) { st.forEach(s => s._ins && s._ins()); } } };
const s = { prefs: JSON.stringify({ sal: ["sih", "faj", "fe", "zaw", "ze", "ae", "mag", "nis"], lead: 0 }), lat: 22.7196, lng: 75.8577, tz: "Asia/Kolkata", city: "Indore", lang: "en" };
// import the (unexported) loader through tick's module by calling tick with a subs list stub
const ws = Date.UTC(2026, 10, 26, 0, 0);   // 2026-11-26 05:30 IST
const mod = await import("./worker.js");
const envTick = { DB: { prepare(sql) { const p = env.DB.prepare(sql); if (/FROM subs/.test(sql)) p.all = async () => ({ results: [s] }); return p; }, batch: env.DB.batch } };
try { await mod.tick(envTick, ws); } catch (e) { /* outbox / push parts are not faked */ }
console.log("rows stored:", rows.size);
const cache = {}; for (const [k, v] of rows) { const [loc, day] = k.split("|"); (cache[loc] = cache[loc] || {})[day] = JSON.parse(v); }
const got = []; for (let i = 0; i < 1440; i++) { const t = Date.UTC(2026, 10, 25, 18, 30) + i * 60000; for (const e of dueEvents(s, t, cache)) got.push(new Date(t + 19800000).toISOString().slice(11, 16) + " " + e.title); }
console.log(got.join("\n"));
const want = ["05:31 🕌 Sihori — Indore", "06:10 🕌 Fajr — Indore", "06:46 🕌 Fajr end — Indore", "12:14 🕌 Zawaal — Indore", "14:01 🕌 Zohr end — Indore", "15:50 🕌 Asr end — Indore", "17:41 🕌 Maghrib — Indore", "00:14 🕌 Nisful Layl — Indore"];
console.log(want.every(w => got.includes(w)) ? "PASS" : "FAIL");

// miqaat alerts (needs the same fake D1): Washeq heads-up + tomorrow/tonight miqaats from the API
const miq = {}; for (const [k, v] of miqRows) miq[k] = JSON.parse(v.data);
const sm = { ...s, prefs: JSON.stringify({ miq: 1, t: { miq: "20:00" } }) }; let mq = 0;
for (let d = 0; d < 60; d++) { const w = Date.UTC(2026, 10, 26) - 19800000 + d * 864e5 + 20 * 3600e3; for (const e of dueEvents(sm, w, cache, miq)) { mq++; if (mq <= 6) console.log(new Date(w + 19800000).toISOString().slice(0, 10), e.title, "|", e.body); } }
console.log("miqaat months loaded:", miqRows.size, "alerts in 60 days:", mq, mq > 0 ? "PASS" : "FAIL");
