const researchDataFile = "data/research/sections.json";
const resourceLinkOrder = [
  { key: "paper", label: "Paper" },
  { key: "code", label: "Code" },
  { key: "slides", label: "Slides" },
  { key: "poster", label: "Poster" },
];

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

function renderVenueRow(entry) {
  const venueParts = [];

  if (entry.venue) {
    venueParts.push(escapeHtml(entry.venue));
  }

  if (entry.status) {
    venueParts.push(entry.status);
  }

  const venueMeta = venueParts.join(" | ");
  const resourceLinks = renderResourceLinks(entry);

  if (!venueMeta && !resourceLinks) return "";

  return `
    <div class="scholar-venue-row">
      ${venueMeta ? `<p class="scholar-venue">${venueMeta}</p>` : ""}
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

function renderEntry(entry) {
  const primaryMeta = [entry.authors, entry.period]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" | ");

  const bullets = renderBulletList(entry.bullets || []);

  const footnote = entry.footnote
    ? `<p class="scholar-footnote">${escapeHtml(entry.footnote)}</p>`
    : "";

  return `
    <article class="scholar-entry">
      <h3 class="scholar-entry-title">${renderTitle(entry)}</h3>
      ${primaryMeta ? `<p class="scholar-meta">${primaryMeta}</p>` : ""}
      ${renderVenueRow(entry)}
      ${bullets}
      ${footnote}
    </article>
  `;
}

function renderSection(section, includeTitle = true) {
  const entriesHtml = (section.entries || []).map(renderEntry).join("");
  return `
    <section class="scholar-section">
      ${includeTitle ? `<h2 class="section-title">${escapeHtml(section.title)}</h2>` : ""}
      <div class="scholar-entry-list">
        ${entriesHtml}
      </div>
    </section>
  `;
}

async function init() {
  try {
    const data = await fetchJson(researchDataFile);
    const sectionsEl = document.getElementById("scholar-sections");
    const footnoteEl = document.getElementById("scholar-page-footnote");
    const firstTitleEl = document.getElementById("page-first-title");
    const [firstSection, ...remainingSections] = data.sections || [];

    if (firstTitleEl) {
      firstTitleEl.textContent = firstSection?.title || "";
      firstTitleEl.hidden = !firstSection?.title;
    }
    sectionsEl.innerHTML = [
      firstSection ? renderSection(firstSection, false) : "",
      ...remainingSections.map((section) => renderSection(section)),
    ].join("");
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
