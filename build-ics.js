#!/usr/bin/env node
// Generates iPhone-subscribable .ics feeds of miqaats (with alarms) into ./calendar/
// Usage: node build-ics.js            (window: current Hijri year −1 … +4)
"use strict";
const fs = require("fs");
const path = require("path");
require("./hijri.js");
const H = globalThis.H;
const MIQ = JSON.parse(fs.readFileSync(path.join(__dirname, "miqaats.json"), "utf8"));

const now = new Date();
const cur = H.fromAJD(H.gToAJD(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).y;
const Y0 = cur - 1, Y1 = cur + 4;

const pad = n => String(n).padStart(2, "0");
const ymd = g => `${g.y}${pad(g.m + 1)}${pad(g.d)}`;
const esc = s => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const stamp = "20260101T000000Z"; // fixed so feeds only change when content changes

// fold to 75 octets (UTF-8 safe)
function fold(line) {
  const out = []; let cur = ""; let bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ""; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

function build(maxPriority, name, file) {
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//murtaza0053//hijri-calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${name}`, "X-WR-CALDESC:Misri Hijri calendar miqaats (Dawoodi Bohra)", "X-WR-TIMEZONE:Asia/Kolkata",
    "REFRESH-INTERVAL;VALUE=DURATION:P7D", "X-PUBLISHED-TTL:P7D"];
  let n = 0;
  for (let y = Y0; y <= Y1; y++) for (let m = 0; m < 12; m++) for (let d = 1; d <= H.daysInMonth(y, m); d++) {
    const e = MIQ.find(x => x.month === m && x.date === d);
    if (!e) continue;
    const list = e.miqaats.filter(q => q.priority <= maxPriority && (!q.year || q.year <= y));
    for (const phase of ["day", "night"]) {
      const qs = list.filter(q => q.phase === phase);
      if (!qs.length) continue;
      const a = H.toAJD(y, m, d), g = H.ajdToG(a), g2 = H.ajdToG(a + 1);
      const hdate = `${d} ${H.SHORT[m]} ${y}H`;
      const titles = qs.map(q => q.title);
      const summary = (phase === "night" ? "🌙 Raat: " : "") + titles.join(" · ");
      const desc = `${hdate}${phase === "night" ? " — Maghrib ke baad (raat)" : ""}\n\n` +
        qs.map(q => "• " + q.title + (q.description ? ` — ${q.description}` : "")).join("\n");
      // day miqaat → remind 9 PM the evening before; night miqaat → remind 5 PM same day
      const trigger = phase === "night" ? "PT17H" : "-PT3H";
      L.push("BEGIN:VEVENT", `UID:${y}-${m + 1}-${d}-${phase}-p${maxPriority}@murtaza0053.github.io`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${ymd(g)}`, `DTEND;VALUE=DATE:${ymd(g2)}`, `SUMMARY:${esc(summary)}`, `DESCRIPTION:${esc(desc)}`,
        "TRANSP:TRANSPARENT",
        "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(summary)}`, `TRIGGER:${trigger}`, "END:VALARM",
        "END:VEVENT");
      n++;
    }
  }
  L.push("END:VCALENDAR");
  fs.mkdirSync(path.join(__dirname, "calendar"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "calendar", file), L.map(fold).join("\r\n") + "\r\n");
  console.log(`${file}: ${n} events, Hijri ${Y0}–${Y1}`);
}

build(2, "Miqaats (badi)", "miqaats-major.ics");
build(3, "Miqaats + Urus (sab)", "miqaats-all.ics");

// ---- Amal feed: Rozi ma Barakat (Hijri 2..7 every month) + daily tasbih of the weekday ----
const SITE = "https://murtaza0053.github.io/hijri-calendar/";
const ROZI = [[2, 36, "Surat Yaseen"], [3, 55, "Surat ar-Rahman"], [4, 56, "Surat al-Waqiah"], [5, 59, "Surat al-Hashr"], [6, 62, "Surat al-Jumuah"], [7, 72, "Surat al-Jinn"]];
const WEEK = [["SU", "Iyyaka Na'budu Wa Iyyaka Nasta'een", "Sirf Teri ibadat karte hain aur Tujh se madad maangte hain"],
  ["MO", "Ya Ghafoor, Ya Raheem", "Ae maaf karne wale, ae rehmat karne wale"],
  ["TU", "SubhanAllahi wal Hamdu Lillah", "Allah paak hai aur saari tareef Allah ke liye hai"],
  ["WE", "Ya Rahman, Ya Raheem", "Ae bohot meherban, ae rehmat karne wale"],
  ["TH", "HasbunAllahu Wa Ni'mal Wakeel", "Allah kaafi hai, woh behtareen kaam banane wala hai"],
  ["FR", "Ya Zal Jalali Wal Ikram", "Ae jalal aur izzat wale"],
  ["SA", "Ya Hayyu, Ya Qayyum", "Ae hamesha zinda aur sab ko sambhalne wale"]];
const ROZI_ALARM = "PT8H", TASBIH_ALARM = "PT7H";  // 8:00 AM and 7:00 AM on the day
function buildAmal(file) {
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//murtaza0053//hijri-calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Amal + Tasbeeh", "X-WR-CALDESC:Rozi ma Barakat amal (Hijri 2-7) and the daily tasbih", "X-WR-TIMEZONE:Asia/Kolkata",
    "REFRESH-INTERVAL;VALUE=DURATION:P7D", "X-PUBLISHED-TTL:P7D"];
  const ev = (uid, date, date2, summary, desc, url, trigger, extra = []) => L.push("BEGIN:VEVENT", `UID:${uid}@murtaza0053.github.io`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${date}`, `DTEND;VALUE=DATE:${date2}`, ...extra, `SUMMARY:${esc(summary)}`, `DESCRIPTION:${esc(desc)}`, `URL:${url}`,
    "TRANSP:TRANSPARENT", "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(summary)}`, `TRIGGER:${trigger}`, "END:VALARM", "END:VEVENT");
  let n = 0;
  for (let y = Y0; y <= Y1; y++) for (let m = 0; m < 12; m++) for (const [d, s, name] of ROZI) {
    const a = H.toAJD(y, m, d), g = H.ajdToG(a), g2 = H.ajdToG(a + 1), url = `${SITE}dua/quran.html?s=${s}`;
    let desc = `${d} ${H.SHORT[m]} ${y}H — Rozi ma Barakat vaaste amal: ${name} 1 vaar padho.\n${url}`;
    if (d === 7) desc += "\n\nAaj 7mi tarikh: Panjatan Paak (AS) aur Moulana Abbas Alamdaar (AS) par salawat — jetlu imkaan thai.";
    ev(`amal-${y}-${m + 1}-${d}`, ymd(g), ymd(g2), `📖 ${d} tarikh: ${name}`, desc, url, ROZI_ALARM); n++;
  }
  // weekly recurring tasbih (first occurrence: the first such weekday on/after 2026-11-08, a Sunday)
  WEEK.forEach(([by, tas, mean], i) => {
    const a = H.gToAJD(2026, 10, 8) + i, g = H.ajdToG(a), g2 = H.ajdToG(a + 1), url = `${SITE}dua/tasbeeh.html?m=week`;
    ev(`tasbih-${by}`, ymd(g), ymd(g2), `📿 Aaj ni tasbeeh: ${tas} (100×)`, `${tas} — 100 vaar\n${mean}\n${url}`, url, TASBIH_ALARM, [`RRULE:FREQ=WEEKLY;BYDAY=${by}`]); n++;
  });
  L.push("END:VCALENDAR");
  fs.writeFileSync(path.join(__dirname, "calendar", file), L.map(fold).join("\r\n") + "\r\n");
  console.log(`${file}: ${n} events (Rozi Hijri ${Y0}–${Y1} + 7 weekly tasbih)`);
}
buildAmal("amal.ics");
