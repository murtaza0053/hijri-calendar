import { dueEvents } from "./worker.js";
const s = { prefs: JSON.stringify({ sal: ["sih","faj","zaw","mag","nis"], rozi: 1, tasbeeh: 1, sadaqah: 1, kumail: 1 }), lat: 22.7196, lng: 75.8577, tz: "Asia/Kolkata", city: "Indore", lang: "en" };
// scan one Gregorian day (2026-11-16 IST) minute by minute
const start = Date.UTC(2026, 10, 15, 18, 30); let n = 0;
for (let i = 0; i < 1440; i++) { const ws = start + i * 60000; for (const e of dueEvents(s, ws)) { n++; console.log(new Date(ws + 19800000).toISOString().slice(11, 16), e.title, "|", e.body); } }
console.log("events:", n);
