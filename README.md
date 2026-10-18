# NEXORA — Search, AI Chat, and Programming

A mobile-friendly three-area web app with a Node.js backend. Groq requests happen on the server; the browser never receives the Groq API key.

## Features

- NEXORA welcome page and navigation
- Web search results through DuckDuckGo HTML search
- AI chat powered by the Groq API
- Programming help powered by Groq
- Responsive dark sci-fi UI
- Basic security headers, JSON request limit, and API rate limiting

## Requirements

- Node.js 20 or newer
- A Groq API key for AI chat and programming

## Run locally

1. Install Node.js.
2. In this folder, run `npm install`.
3. Copy `.env.example` to `.env`.
4. Open `.env` and replace the placeholder with your Groq API key. Do not share the file.
5. Run `npm start`.
6. Open `http://localhost:3000`.

The search page does not require a Groq key. AI endpoints do.

## Deploy to Render

1. Upload this project to a GitHub repository.
2. In Render, create a **Web Service** and connect that repository.
3. Runtime: Node.
4. Build command: `npm install`
5. Start command: `npm start`
6. In Render → Environment, add:
   - `GROQ_API_KEY` = your real Groq API key
   - `GROQ_MODEL` = `llama-3.3-70b-versatile` (change this if that model is unavailable to your Groq account)
7. Deploy and wait for the service to finish building.
8. Open `https://YOUR-SERVICE.onrender.com/api/health`. It should return JSON with `ok: true` and `groqConfigured: true`.

Keep the repository free of real API keys. Never commit `.env`, paste the key into frontend JavaScript, or send it in chat. If a key was exposed, revoke it and create a new one.

## Important limitations

- Search uses DuckDuckGo HTML results; it is not a Google API and may be rate-limited or change its page format.
- Chat and programming require a valid Groq key and a model available to your account.
- This version does not execute code, accept file uploads for AI analysis, or support live voice conversations. The browser search box is text-only.
- For a public deployment, add stronger abuse controls and monitor hosting/API usage.
