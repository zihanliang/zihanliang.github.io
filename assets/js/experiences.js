const researchDataFile = "data/experiences/sections.json";

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

function linkOrText(title, url) {
  if (!url) return `<span>${title}</span>`;
  return `<a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a>`;
}

function renderBulletList(items, level = 0) {
  if (!items || items.length === 0) return "";
  const listItems = items.map((item) => renderBulletItem(item, level)).join("");
  return `<ul class="scholar-bullets level-${level}">${listItems}</ul>`;
}

function renderBulletItem(item, level) {
  if (typeof item === "string") {
    return `<li>${item}</li>`;
  }
  const text = item?.text || "";
  const children = renderBulletList(item?.children || [], level + 1);
  return `<li>${text}${children}</li>`;
}

function renderEntry(entry) {
  const primaryMeta = [entry.authors, entry.period].filter(Boolean).join(" | ");
  const venueMeta = [entry.venue, entry.status].filter(Boolean).join(" | ");

  const bullets = renderBulletList(entry.bullets || []);

  const footnote = entry.footnote
    ? `<p class="scholar-footnote">${entry.footnote}</p>`
    : "";

  return `
    <article class="scholar-entry">
      <h3 class="scholar-entry-title">${linkOrText(entry.title, entry.titleUrl)}</h3>
      ${primaryMeta ? `<p class="scholar-meta">${primaryMeta}</p>` : ""}
      ${venueMeta ? `<p class="scholar-venue">${venueMeta}</p>` : ""}
      ${bullets}
      ${footnote}
    </article>
  `;
}

function renderSection(section, includeTitle = true) {
  const entriesHtml = (section.entries || []).map(renderEntry).join("");
  return `
    <section class="scholar-section">
      ${includeTitle ? `<h2 class="section-title">${section.title}</h2>` : ""}
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
    console.error("Failed to load experiences page content:", error);
    const sectionsEl = document.getElementById("scholar-sections");
    sectionsEl.innerHTML = `<p class="scholar-page-subtitle">Content failed to load. Please check <code>data/experiences/sections.json</code>.</p>`;
    markContentReady();
  }
}

init();
