require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cheerio = require("cheerio");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use("/api/", rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false }));
app.use(express.static(path.join(__dirname, "public")));

function safeText(value, max = 12000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function askGroq(messages, temperature = 0.4) {
  if (!GROQ_API_KEY) {
    const error = new Error("The server owner has not added GROQ_API_KEY in the hosting environment.");
    error.status = 503;
    throw error;
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature,
      max_tokens: 1800
    }),
    signal: AbortSignal.timeout(45000)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Groq API returned HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }

  return data?.choices?.[0]?.message?.content || "I couldn't generate a response this time.";
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, app: "NEXORA", groqConfigured: Boolean(GROQ_API_KEY) });
});

app.post("/api/chat", async (req, res) => {
  try {
    const message = safeText(req.body?.message);
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8) : [];
    if (!message) return res.status(400).json({ error: "Please enter a message." });

    const allowedHistory = history
      .filter(item => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
      .map(item => ({ role: item.role, content: safeText(item.content, 4000) }));

    const reply = await askGroq([
      { role: "system", content: "You are NEXORA, a helpful AI assistant. Explain things clearly, accurately, and in accessible language. If unsure, say so." },
      ...allowedHistory,
      { role: "user", content: message }
    ]);
    res.json({ reply });
  } catch (error) {
    console.error("Chat request failed:", error.message);
    res.status(error.status || 500).json({ error: error.status === 503 ? error.message : "NEXORA couldn't reach the AI service. Check the server logs and Groq settings, then try again." });
  }
});

app.post("/api/programming", async (req, res) => {
  try {
    const prompt = safeText(req.body?.prompt);
    const language = safeText(req.body?.language, 80) || "the requested language";
    if (!prompt) return res.status(400).json({ error: "Describe the code or bug you need help with." });

    const reply = await askGroq([
      { role: "system", content: `You are NEXORA Programming AI. Help with ${language}. Explain the approach, provide readable code when useful, point out assumptions and debugging steps. Never claim code was executed unless it actually was. This app does not run code on the server.` },
      { role: "user", content: prompt }
    ], 0.2);
    res.json({ reply });
  } catch (error) {
    console.error("Programming request failed:", error.message);
    res.status(error.status || 500).json({ error: error.status === 503 ? error.message : "The programming assistant is temporarily unavailable. Check the server logs and Groq settings." });
  }
});

app.post("/api/search", async (req, res) => {
  try {
    const query = safeText(req.body?.query, 250);
    if (!query) return res.status(400).json({ error: "Enter something to search for." });

    // Search is performed server-side so the frontend does not need a search-provider key.
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NEXORA/1.0)" },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`Search provider returned HTTP ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];
    $(".result").each((_index, element) => {
      if (results.length >= 8) return;
      const item = $(element);
      const titleElement = item.find(".result__title a").first();
      const snippetElement = item.find(".result__snippet").first();
      const title = titleElement.text().trim();
      let url = titleElement.attr("href") || "";
      const snippet = snippetElement.text().trim();

      if (url.startsWith("//")) url = `https:${url}`;
      if (title && url.startsWith("http")) {
        results.push({ title, url, snippet: snippet || "Open this result to read more." });
      }
    });

    res.json({
      query,
      provider: "DuckDuckGo",
      results,
      message: results.length ? "" : "No results were returned. Try different search words or use the web search link below."
    });
  } catch (error) {
    console.error("Search request failed:", error.message);
    res.status(502).json({ error: "Search is temporarily unavailable. You can still open the query on DuckDuckGo or Google." });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`NEXORA is running on port ${PORT}`);
  console.log(`Groq API key configured: ${Boolean(GROQ_API_KEY)}`);
});
