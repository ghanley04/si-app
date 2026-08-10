// ============================================================
// SISTA — Anthropic API proxy (Cloudflare Worker)
// ============================================================
// Holds ONE shared Anthropic key server-side so the published, static
// SISTA site can give every visitor real Claude answers WITHOUT ever
// putting the key in the browser.
//
// The browser calls THIS worker; the worker adds the key and forwards
// the request to Anthropic. The key lives only in the Worker secret
// ANTHROPIC_API_KEY — never in git, never in the page.
//
// Deploy:  see proxy/README.md in this repo.
// ============================================================

// Only these origins may use the proxy. This stops other websites from
// calling your worker from a browser. (It does NOT stop a determined
// person with a script — for that, rely on an Anthropic spend limit.)
const ALLOWED_ORIGINS = [
  "https://gillianhanley.us",
  "https://www.gillianhanley.us",
  "http://localhost:8138",   // local dev (serve.command)
  "http://127.0.0.1:8138",
];

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = ALLOWED_ORIGINS.includes(origin);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin, allowed) });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, origin, allowed);
    }
    if (!allowed) {
      return json({ error: "Origin not allowed" }, 403, origin, allowed);
    }
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: "Proxy missing ANTHROPIC_API_KEY secret" }, 500, origin, allowed);
    }

    let body;
    try {
      body = await request.text();
    } catch (e) {
      return json({ error: "Bad request body" }, 400, origin, allowed);
    }

    let upstream;
    try {
      upstream = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body,
      });
    } catch (e) {
      return json({ error: "Upstream request failed" }, 502, origin, allowed);
    }

    // Pass Anthropic's response straight back to the browser, with CORS.
    const headers = cors(origin, allowed);
    headers.set("content-type", upstream.headers.get("content-type") || "application/json");
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};

function cors(origin, allowed) {
  const h = new Headers();
  if (allowed) h.set("Access-Control-Allow-Origin", origin);
  h.set("Vary", "Origin");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "content-type");
  h.set("Access-Control-Max-Age", "86400");
  return h;
}

function json(obj, status, origin, allowed) {
  const headers = cors(origin, allowed);
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(obj), { status, headers });
}
