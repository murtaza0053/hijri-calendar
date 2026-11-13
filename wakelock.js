// Keep the screen on while a reading / dua page is open (Screen Wake Lock API). Can be switched off in Settings (localStorage "wake").
(() => {
  let lock = null;
  const on = () => { try { return JSON.parse(localStorage.getItem("wake")) !== false; } catch { return true; } };
  async function get() {
    if (lock || !on() || !("wakeLock" in navigator) || document.visibilityState !== "visible") return;
    try { lock = await navigator.wakeLock.request("screen"); lock.addEventListener("release", () => { lock = null; }); } catch { lock = null; }
  }
  const drop = () => { try { lock && lock.release(); } catch {} lock = null; };
  // the lock is released whenever the page is hidden, so take it again when the user comes back
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" ? get() : drop());
  // some browsers only allow it after a touch: try again on the first interaction
  ["click", "touchend", "keydown"].forEach(e => addEventListener(e, get, { passive: true }));
  addEventListener("storage", () => on() ? get() : drop());
  get();
})();
