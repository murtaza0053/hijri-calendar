// Mumin — Salaat widget loader for the iPhone "Scriptable" app. Paste this ONCE; it always runs the newest widget script from the site
// (kept offline too), so design / fixes arrive without copying again. Widget Parameter (optional):  City,latitude,longitude[,altitude]
const fm = FileManager.local(), F = fm.joinPath(fm.documentsDirectory(), "mumin-widget-code.js");
let code = null;
try { code = await new Request("https://murtaza0053.github.io/hijri-calendar/widgets/salaat-widget.js?t=" + Date.now()).loadString(); if (code && code.includes("Script.complete")) fm.writeString(F, code); else code = null; } catch (e) { code = null; }
if (!code && fm.fileExists(F)) code = fm.readString(F);
if (!code) { const w = new ListWidget(); const t = w.addText("Mumin — couldn't load the widget script.\nOpen it once with internet."); t.font = Font.systemFont(12); if (config.runsInWidget) Script.setWidget(w); else await w.presentMedium(); Script.complete(); }
else await new (Object.getPrototypeOf(async function () {}).constructor)(code)();
