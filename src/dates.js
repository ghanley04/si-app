// Date helpers for SIsta: YYYY-MM-DD parsing/formatting and relative-day
// phrasing ("in 3 days", "today"). Extracted from main.js. Pure functions.

export var MS_DAY = 86400000; // ms in a day

export function ymd(d) {
  return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
}
export function parseYMD(s) {
  var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s || ""));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
export function todayMid() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
export function fmtMD(s) { var d = parseYMD(s); return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""; }
export function fmtRange(a, b) {
  var da = parseYMD(a), db = parseYMD(b);
  if (da && db) return fmtMD(a) + " – " + fmtMD(b);
  return fmtMD(a) || fmtMD(b) || "";
}
// Plain-English "in 3 days" / "today" / "2 days ago" for a due date.
export function relDays(s) {
  var d = parseYMD(s); if (!d) return "";
  var diff = Math.round((d.getTime() - todayMid().getTime()) / MS_DAY);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  return diff > 0 ? ("in " + diff + " days") : (Math.abs(diff) + " days ago");
}
