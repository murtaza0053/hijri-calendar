/* Tasbeeh feedback: window.haptic("tap" | "done"). Strength comes from the Settings choice (localStorage "hapticMode":
   off | light | medium | strong); "hapticSound" = true adds a soft tick sound (works on every phone).
   Android: navigator.vibrate. iPhone has no Vibration API, so (iOS 17.4+) a hidden <input switch> is toggled from a
   real touch/click handler, which gives a system haptic tick (needs Settings > Sounds & Haptics > System Haptics on). */
(function () {
  const MODES = ["off", "light", "medium", "strong"];
  const PAT = { light: { tap: 10, done: [40, 30, 40] }, medium: { tap: 22, done: [60, 40, 60] }, strong: { tap: 45, done: [90, 50, 90, 50, 90] } };
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
  const mode = () => { const m = get("hapticMode", "medium"); return MODES.includes(m) ? m : "medium"; };
  let lab = null;
  function tick() {   // one iOS haptic tick (same approach as the ios-haptics library)
    try {
      if (!lab) {
        lab = document.createElement("label"); lab.setAttribute("aria-hidden", "true"); lab.style.display = "none";
        const i = document.createElement("input"); i.type = "checkbox"; i.setAttribute("switch", ""); lab.appendChild(i);
        (document.head || document.documentElement).appendChild(lab);
      }
      lab.click();
    } catch {}
  }
  let ac = null;
  function beep(done) {   // soft tick sound
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume();
      const t0 = ac.currentTime, n = done ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = done ? 880 : 1300;
        g.gain.setValueAtTime(0.0001, t0 + k * .09); g.gain.exponentialRampToValueAtTime(0.25, t0 + k * .09 + .004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + k * .09 + .05);
        o.connect(g); g.connect(ac.destination); o.start(t0 + k * .09); o.stop(t0 + k * .09 + .06);
      }
    } catch {}
  }
  function haptic(kind) {
    const done = kind === "done", m = mode();
    if (get("hapticSound", false)) beep(done);
    if (m === "off") return;
    if (navigator.vibrate) { try { navigator.vibrate(PAT[m][done ? "done" : "tap"]); } catch {} return; }
    const n = done ? { light: 2, medium: 3, strong: 4 }[m] : (m === "strong" ? 2 : 1);   // iPhone: strength = number of ticks
    for (let k = 0; k < n; k++) k ? setTimeout(tick, k * (done ? 110 : 55)) : tick();
  }
  haptic.mode = mode;
  haptic.set = m => { try { localStorage.setItem("hapticMode", JSON.stringify(m)); } catch {} };
  haptic.sound = () => !!get("hapticSound", false);
  haptic.setSound = v => { try { localStorage.setItem("hapticSound", JSON.stringify(!!v)); } catch {} };
  haptic.api = () => !!navigator.vibrate;
  window.haptic = haptic;
})();
