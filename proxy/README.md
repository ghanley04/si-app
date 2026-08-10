# SISTA Anthropic proxy (Cloudflare Worker)

This is a tiny server that holds **one shared Anthropic API key** so the
published SISTA site can give every visitor real Claude answers without ever
exposing the key in the browser.

The browser calls this worker → the worker adds the secret key → forwards to
Anthropic → passes the answer back.

## One-time setup (all in the Cloudflare web dashboard)

1. **Make a free Cloudflare account** at https://dash.cloudflare.com/sign-up
   (no credit card needed for the Workers free tier).

2. In the left sidebar go to **Workers & Pages → Create → Create Worker**.
   Give it a name like `sista-proxy` and click **Deploy** (it deploys a
   placeholder "Hello World" first — that's fine).

3. Click **Edit code**. Delete everything in the editor, paste the entire
   contents of [`worker.js`](worker.js) from this folder, then click
   **Deploy**.

4. Add your key as a secret so it's never in the code:
   - Go to the worker's **Settings → Variables and Secrets**.
   - Under **Secrets**, click **Add**.
   - Name: `ANTHROPIC_API_KEY`   Value: *(paste your Anthropic key)*
   - Click **Deploy** / **Save**.

5. Copy the worker's URL. It looks like:
   `https://sista-proxy.YOUR-SUBDOMAIN.workers.dev`

6. Open [`../index.html`](../index.html), find the line near the top of the
   script that says `var PROXY_URL = ...` and paste your worker URL there.
   Commit and push — GitHub Pages redeploys automatically.

## Protecting against abuse (do this too)

The worker only accepts requests from the origins listed in `ALLOWED_ORIGINS`
at the top of `worker.js` (your site + local dev). That blocks other websites,
but a determined person could still script calls to your worker. The real
safety net:

- **Set a monthly spend limit** at https://console.anthropic.com → Billing →
  Limits. This caps the worst case no matter what.
- (Optional) In Cloudflare, add a **Rate limiting rule** on the worker route
  to throttle bursts.

## Changing your site's domain later

If your site moves, update the `ALLOWED_ORIGINS` list at the top of
`worker.js` and re-deploy the worker (paste the new code, click Deploy).
