const researchDataFile = "data/research/sections.json";

async function fetchJson(file) {
  const response = await fetch(file);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${file}: ${response.status}`);
  }
  return response.json();
}

function setupScrollAnimation() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  document.querySelectorAll("[data-animate]").forEach((el) => {
    observer.observe(el);
  });
}

function revealAllAnimatedBlocks() {
  document.querySelectorAll("[data-animate]").forEach((el) => {
    el.classList.add("visible");
  });
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
    <article class="scholar-entry" data-animate>
      <h3 class="scholar-entry-title">${linkOrText(entry.title, entry.titleUrl)}</h3>
      ${primaryMeta ? `<p class="scholar-meta">${primaryMeta}</p>` : ""}
      ${venueMeta ? `<p class="scholar-venue">${venueMeta}</p>` : ""}
      ${bullets}
      ${footnote}
    </article>
  `;
}

function renderSection(section) {
  const entriesHtml = (section.entries || []).map(renderEntry).join("");
  return `
    <section class="scholar-section" data-animate>
      <h2 class="section-title">${section.title}</h2>
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

    sectionsEl.innerHTML = (data.sections || []).map(renderSection).join("");
    footnoteEl.textContent = data.pageFootnote || "";

    setupScrollAnimation();
  } catch (error) {
    console.error("Failed to load research page content:", error);
    revealAllAnimatedBlocks();
    const sectionsEl = document.getElementById("scholar-sections");
    sectionsEl.innerHTML = `<p class="scholar-page-subtitle">Content failed to load. Please check <code>data/research/sections.json</code>.</p>`;
  }
}

init();
