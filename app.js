const $ = (selector) => document.querySelector(selector);
const pages = ["home", "search", "chat", "code"];
const chatHistory = [];

function showPage(name) {
  if (!pages.includes(name)) name = "home";
  pages.forEach(page => {
    $(`#page-${page}`).classList.toggle("active", page === name);
    document.querySelectorAll(`[data-page="${page}"]`).forEach(button => {
      button.classList.toggle("active", button.classList.contains("nav-link") && page === name);
    });
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click", () => showPage(button.dataset.page)));

async function postJSON(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.style.color = isError ? "#ff9baf" : "";
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
}
function setBusy(button, busy, label) {
  if (busy) {
    button.dataset.originalLabel = button.textContent;
    button.textContent = label || "Working…";
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalLabel || button.textContent;
    button.disabled = false;
  }
}

async function runSearch(query) {
  query = query.trim();
  if (!query) return;
  showPage("search");
  $("#search-query").value = query;
  $("#google-link").href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  $("#ddg-link").href = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
  $("#search-results").replaceChildren();
  setStatus($("#search-status"), "Searching the web…");
  try {
    const data = await postJSON("/api/search", { query });
    setStatus($("#search-status"), data.message || `${data.results.length} results from ${data.provider}.`);
    for (const result of data.results) {
      const article = document.createElement("article");
      article.className = "result-card";
      const title = document.createElement("h3");
      const link = document.createElement("a");
      link.href = result.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = result.title;
      title.appendChild(link);
      const description = document.createElement("p");
      description.textContent = result.snippet;
      const url = document.createElement("a");
      url.href = result.url;
      url.target = "_blank";
      url.rel = "noopener noreferrer";
      url.textContent = result.url;
      article.append(title, description, url);
      $("#search-results").appendChild(article);
    }
  } catch (error) {
    setStatus($("#search-status"), `${error.message} Use the Google or DuckDuckGo links above.`, true);
  }
}
$("#home-search-form").addEventListener("submit", event => {
  event.preventDefault();
  runSearch($("#home-query").value);
});
$("#search-form").addEventListener("submit", event => {
  event.preventDefault();
  runSearch($("#search-query").value);
});

function addChatMessage(role, content) {
  const bubble = document.createElement("div");
  bubble.className = `message ${role}`;
  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "user" ? "YOU" : "NEXORA AI";
  const text = document.createElement("p");
  text.textContent = content;
  bubble.append(label, text);
  $("#chat-messages").appendChild(bubble);
  $("#chat-messages").scrollTop = $("#chat-messages").scrollHeight;
  return text;
}
$("#chat-form").addEventListener("submit", async event => {
  event.preventDefault();
  const input = $("#chat-input");
  const button = event.submitter || $("#chat-form button");
  const message = input.value.trim();
  if (!message) return;
  input.value = "";
  addChatMessage("user", message);
  const historyForRequest = chatHistory.slice(-8);
  const pending = addChatMessage("assistant", "Thinking…");
  setBusy(button, true, "Thinking…");
  try {
    const data = await postJSON("/api/chat", { message, history: historyForRequest });
    pending.textContent = data.reply;
    chatHistory.push({ role: "user", content: message }, { role: "assistant", content: data.reply });
    if (chatHistory.length > 16) chatHistory.splice(0, chatHistory.length - 16);
  } catch (error) {
    pending.textContent = `Sorry — ${error.message}`;
  } finally {
    setBusy(button, false);
  }
});

$("#code-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter || $("#code-form button");
  const prompt = $("#code-prompt").value.trim();
  if (!prompt) return;
  $("#code-result").textContent = "";
  setStatus($("#code-status"), "NEXORA is working through your request…");
  setBusy(button, true, "Working…");
  try {
    const data = await postJSON("/api/programming", {
      language: $("#code-language").value,
      prompt
    });
    $("#code-result").textContent = data.reply;
    setStatus($("#code-status"), "Response ready. Review and test generated code safely.");
  } catch (error) {
    setStatus($("#code-status"), error.message, true);
  } finally {
    setBusy(button, false);
  }
});

fetch("/api/health").then(response => response.json()).then(data => {
  if (!data.groqConfigured) {
    const note = document.createElement("div");
    note.className = "status-message";
    note.textContent = "Setup needed: add GROQ_API_KEY in your hosting provider's private Environment Variables to enable AI chat and programming.";
    note.style.color = "#ffd08a";
    $("#page-chat .chat-panel").prepend(note);
  }
}).catch(() => {});
