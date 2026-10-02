const researchDataFile = "data/research/sections.json";
const resourceLinkOrder = [
  { key: "paper", label: "Paper" },
  { key: "code", label: "Code" },
  { key: "slides", label: "Slides" },
  { key: "poster", label: "Poster" },
];
const SELF_NAME = "Zihan Liang";

const MONTH_INDEX = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

function markContentReady() {
  document.dispatchEvent(new CustomEvent("site:content-ready"));
}

async function fetchJson(file) {
  const response = await fetch(file);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${file}: ${response.status}`);
  }
  return response.json();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function linkOrText(title, url) {
  const safeTitle = escapeHtml(title);
  if (!url) return `<span>${safeTitle}</span>`;
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${safeTitle}</a>`;
}

function renderTitlePart(part) {
  if (typeof part === "string") {
    return escapeHtml(part);
  }

  const text = escapeHtml(part?.text || "");
  if (!part?.url) return text;

  return `<a href="${escapeHtml(part.url)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
}

function renderTitle(entry) {
  if (Array.isArray(entry?.titleParts) && entry.titleParts.length > 0) {
    return entry.titleParts.map(renderTitlePart).join("");
  }

  return linkOrText(entry.title, entry.titleUrl);
}

function renderResourceLinks(entry) {
  const links = resourceLinkOrder
    .filter(({ key }) => entry?.[key])
    .map(
      ({ key, label }) => `
        <a
          class="scholar-resource-link"
          href="${escapeHtml(entry[key])}"
          target="_blank"
          rel="noopener noreferrer"
        >
          ${label}
        </a>
      `
    )
    .join("");

  if (!links) return "";
  return `<div class="scholar-resource-links">${links}</div>`;
}

function getTodayValue(date = new Date()) {
  return date.getFullYear() + (date.getMonth() + (date.getDate() - 1) / 31) / 12;
}

// Periods are written as "Aug. 2023 - May 2026"; the end month is inclusive.
function parsePeriod(period, today) {
  const matches = [...String(period || "").matchAll(/([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{4})/g)];
  if (!matches.length) return null;
  const toValue = (match) => Number(match[2]) + (MONTH_INDEX[match[1].toLowerCase()] ?? 0) / 12;
  const first = matches[0];
  const last = matches[matches.length - 1];
  const ongoing = /present/i.test(period);
  return {
    start: toValue(first),
    end: ongoing ? today : toValue(last) + 1 / 12,
    startYear: Number(first[2]),
    endYear: ongoing ? null : Number(last[2])
  };
}

function renderYears(range) {
  if (!range) return "";
  if (range.endYear === null) return `${range.startYear}<span>–</span>`;
  if (range.startYear === range.endYear) return `${range.startYear}`;
  return `${range.startYear}<span>–</span>${range.endYear}`;
}

function renderAuthors(authors) {
  return escapeHtml(authors).replace(
    new RegExp(`${SELF_NAME}\\*?`),
    (name) => `<strong>${name}</strong>`
  );
}

function renderTagRow(entry) {
  const topics = (entry.topics || [])
    .map((topic) => `<li>${escapeHtml(topic)}</li>`)
    .join("");
  const resourceLinks = renderResourceLinks(entry);
  if (!topics && !resourceLinks) return "";
  return `
    <div class="pub-tag-row">
      ${topics ? `<ul class="pub-topics">${topics}</ul>` : ""}
      ${resourceLinks}
    </div>
  `;
}

function renderBulletList(items, level = 0) {
  if (!items || items.length === 0) return "";
  const listItems = items.map((item) => renderBulletItem(item, level)).join("");
  return `<ul class="scholar-bullets level-${level}">${listItems}</ul>`;
}

function renderBulletItem(item, level) {
  if (typeof item === "string") {
    return `<li>${escapeHtml(item)}</li>`;
  }
  const text = escapeHtml(item?.text || "");
  const children = renderBulletList(item?.children || [], level + 1);
  return `<li>${text}${children}</li>`;
}

// Papers carry an explicit year and venue; projects fall back to their period.
function renderEntry(entry, today) {
  const range = entry.year ? null : parsePeriod(entry.period, today);
  const years = entry.year ? escapeHtml(entry.year) : renderYears(range);
  const venue = entry.venueShort || (range ? entry.period : "");
  const meta = [
    entry.authors ? renderAuthors(entry.authors) : "",
    entry.year && entry.period ? escapeHtml(entry.period) : ""
  ]
    .filter(Boolean)
    .join(" | ");

  const footnote = entry.footnote
    ? `<p class="scholar-footnote">${escapeHtml(entry.footnote)}</p>`
    : "";

  return `
    <article class="exp-entry pub-entry" id="${escapeHtml(entry.id || "")}">
      <div class="exp-when">
        <p class="exp-years">${years}</p>
        ${venue ? `<p class="exp-period">${escapeHtml(venue)}</p>` : ""}
        ${entry.badge ? `<p class="pub-badge">${escapeHtml(entry.badge)}</p>` : ""}
      </div>
      <div class="exp-body">
        <h3 class="pub-title">${renderTitle(entry)}</h3>
        ${meta ? `<p class="scholar-meta pub-meta">${meta}</p>` : ""}
        ${renderTagRow(entry)}
        ${renderBulletList(entry.bullets || [])}
        ${footnote}
      </div>
    </article>
  `;
}

function renderSection(section, index, today) {
  const entriesHtml = (section.entries || []).map((entry) => renderEntry(entry, today)).join("");
  return `
    <section class="exp-section" id="${escapeHtml(section.id || "")}">
      <h2 class="section-title exp-section-title"><span class="exp-section-index">0${index + 1}</span>${escapeHtml(section.title)}</h2>
      <div class="exp-list pub-list">
        ${entriesHtml}
      </div>
    </section>
  `;
}

async function init() {
  try {
    const data = await fetchJson(researchDataFile);
    const today = getTodayValue();
    const sectionsEl = document.getElementById("scholar-sections");
    const footnoteEl = document.getElementById("scholar-page-footnote");
    const titleEl = document.getElementById("page-first-title");
    const introEl = document.getElementById("research-intro");

    if (titleEl) titleEl.textContent = data.pageTitle || "Research";
    if (introEl) introEl.innerHTML = data.pageIntro || "";
    sectionsEl.innerHTML = (data.sections || [])
      .map((section, index) => renderSection(section, index, today))
      .join("");
    footnoteEl.textContent = data.pageFootnote || "";
    markContentReady();

  } catch (error) {
    console.error("Failed to load research page content:", error);
    const sectionsEl = document.getElementById("scholar-sections");
    sectionsEl.innerHTML = `<p class="scholar-page-subtitle">Content failed to load. Please check <code>data/research/sections.json</code>.</p>`;
    markContentReady();
  }
}

init();
