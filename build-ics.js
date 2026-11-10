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
      const summary = (phase === "night" ? "🌙 Night: " : "") + titles.join(" · ");
      const desc = `${hdate}${phase === "night" ? " — night, after Maghrib" : ""}\n\n` +
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

build(2, "Miqaats (major)", "miqaats-major.ics");
build(3, "Miqaats + Urus (all)", "miqaats-all.ics");

// ---- Amal feed: Rozi ma Barakat (Hijri 2..7 every month) + daily tasbih of the weekday ----
const SITE = "https://murtaza0053.github.io/hijri-calendar/";
const ROZI = [[2, 36, "Surat Yaseen"], [3, 55, "Surat ar-Rahman"], [4, 56, "Surat al-Waqiah"], [5, 59, "Surat al-Hashr"], [6, 62, "Surat al-Jumuah"], [7, 72, "Surat al-Jinn"]];
const WEEK = [["SU", "Iyyaka Na'budu Wa Iyyaka Nasta'een", "You alone we worship and You alone we ask for help"],
  ["MO", "Ya Ghafoor, Ya Raheem", "O Most Forgiving, O Most Merciful"],
  ["TU", "SubhanAllahi wal Hamdu Lillah", "Glory be to Allah, and all praise is for Allah"],
  ["WE", "Ya Rahman, Ya Raheem", "O Most Gracious, O Most Merciful"],
  ["TH", "HasbunAllahu Wa Ni'mal Wakeel", "Allah is sufficient for us, and He is the best disposer of affairs"],
  ["FR", "Ya Zal Jalali Wal Ikram", "O Lord of Majesty and Honour"],
  ["SA", "Ya Hayyu, Ya Qayyum", "O Ever-Living, O Sustainer of all"]];
const ROZI_ALARM = "PT8H", TASBIH_ALARM = "PT7H";  // 8:00 AM and 7:00 AM on the day
const SADAQAH = [["SU", "Rice (Chawal)"], ["MO", "Rice (Chawal)"], ["TU", "Moong dal"], ["WE", "Tuwar dal"], ["TH", "Rice (Chawal)"], ["FR", "Wheat (Ghau)"], ["SA", "Rice (Chawal)"]];  // Sun … Sat
const SADAQAH_ALARM = "PT8H";
function feed(file, name, desc, fill) {
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//murtaza0053//hijri-calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${name}`, `X-WR-CALDESC:${desc}`, "X-WR-TIMEZONE:Asia/Kolkata", "REFRESH-INTERVAL;VALUE=DURATION:P7D", "X-PUBLISHED-TTL:P7D"];
  const ev = (uid, date, date2, summary, d, url, trigger, extra = []) => L.push("BEGIN:VEVENT", `UID:${uid}@murtaza0053.github.io`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${date}`, `DTEND;VALUE=DATE:${date2}`, ...extra, `SUMMARY:${esc(summary)}`, `DESCRIPTION:${esc(d)}`, `URL:${url}`,
    "TRANSP:TRANSPARENT", "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(summary)}`, `TRIGGER:${trigger}`, "END:VALARM", "END:VEVENT");
  const n = fill(ev);
  L.push("END:VCALENDAR");
  fs.writeFileSync(path.join(__dirname, "calendar", file), L.map(fold).join("\r\n") + "\r\n");
  console.log(`${file}: ${n} events`);
}
// Each reminder type is its own feed, so the app can offer "tick what you want" (amal.ics = Rozi amal only)
feed("amal.ics", "Rozi Amal", "Rozi ma Barakat amal: Hijri 2-7 every month", ev => {
  let n = 0;
  for (let y = Y0; y <= Y1; y++) for (let m = 0; m < 12; m++) for (const [d, s, name] of ROZI) {
    const a = H.toAJD(y, m, d), g = H.ajdToG(a), g2 = H.ajdToG(a + 1), url = `${SITE}dua/quran.html?s=${s}`;
    let desc = `${d} ${H.SHORT[m]} ${y}H — amal for barakat in rozi: recite ${name} once.\n${url}`;
    if (d === 7) desc += "\n\nToday is the 7th: recite salawat on the Panjatan Paak (AS) and Moulana Abbas Alamdaar (AS), as much as you can.";
    ev(`amal-${y}-${m + 1}-${d}`, ymd(g), ymd(g2), `📖 Hijri ${d}: ${name}`, desc, url, ROZI_ALARM); n++;
  }
  return n;
});
feed("tasbeeh.ics", "Daily Tasbeeh", "The daily tasbih of the weekday (100x)", ev => {
  WEEK.forEach(([by, tas, mean], i) => {   // weekly recurring (first occurrence: first such weekday on/after 2026-11-08, a Sunday)
    const a = H.gToAJD(2026, 10, 8) + i, g = H.ajdToG(a), g2 = H.ajdToG(a + 1), url = `${SITE}dua/tasbeeh.html?m=week`;
    ev(`tasbih-${by}`, ymd(g), ymd(g2), `📿 Today's tasbeeh: ${tas} (100×)`, `${tas} — 100 times\n${mean}\n${url}`, url, TASBIH_ALARM, [`RRULE:FREQ=WEEKLY;BYDAY=${by}`]);
  });
  return 7;
});
feed("sadaqah.ics", "Sadaqah", "Daily sadaqah (Shia Dawoodi Bohra weekday items)", ev => {
  SADAQAH.forEach(([by, item], i) => {
    const a = H.gToAJD(2026, 10, 8) + i, g = H.ajdToG(a), g2 = H.ajdToG(a + 1), url = SITE;
    ev(`sadaqah-${by}`, ymd(g), ymd(g2), `🤲 Today's sadaqah: ${item}`, `Give sadaqah today: ${item}.\n${url}`, url, SADAQAH_ALARM, [`RRULE:FREQ=WEEKLY;BYDAY=${by}`]);
  });
  return 7;
});
