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
