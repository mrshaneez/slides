// Vercel serverless function: turns a title + information into Dhivehi slides.
// Env vars (Vercel → Project → Settings → Environment Variables):
//   ANTHROPIC_API_KEY  required
//   APP_PASSCODE       optional; when set, requests must send the same passcode
//   ANTHROPIC_MODEL    optional; defaults to claude-sonnet-5-5

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_INFO = 120000;
const MAX_PDF_B64 = 4200000; // Vercel request bodies are capped at 4.5 MB

const SYSTEM = `You write presentation slides in Dhivehi (Thaana script) for professional audiences in the Maldives, such as judges, lawyers and court staff.

Rules:
- Write every piece of slide text in Dhivehi, in a formal register. Keep law numbers (e.g. 3/2012), article references (މާއްދާ 31), dates and figures exactly as given. An English term may follow in parentheses only when it is the term people actually use, e.g. (Protection Orders).
- Use ONLY the information provided. Never invent facts, laws, article numbers, statistics, names or dates. If a number is not in the information, do not use a "stats" slide for it.
- Slide 1 is always a "title" slide: eyebrow = short context line (event, audience or duration), title = the deck title, subtitle = one-sentence summary, footer = laws, date or duration if given (otherwise empty).
- Pick the layout that fits each part of the content:
  • "bullets": 3–6 parallel points, each one sentence, max ~90 characters.
  • "cards": 2–4 named parts, steps or categories; h = 2–5 word heading, t = one sentence max ~110 characters. Use for processes, components, comparisons.
  • "stats": 1–3 real numbers from the information; n = the number exactly (e.g. "13.5%", "120", "04"), l = short label.
  • "section": divider before a major part when the deck has 8+ slides; eyebrow like "ބައި 2", title = part name, subtitle = one line.
- Every non-title slide gets a title (max ~70 characters) and a short eyebrow (2–4 words: the part, law or topic).
- One idea per slide. Prefer short, plain sentences. No slide numbers, no "thank you" slide unless the information asks for one.
- Leave unused fields as empty strings or empty arrays.`;

const TOOL = {
  name: "make_slides",
  description: "Return the finished slide deck.",
  input_schema: {
    type: "object",
    properties: {
      slides: {
        type: "array",
        minItems: 1,
        maxItems: 25,
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["title", "section", "bullets", "cards", "stats"] },
            eyebrow: { type: "string" },
            title: { type: "string" },
            subtitle: { type: "string" },
            footer: { type: "string" },
            bullets: { type: "array", items: { type: "string" }, maxItems: 6 },
            items: {
              type: "array", maxItems: 4,
              items: { type: "object", properties: { h: { type: "string" }, t: { type: "string" } }, required: ["h", "t"] }
            },
            stats: {
              type: "array", maxItems: 3,
              items: { type: "object", properties: { n: { type: "string" }, l: { type: "string" } }, required: ["n", "l"] }
            }
          },
          required: ["type", "eyebrow", "title"]
        }
      }
    },
    required: ["slides"]
  }
};

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function clean(slides) {
  const s = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const types = ["title", "section", "bullets", "cards", "stats"];
  return (Array.isArray(slides) ? slides : []).slice(0, 25).map((x) => ({
    type: types.includes(x && x.type) ? x.type : "bullets",
    eyebrow: s(x.eyebrow, 120),
    title: s(x.title, 200),
    subtitle: s(x.subtitle, 300),
    footer: s(x.footer, 200),
    bullets: (Array.isArray(x.bullets) ? x.bullets : []).map((b) => s(b, 220)).filter(Boolean).slice(0, 6),
    items: (Array.isArray(x.items) ? x.items : []).map((i) => ({ h: s(i && i.h, 80), t: s(i && i.t, 260) })).filter((i) => i.h || i.t).slice(0, 4),
    stats: (Array.isArray(x.stats) ? x.stats : []).map((i) => ({ n: s(i && i.n, 12), l: s(i && i.l, 80) })).filter((i) => i.n).slice(0, 3)
  }));
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    return send(res, 200, { ready: Boolean(process.env.ANTHROPIC_API_KEY), passcode: Boolean(process.env.APP_PASSCODE) });
  }
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
  if (!process.env.ANTHROPIC_API_KEY) {
    return send(res, 503, { error: "The AI isn't set up yet. Add ANTHROPIC_API_KEY in the Vercel project's environment variables, then redeploy." });
  }

  let body;
  try { body = await readBody(req); } catch { return send(res, 400, { error: "The request couldn't be read." }); }

  if (process.env.APP_PASSCODE && body.passcode !== process.env.APP_PASSCODE) {
    return send(res, 401, { error: "Wrong passcode." });
  }

  const title = String(body.title || "").trim().slice(0, 300);
  const info = String(body.info || "").trim();
  const count = Number(body.count) || 0;
  const pdf = body.pdf && typeof body.pdf.data === "string" ? body.pdf : null;
  if (pdf && pdf.data.length > MAX_PDF_B64) return send(res, 413, { error: "That PDF is too large to send. Use a PDF under 3 MB, or paste its text instead." });
  if (!title && !info && !pdf) return send(res, 400, { error: "Enter a title and some information, or attach a document." });
  if (info.length > MAX_INFO) return send(res, 400, { error: `The information is too long (${info.length.toLocaleString()} characters). Keep it under ${MAX_INFO.toLocaleString()}.` });

  const want = count >= 3 && count <= 25 ? `Make exactly ${count} slides.` : "Choose the number of slides the information needs (usually 5–12).";
  const user = `Deck title: ${title || "(choose a fitting title from the information)"}\n\n${want}\n\n${pdf ? `The attached PDF (${String(pdf.name || "document").slice(0, 120)}) is the main source. Use the text below as extra instructions or information.\n\n` : ""}Information:\n"""\n${info || (pdf ? "(see the attached PDF)" : "(none — build an outline from the title only, without inventing specific facts)")}\n"""`;
  const content = pdf
    ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.data } }, { type: "text", text: user }]
    : user;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: "tool", name: "make_slides" },
        messages: [{ role: "user", content }]
      })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || `status ${r.status}`;
      const status = r.status === 429 || r.status === 529 ? 503 : 502;
      return send(res, status, { error: `The AI service returned an error: ${msg}` });
    }
    const block = (data.content || []).find((c) => c.type === "tool_use");
    const slides = clean(block && block.input && block.input.slides);
    if (!slides.length) return send(res, 502, { error: "The AI didn't return any slides. Try again." });
    return send(res, 200, { slides, model: data.model || MODEL });
  } catch (e) {
    return send(res, 502, { error: "Couldn't reach the AI service. Try again in a moment." });
  }
};
