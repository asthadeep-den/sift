// api/search.js  —  Sift "Live Wire" backend (Vercel serverless function)
// ---------------------------------------------------------------------------
// Deploy:
//   1. Put this file at  /api/search.js  in your Vercel project (next to sift.html).
//   2. In Vercel → Project → Settings → Environment Variables, add:
//        ANTHROPIC_API_KEY = sk-ant-...your key...
//   3. In sift.html set:  LIVE.mode = "proxy"   (proxyUrl already points to /api/search)
//   4. Redeploy. The browser now calls THIS function; your key never leaves the server.
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  // CORS (safe to keep; same-origin requests work without it)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const body = typeof req.body === "string" ? safeJSON(req.body) : req.body || {};
  const query = (body.query || "").toString().trim();
  if (!query) return res.status(400).json({ error: "Missing 'query'." });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured." });

  const prompt =
    "You are a tender-sourcing analyst for an Indian skill-development (TVET) implementation firm. " +
    "The firm bids as a company (not an individual), offers trainers, training infrastructure and " +
    "end-to-end implementation, and is open to consortia. " +
    'Use web search to find CURRENT or recent (2025-2026) live tenders, EOIs or RFPs matching: "' + query + '". ' +
    "Prioritise firm-based opportunities from NSDC/MSDE, state skill missions, JICA (TITP/SSW sending " +
    "organisation), GIZ, ADB, the World Bank, GeM and central ministries. " +
    "Respond with ONLY a JSON array, no markdown fences, no preamble, maximum 6 items. " +
    'Each item: {"title","authority","type","deadline","url","note"}. ' +
    '"type" is EOI, RFP or Tender. "deadline" is the submission date or "—". ' +
    '"note" is one short sentence on relevance to this firm. If nothing current is found, return [].';

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search" }]
      })
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(502).json({ error: "Anthropic API error", detail: data });
    }

    const text = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n");

    let results = [];
    const cleaned = text.replace(/```json|```/g, "");
    const s = cleaned.indexOf("["), e = cleaned.lastIndexOf("]");
    if (s >= 0 && e >= 0) {
      try { results = JSON.parse(cleaned.slice(s, e + 1)); } catch (_) { results = []; }
    }

    return res.status(200).json({ results });
  } catch (err) {
    return res.status(500).json({ error: String(err && err.message || err) });
  }
}

function safeJSON(s){ try { return JSON.parse(s); } catch { return {}; } }
