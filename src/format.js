// Text formatting for SIsta: HTML escaping, a lightweight markdown subset, and
// on-demand KaTeX math rendering. Extracted from main.js. Pure text in / HTML
// out (plus a CDN script-load for KaTeX); no app state involved.

export function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

// ---------- lightweight markdown + math rendering ----------
// AI answers come back as markdown with LaTeX ($…$ / $$…$$). esc() alone
// would show the raw ** and $$; fmt() turns a safe subset of markdown into
// HTML and leaves math delimiters intact for KaTeX (typesetMath) to render.
export function fmtInline(s) {
  return s
    .replace(/`([^`]+)`/g, function (_, c) { return '<code class="md-code">' + c + '</code>'; })
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
export function fmt(src) {
  var text = String(src == null ? "" : src);
  // Stash math and fenced code so markdown/escaping can't mangle them.
  var math = [], code = [];
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, function (_, x) { return "M" + (math.push("$$" + x + "$$") - 1) + ""; });
  text = text.replace(/\$([^$\n]+?)\$/g, function (_, x) { return "M" + (math.push("$" + x + "$") - 1) + ""; });
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, function (_, lang, body) {
    return "C" + (code.push('<pre class="md-pre"><code>' + esc(body.replace(/\n$/, "")) + '</code></pre>') - 1) + "";
  });
  text = esc(text);
  var lines = text.split("\n"), html = "", i = 0;
  var isUl = function (l) { return /^\s*[-*]\s+/.test(l); };
  var isOl = function (l) { return /^\s*\d+\.\s+/.test(l); };
  while (i < lines.length) {
    var line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }
    var h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { html += '<div class="md-h md-h' + h[1].length + '">' + fmtInline(h[2]) + '</div>'; i++; continue; }
    if (/^M\d+\s*$/.test(line)) { html += '<div class="md-math">' + line.trim() + '</div>'; i++; continue; }
    if (isUl(line)) {
      html += '<ul class="md-list">';
      while (i < lines.length && isUl(lines[i])) { html += '<li>' + fmtInline(lines[i].replace(/^\s*[-*]\s+/, "")) + '</li>'; i++; }
      html += '</ul>'; continue;
    }
    if (isOl(line)) {
      html += '<ol class="md-list">';
      while (i < lines.length && isOl(lines[i])) { html += '<li>' + fmtInline(lines[i].replace(/^\s*\d+\.\s+/, "")) + '</li>'; i++; }
      html += '</ol>'; continue;
    }
    var para = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !isUl(lines[i]) && !isOl(lines[i]) && !/^#{1,6}\s+/.test(lines[i]) && !/^M\d+\s*$/.test(lines[i])) {
      para.push(fmtInline(lines[i])); i++;
    }
    html += '<p class="md-p">' + para.join("<br>") + "</p>";
  }
  return html
    .replace(/C(\d+)/g, function (_, n) { return code[+n]; })
    .replace(/M(\d+)/g, function (_, n) { return esc(math[+n]); });
}

// Loads KaTeX (CSS + core + auto-render) once, on demand, from a CDN.
var katexLoading = null;
function loadKatex() {
  if (window.renderMathInElement) return Promise.resolve(window.renderMathInElement);
  if (katexLoading) return katexLoading;
  var base = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/";
  var loadScript = function (src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script"); s.src = src;
      s.onload = resolve; s.onerror = function () { reject(new Error("katex load failed")); };
      document.head.appendChild(s);
    });
  };
  katexLoading = new Promise(function (resolve, reject) {
    if (!document.getElementById("katex-css")) {
      var link = document.createElement("link");
      link.id = "katex-css"; link.rel = "stylesheet"; link.href = base + "katex.min.css";
      document.head.appendChild(link);
    }
    loadScript(base + "katex.min.js")
      .then(function () { return loadScript(base + "contrib/auto-render.min.js"); })
      .then(function () { resolve(window.renderMathInElement); })
      .catch(reject);
  });
  return katexLoading;
}
// Renders any $…$ / $$…$$ math inside el once KaTeX is available.
export function typesetMath(el) {
  if (!el || !/\$/.test(el.textContent || "")) return;
  loadKatex().then(function (renderMathInElement) {
    try {
      renderMathInElement(el, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\[", right: "\\]", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false }
        ],
        throwOnError: false
      });
    } catch (e) { /* leave the raw text if typesetting fails */ }
  }).catch(function () { /* offline: raw $…$ stays visible */ });
}
