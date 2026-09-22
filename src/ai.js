// Claude API client for SIsta.
// Extracted from main.js. Holds the Claude config and every low-level call to
// the Messages API. The API key is NEVER stored here — see the config notes
// below. Nothing in this module touches app state (`state`/`view`) or the DOM,
// so it is safe to import from anywhere.

// ============================================================
// CLAUDE CONFIG  —  the API key is NEVER stored in this file.
// ============================================================
// On the published site, requests go through a Cloudflare Worker proxy
// (see /proxy) that holds ONE shared Anthropic key server-side. The key
// never reaches the browser. Set PROXY_URL to your worker's URL, e.g.
//   var PROXY_URL = "https://sista-proxy.your-name.workers.dev";
//
// For LOCAL development you can instead leave PROXY_URL empty and put a
// key in the git-ignored .env file (CLAUDE_API_KEY=…); serve.command
// serves it and loadEnvKey() reads it into ENV_KEY. Nothing is hardcoded
// here either way, so no key can ever be committed or pushed to GitHub.
var PROXY_URL = "https://sista-proxy.purduehanley.workers.dev";  // Cloudflare Worker proxy (holds the shared key)

var ENV_KEY = "";
function getKey() { return ENV_KEY.trim(); }
export async function loadEnvKey() {
  if (PROXY_URL) return;  // proxy mode — no local key needed
  try {
    var res = await fetch(".env", { cache: "no-store" });
    if (!res.ok) return;
    var m = (await res.text()).match(/^\s*CLAUDE_API_KEY\s*=\s*(.+?)\s*$/m);
    if (m) ENV_KEY = m[1].replace(/^["']|["']$/g, "");
  } catch (e) { /* no .env reachable — falls back to offline mode */ }
}

var CLAUDE = {
  model: "claude-opus-4-8",
  maxTokens: 2048,
  // Hard ceiling on any single AI call so a hung request can't wedge the UI.
  timeoutMs: 90000
};

// Ready when a proxy is configured (shared key, works for everyone) OR a
// local .env key is present (local dev). Otherwise the app runs offline.
export function claudeReady() { return PROXY_URL.length > 0 || getKey().length > 0; }

// Calls the Claude Messages API directly from the browser.
// opts: { system, user, content, schema, maxTokens }
//   user    — a plain string prompt, OR
//   content — an array of content blocks (text, document, image, …)
//   schema  — structured JSON output; maxTokens — override the default cap.
export async function callClaude(opts) {
  var body = {
    model: CLAUDE.model,
    max_tokens: opts.maxTokens || CLAUDE.maxTokens,
    messages: [{ role: "user", content: opts.content || opts.user }]
  };
  if (opts.system) body.system = opts.system;
  if (opts.schema) body.output_config = { format: { type: "json_schema", schema: opts.schema } };
  if (opts.tools) body.tools = opts.tools;

  // Proxy mode: call the Cloudflare Worker, which adds the shared key
  // server-side. Direct mode (local dev): call Anthropic with the .env key.
  // Guard every call with a timeout: a hung proxy/network fetch would otherwise
  // never resolve, leaving a "Generating…" button stuck disabled forever (the
  // study-plan-tab-freezes bug). AbortController makes the call always settle.
  var ctrl = new AbortController();
  var timedOut = false;
  var timer = setTimeout(function () { timedOut = true; ctrl.abort(); }, CLAUDE.timeoutMs || 90000);
  var res;
  try {
    if (PROXY_URL) {
      res = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal
      });
    } else {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": getKey(),
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify(body),
        signal: ctrl.signal
      });
    }
  } catch (e) {
    if (timedOut || (e && e.name === "AbortError")) throw new Error("Timed out — please try again.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error("Claude API " + res.status + ": " + (await res.text()));
  var data = await res.json();
  return (data.content || [])
    .filter(function (b) { return b.type === "text"; })
    .map(function (b) { return b.text; })
    .join("");
}

// Anthropic's hosted web-search tool. Added to the topic/plan calls so Claude
// can supplement a thin or missing syllabus with the course's real topics
// found online (its own syllabus/schedule pages, department listings, etc.).
export function webSearchTools(maxUses) {
  return [{ type: "web_search_20250305", name: "web_search", max_uses: maxUses || 3 }];
}

// Parse a JSON object out of a model reply. With structured output the whole
// reply is already JSON; but when web search is on, the reply can carry a
// little stray prose, so fall back to the first balanced {…} block.
export function parseJsonLoose(text) {
  var s = String(text == null ? "" : text).trim();
  try { return JSON.parse(s); } catch (e) { /* fall through */ }
  var start = s.indexOf("{");
  if (start < 0) return null;
  var depth = 0, inStr = false, escaped = false;
  for (var i = start; i < s.length; i++) {
    var ch = s[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) {
      try { return JSON.parse(s.slice(start, i + 1)); } catch (e2) { return null; }
    }
  }
  return null;
}
