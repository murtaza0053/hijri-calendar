/* Misri (Fatimi) tabular Hijri calendar — shared by the app and build-ics.js */
"use strict";
globalThis.H = (() => {
  const KABISA = [2,5,8,10,13,16,19,21,24,27,29];
  const MONTH_CUM = [30,59,89,118,148,177,207,236,266,295,325];
  const YEAR_CUM = [354,708,1063,1417,1771,2126,2480,2834,3189,3543,3898,4252,4606,4961,5315,5669,6024,6378,6732,7087,7441,7796,8150,8504,8859,9213,9567,9922,10276,10631];
  const EPOCH = 1948083.5;
  const NAMES = ["Moharram al-Haraam","Safar al-Muzaffar","Rabi al-Awwal","Rabi al-Aakhar","Jumada al-Ula","Jumada al-Ukhra","Rajab al-Asab","Shabaan al-Karim","Ramadaan al-Moazzam","Shawwal al-Mukarram","Zilqadah al-Haraam","Zilhaj al-Haraam"];
  const SHORT = ["Moharram","Safar","Rabi I","Rabi II","Jumada I","Jumada II","Rajab","Shabaan","Ramadaan","Shawwal","Zilqadah","Zilhaj"];
  const AR = ["محرم الحرام","صفر المظفر","ربيع الأول","ربيع الآخر","جمادى الأولى","جمادى الأخرى","رجب الأصب","شعبان الكريم","رمضان المعظم","شوال المكرم","ذو القعدة الحرام","ذو الحجة الحرام"];
  const isKabisa = y => KABISA.includes(((y % 30) + 30) % 30);
  const daysInMonth = (y, m) => (m === 11 && isKabisa(y)) || m % 2 === 0 ? 30 : 29;
  const toAJD = (y, m, d) => {
    const c = Math.floor(y / 30);
    let a = EPOCH + 10631 * c + (m === 0 ? d : MONTH_CUM[m - 1] + d);
    if (y % 30 !== 0) a += YEAR_CUM[y - 30 * c - 1];
    return a;
  };
  const fromAJD = ajd => {
    let c = Math.floor(ajd - EPOCH) - 1; // 0-based day index
    const u = Math.floor(c / 10631);
    c -= 10631 * u;
    let s = 0; while (c >= YEAR_CUM[s]) s++;
    const y = 30 * u + s;
    if (s > 0) c -= YEAR_CUM[s - 1];
    let m = 0; while (m < 11 && c >= MONTH_CUM[m]) m++;
    return { y, m, d: c - (m > 0 ? MONTH_CUM[m - 1] : 0) + 1 };
  };
  // Gregorian (local calendar date) <-> astronomical JD at midnight
  const gToAJD = (Y, M, D) => Date.UTC(Y, M, D) / 864e5 + 2440587.5;
  const ajdToG = ajd => { const t = new Date(Math.round((ajd - 2440587.5) * 864e5)); return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() }; };
  const dow = ajd => Math.floor(ajd + 1.5) % 7; // 0 = Sunday
  return { NAMES, SHORT, AR, isKabisa, daysInMonth, toAJD, fromAJD, gToAJD, ajdToG, dow };
})();
