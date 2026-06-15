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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, service: "sift", hasKey: Boolean(process.env.ANTHROPIC_API_KEY) });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const body = typeof req.body === "string" ? safeJSON(req.body) : req.body || {};
  const query = (body.query || "").toString().trim();
  if (!query) return res.status(400).json({ error: "Missing 'query'." });

  // Strip UTF-8 BOM (U+FEFF, char 65279) that can appear when the env var is pasted from some editors
  const _rawKey = process.env.ANTHROPIC_API_KEY || "";
  const key = (_rawKey.charCodeAt(0) === 0xFEFF ? _rawKey.slice(1) : _rawKey).trim();
  if (!key) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured." });

  const prompt =
    "You are the strainer for Sift, a tender-triage tool for an Indian skill-development (TVET) implementation firm. " +
    "The firm BIDS AS A COMPANY (not an individual), offers trainers, training infrastructure and end-to-end implementation (PIA role), " +
    "is open to consortia, has 100 Cr+ revenue but a NEGATIVE net worth, and works across: skill development, hospitality, " +
    "nursing & caretaking, digital marketing, oil & gas retail, and Japanese language / TITP-SSW. " +
    'Use web search to strain CURRENT or recent (2025-2026) FIRM-BASED tenders, EOIs and RFPs from ' + query + '. ' +
    "Judge each opportunity's fit from this firm's lens. " +
    "Respond with ONLY a JSON array, no markdown fences, no preamble, maximum 10 items. " +
    'Each item keys exactly: {"title","authority","source","type","deadline","url","fit","reason","tags"}. ' +
    '"type" is EOI, RFP or Tender. "deadline" is the submission date or "—". ' +
    '"fit" is exactly "Fit", "Mid" or "Not" (Fit = firm-based and squarely in-sector with feasible eligibility; ' +
    'Mid = partial sector match or eligibility/commoditisation doubt; Not = individual-only, out of sector or disqualifying). ' +
    '"reason" is one short sentence naming the biggest factor behind the fit tag. ' +
    '"tags" is an array drawn only from: ["TVET","Skill Dev","PIA","VTP","EOI","RFP","RPL","NSQF","NSDC","TITP/SSW","JICA","Hospitality","Nursing","Digital","Oil & Gas","Japanese","Consortium","Multilateral","State","Central"]. ' +
    "If nothing current is found, return [].";

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
        max_tokens: 1800,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20260209", name: "web_search" }]
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
