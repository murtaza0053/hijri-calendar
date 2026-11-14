/* Tasbeeh vibration: window.haptic("tap" | "done"). Strength comes from the Settings choice (localStorage "hapticMode":
   off | light | medium | strong). Android uses navigator.vibrate; iPhone (no Vibration API) uses the iOS 17.4+
   <input switch> haptic. */
(function () {
  const MODES = ["off", "light", "medium", "strong"];
  const PAT = {
    light:  { tap: 10, done: [40, 30, 40] },
    medium: { tap: 22, done: [60, 40, 60] },
    strong: { tap: 45, done: [90, 50, 90, 50, 90] }
  };
  function mode() { try { const m = JSON.parse(localStorage.getItem("hapticMode")); return MODES.includes(m) ? m : "medium"; } catch { return "medium"; } }
  let lab = null;
  function tick() {   // one iOS haptic tick
    try {
      if (!lab) {
        lab = document.createElement("label"); lab.setAttribute("aria-hidden", "true");
        lab.style.cssText = "position:fixed;left:-100px;top:-100px;width:1px;height:1px;opacity:0;pointer-events:none";
        const i = document.createElement("input"); i.type = "checkbox"; i.setAttribute("switch", ""); lab.appendChild(i); document.body.appendChild(lab);
      }
      lab.click();
    } catch {}
  }
  function haptic(kind) {
    const m = mode(); if (m === "off") return;
    const p = PAT[m][kind === "done" ? "done" : "tap"];
    if (navigator.vibrate) { try { navigator.vibrate(p); } catch {} return; }
    // iPhone: no strength control, so light = 1 tick, medium = 1 tick, strong = 2 ticks; completion = 2 / 3 / 4 ticks
    const n = kind === "done" ? { light: 2, medium: 3, strong: 4 }[m] : (m === "strong" ? 2 : 1);
    for (let k = 0; k < n; k++) setTimeout(tick, k * (kind === "done" ? 110 : 55));
  }
  haptic.mode = mode;
  haptic.set = m => { try { localStorage.setItem("hapticMode", JSON.stringify(m)); } catch {} };
  window.haptic = haptic;
})();
