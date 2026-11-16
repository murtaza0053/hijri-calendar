import { dueEvents } from "./worker.js";
const s = { prefs: JSON.stringify({ miq: 1, t: { miq: "20:00" } }), lat: 22.7, lng: 75.8, tz: "Asia/Kolkata", lang: "en" };
const start = Date.UTC(2026, 10, 16) - 19800000; let n = 0;
for (let d = 0; d < 400; d++) { const ws = start + d * 864e5 + 20 * 3600e3; for (const e of dueEvents(s, ws)) { n++; if (/Washeq|Tonight/.test(e.title + e.body) && n < 400) console.log(new Date(ws + 19800000).toISOString().slice(0, 10), e.title, "|", e.body); } }
console.log("events", n);
