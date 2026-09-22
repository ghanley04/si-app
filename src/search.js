// Lightweight keyword search / RAG helpers for SIsta. Extracted from main.js.
// Tokenizes text, splits course materials into chunks, and ranks chunks against
// a query so the AI can be grounded in the most relevant snippets. Pure.

var STOPWORDS = new Set(("the a an and or but of to in on at for with without is are was were be been being " +
  "this that these those it its as by from into about over under how what why when where which who whom whose " +
  "do does did can could should would will shall may might must not no yes if then than so such your you i we they " +
  "he she them his her their our us me my mine ours").split(" "));

export function tokenize(s) {
  return (s.toLowerCase().match(/[a-z0-9']+/g) || []).filter(function (w) { return w.length > 2 && !STOPWORDS.has(w); });
}
export function splitChunks(text) {
  return text.split(/(?<=[.!?])\s+|\n+/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 25; });
}
export function allChunks(course) {
  var out = [];
  course.materials.forEach(function (m, mi) {
    splitChunks(m.text).forEach(function (c) { out.push({ text: c, filename: m.filename, materialIndex: mi }); });
  });
  return out;
}
export function rank(chunks, query, limit) {
  var q = tokenize(query); if (q.length === 0) return [];
  var qset = new Set(q);
  return chunks.map(function (c) {
    var toks = tokenize(c.text), score = 0;
    toks.forEach(function (t) { if (qset.has(t)) score++; });
    return { chunk: c, score: score };
  }).filter(function (r) { return r.score > 0; })
    .sort(function (a, b) { return b.score - a.score; }).slice(0, limit || 3);
}
