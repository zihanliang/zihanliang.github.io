const demoDataFile = "data/demo/sections.json";

async function fetchJson(file) {
  const response = await fetch(file);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${file}: ${response.status}`);
  }
  return response.json();
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderTags(tags) {
  if (!tags || tags.length === 0) return "";
  return `
    <ul class="demo-tags" aria-label="Project topics">
      ${tags.map((tag) => `<li>${escapeHtml(tag)}</li>`).join("")}
    </ul>
  `;
}

function renderLinks(links) {
  if (!links || links.length === 0) return "";
  return `
    <div class="demo-actions">
      ${links.map(renderLink).join("")}
    </div>
  `;
}

function renderLink(link) {
  const label = escapeHtml(link?.label || "Open");
  const url = escapeHtml(link?.url || "#");
  const variantClass = link?.variant === "primary" ? " demo-link-primary" : "";

  return `
    <a class="demo-link${variantClass}" href="${url}" target="_blank" rel="noopener noreferrer">
      ${label}
    </a>
  `;
}

function renderCard(item) {
  const emoji = escapeHtml(item?.emoji || "🧪");
  const kicker = item?.kicker
    ? `<p class="demo-kicker">${escapeHtml(item.kicker)}</p>`
    : "";

  return `
    <article class="demo-card">
      <div class="demo-card-head">
        <div class="demo-emoji" aria-hidden="true">${emoji}</div>
        ${kicker}
      </div>
      <div class="demo-card-copy">
        <h3 class="demo-card-title">${escapeHtml(item?.title || "Untitled Demo")}</h3>
        <p class="demo-card-description">${escapeHtml(item?.description || "")}</p>
      </div>
      ${renderTags(item?.tags || [])}
      ${renderLinks(item?.links || [])}
    </article>
  `;
}

function renderPlaceholderCard() {
  return `
    <article class="demo-card demo-card-placeholder">
      <div class="demo-card-head">
        <div class="demo-emoji" aria-hidden="true">🧪</div>
        <p class="demo-kicker">In Progress</p>
      </div>
      <div class="demo-card-copy">
        <h3 class="demo-card-title">More Demos Coming Soon</h3>
        <p class="demo-card-description">
          This page will continue growing with additional interactive tools, prototypes, and research-driven experiments as they are ready to share.
        </p>
      </div>
      <ul class="demo-tags" aria-label="Upcoming demo topics">
        <li>Interactive Tools</li>
        <li>Prototypes</li>
        <li>Experiments</li>
      </ul>
      <p class="demo-placeholder-note">New public-facing demos will be added here soon.</p>
    </article>
  `;
}

async function init() {
  try {
    const data = await fetchJson(demoDataFile);
    const gridEl = document.getElementById("demo-grid");

    setText("demo-page-title", data.pageTitle || "Demo");
    setText(
      "demo-page-subtitle",
      data.pageSubtitle ||
        "Explore interactive builds, technical experiments, and public-facing tools designed to turn ideas into something you can actually try."
    );

    gridEl.innerHTML = (data.items || []).map(renderCard).join("") + renderPlaceholderCard();

  } catch (error) {
    console.error("Failed to load demo page content:", error);

    setText("demo-page-title", "Demo");
    setText(
      "demo-page-subtitle",
      "Content failed to load. Please check data/demo/sections.json."
    );

    const gridEl = document.getElementById("demo-grid");
    gridEl.innerHTML = renderPlaceholderCard();
  }
}

init();
