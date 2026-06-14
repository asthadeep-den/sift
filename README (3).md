# Sift — Tender Relevance Engine

Single-page app (`index.html`) + one serverless function (`api/search.js`) that runs
the live tender search. The function holds your Anthropic key, so the browser never
sees it. `mode: "auto"` means Sift detects where it's running and routes itself — you
normally change **one line at most**.

## Files
```
index.html        the app (Funder Feed · Triage Engine · Strainer)
api/search.js      serverless function — live web-search, returns tagged results
vercel.json        raises the function timeout to 30s (web search can be slow)
```

## Option A — everything on Vercel (simplest, recommended)
1. Put `index.html`, `api/search.js`, and `vercel.json` in one Git repo.
   (Keep `search.js` at the path **`api/search.js`** — the folder name matters.)
2. vercel.com → **New Project** → import the repo.
3. **Settings → Environment Variables** → add
   `ANTHROPIC_API_KEY = sk-ant-...`
4. **Deploy.** App lives at `https://your-app.vercel.app`. Leave `apiBase = ""`.
   Open the **Strainer** tab → pick a source → **Strain**. It works.

## Option B — page on GitHub Pages, API on Vercel
GitHub Pages is static (no functions), so the page calls your Vercel backend cross-origin.
`api/search.js` already sends open CORS headers, so this is allowed.

1. **Deploy the backend on Vercel** (you can deploy just `api/search.js` + `vercel.json`).
   Set `ANTHROPIC_API_KEY` as above. Note the URL, e.g. `https://sift-api.vercel.app`.
2. In `index.html`, set:
   ```js
   apiBase: "https://sift-api.vercel.app",
   ```
3. Push `index.html` to a GitHub repo → **Settings → Pages** → deploy from branch.
4. Open `https://USERNAME.github.io/REPO/` → **Strainer** now calls your Vercel backend.

## How auto-detection works
- `apiBase` set            → uses your backend (proxy).
- host is `*.vercel.app`    → uses `/api/search` on the same origin (proxy).
- host is `*.github.io`     → uses `apiBase` (proxy) — so set it in Option B.
- otherwise (Claude preview / local file) → falls back to the in-Claude path.

Custom domain on Vercel? Either set `apiBase` to it, or set `mode: "proxy"`.

## Notes
- Each **Strain** is one Claude API call with web search, billed to your Anthropic account.
- A strain can take ~10–25s; `vercel.json` lifts the timeout to 30s so it doesn't cut off.
- The **Triage Engine** and **Funder Feed** are fully client-side and need no backend —
  only the Strainer's live search uses `api/search.js`.
- Results are leads to verify on the source page; fit tags are provisional reads.
