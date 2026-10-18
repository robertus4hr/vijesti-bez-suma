const DATA_URL = new URL("data/feed.json", document.baseURI).toString();
const STORE_KEY = "vijesti-bez-suma-v1";

const state = {
  feed: null,
  view: "latest",
  category: "all",
  query: "",
  local: loadLocal(),
};

const list = document.querySelector("#news-list");
const search = document.querySelector("#search");
const categorySelect = document.querySelector("#category");

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || { read: [], saved: [], theme: "light" };
  } catch {
    return { read: [], saved: [], theme: "light" };
  }
}

function saveLocal() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state.local));
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { time: "", date: "" };
  return {
    time: new Intl.DateTimeFormat("hr-HR", { hour: "2-digit", minute: "2-digit" }).format(date),
    date: new Intl.DateTimeFormat("hr-HR", { day: "2-digit", month: "2-digit" }).format(date),
  };
}

function relativeTime(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (!Number.isFinite(minutes)) return "";
  if (minutes < 1) return "upravo objavljeno";
  if (minutes < 60) return `prije ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `prije ${hours} h`;
  const days = Math.floor(hours / 24);
  return `prije ${days} d`;
}

function renderCounts() {
  const items = state.feed?.items || [];
  document.querySelector("#story-count").textContent = `${items.length} vijesti`;
  document.querySelector("#unread-count").textContent = items.filter((item) => !state.local.read.includes(item.id)).length || "";
  document.querySelector("#saved-count").textContent = state.local.saved.length || "";
}

function fillCategories() {
  const categories = [...new Set((state.feed?.items || []).map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "hr"));
  categorySelect.innerHTML = '<option value="all">Sve kategorije</option>' + categories.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
}

function visibleItems() {
  const q = state.query.trim().toLocaleLowerCase("hr");
  return (state.feed?.items || []).filter((item) => {
    if (state.category !== "all" && item.category !== state.category) return false;
    if (state.view === "unread" && state.local.read.includes(item.id)) return false;
    if (state.view === "saved" && !state.local.saved.includes(item.id)) return false;
    if (q && !`${item.title} ${item.summary} ${item.category}`.toLocaleLowerCase("hr").includes(q)) return false;
    return true;
  });
}

function articleMarkup(item) {
  const date = formatDate(item.published);
  const isRead = state.local.read.includes(item.id);
  const isSaved = state.local.saved.includes(item.id);
  const safeUrl = /^https:\/\//i.test(item.url) ? item.url : "https://www.index.hr/";
  return `<article class="news-item ${isRead ? "is-read" : ""}" data-id="${escapeHtml(item.id)}">
    <div class="time-block"><time class="time" datetime="${escapeHtml(item.published)}">${escapeHtml(date.time)}</time><span class="date">${escapeHtml(date.date)}</span></div>
    <div class="story-body"><p class="story-meta"><span class="category-pill">${escapeHtml(item.category)}</span><span class="meta-separator"></span><span class="age">${escapeHtml(relativeTime(item.published))}</span></p>
      <h3 class="news-title">${escapeHtml(item.title)}</h3>${item.summary ? `<p class="summary">${escapeHtml(item.summary)}</p>` : ""}</div>
    <div class="story-actions"><button class="save-button ${isSaved ? "saved" : ""}" type="button" data-action="save" aria-label="${isSaved ? "Ukloni iz spremljenih" : "Spremi vijest"}" title="${isSaved ? "Ukloni iz spremljenih" : "Spremi za kasnije"}">${isSaved ? "♥" : "♡"}</button>
      <a class="open-button" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" data-action="open" aria-label="Otvori članak na Index.hr" title="Otvori članak na Index.hr">↗</a></div>
  </article>`;
}

function render() {
  if (!state.feed) return;
  const items = visibleItems();
  renderCounts();
  if (!items.length) {
    const message = state.view === "saved" ? "Još nema spremljenih vijesti." : state.view === "unread" ? "Pročitao si sve vijesti." : "Nema vijesti koje odgovaraju ovom filtru.";
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">○</span><span>${escapeHtml(message)}</span></div>`;
    return;
  }
  list.innerHTML = items.map(articleMarkup).join("");
}

async function loadFeed({ cacheBust = false } = {}) {
  const url = cacheBust ? `${DATA_URL}?t=${Date.now()}` : DATA_URL;
  document.querySelector("#refresh").classList.add("is-loading");
  try {
    const response = await fetch(url, { cache: cacheBust ? "no-store" : "default" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.items)) throw new Error("Neispravan format vijesti");
    state.feed = data;
    document.querySelector("#updated-at").textContent = new Intl.DateTimeFormat("hr-HR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.updatedAt));
    fillCategories();
    categorySelect.value = state.category;
    render();
  } catch (error) {
    console.error(error);
    if (!state.feed) list.innerHTML = `<div class="error-state"><strong>Vijesti se trenutačno ne mogu učitati.</strong><span>Provjeri vezu ili pokušaj ponovno.</span><button type="button" id="retry">Pokušaj ponovno</button></div>`;
  } finally {
    document.querySelector("#refresh").classList.remove("is-loading");
  }
}

list.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  if (!action) return;
  const article = action.closest(".news-item");
  const id = article?.dataset.id;
  if (!id) return;
  if (action.dataset.action === "save") {
    state.local.saved = state.local.saved.includes(id) ? state.local.saved.filter((value) => value !== id) : [id, ...state.local.saved];
    saveLocal();
    render();
  } else if (action.dataset.action === "open") {
    if (!state.local.read.includes(id)) {
      state.local.read.push(id);
      saveLocal();
      article.classList.add("is-read");
      renderCounts();
    }
  }
});

list.addEventListener("click", (event) => {
  if (event.target.id === "retry") loadFeed({ cacheBust: true });
});

search.addEventListener("input", () => { state.query = search.value; render(); });
categorySelect.addEventListener("change", () => { state.category = categorySelect.value; render(); });
document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => {
  state.view = tab.dataset.view;
  document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("active", button === tab));
  render();
}));

document.querySelector("#refresh").addEventListener("click", () => loadFeed({ cacheBust: true }));
document.querySelector("#theme-toggle").addEventListener("click", () => {
  state.local.theme = document.body.classList.toggle("dark") ? "dark" : "light";
  saveLocal();
});
if (state.local.theme === "dark") document.body.classList.add("dark");
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
    event.preventDefault(); search.focus();
  }
});

loadFeed();
