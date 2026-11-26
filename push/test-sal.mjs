// Checks the mumineen.org API path of the push worker (needs internet): loads times through an in-memory fake D1, then runs dueEvents.
import { dueEvents, tick } from "./worker.js";
const rows = new Map();   // "loc|day" → data
const env = { DB: { prepare(sql) { return { sql, a: [], bind(...a) { this.a = a; return this; },
  async all() { if (/FROM saltimes/.test(sql)) return { results: [...rows].filter(([k]) => k.split("|")[1] >= this.a[0]).map(([k, v]) => ({ loc: k.split("|")[0], day: k.split("|")[1], data: v })) }; return { results: [] }; },
  async run() {}, _ins() { if (/INSERT OR REPLACE INTO saltimes/.test(sql)) rows.set(this.a[0] + "|" + this.a[1], this.a[2]); } }; }, async batch(st) { st.forEach(s => s._ins && s._ins()); } } };
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
