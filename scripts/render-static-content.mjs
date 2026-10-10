import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(projectRoot, "_generated");

const imageDimensions = {
  "figures/home/zihan-liang-profile.jpg": { width: 1280, height: 1707 }
};

const resourceLinkOrder = [
  { key: "paper", label: "Paper" },
  { key: "code", label: "Code" },
  { key: "slides", label: "Slides" },
  { key: "poster", label: "Poster" }
];

const zhResourceLinkOrder = [
  { key: "paper", label: "论文" },
  { key: "code", label: "代码" },
  { key: "slides", label: "幻灯片" },
  { key: "poster", label: "海报" }
];

const zhPaperSectionTitles = new Map([
  ["Publications", "已发表与录用论文"],
  ["Manuscripts", "在审稿件"],
  ["Theses and Dissertations", "学位论文"]
]);

const zhExperienceSectionTitles = new Map([
  ["Education", "教育经历"],
  ["Teaching", "教学经历"],
  ["Industry", "行业经历"],
  ["Leadership", "领导力经历"]
]);

const MONTH_INDEX = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

const emojiSequencePattern = /(\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:[\u{1F3FB}-\u{1F3FF}])?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:[\u{1F3FB}-\u{1F3FF}])?)*)/gu;

async function readJson(relativePath) {
  const file = path.join(projectRoot, relativePath);
  return JSON.parse(await readFile(file, "utf8"));
}

async function writeFragment(name, html) {
  const rawHtml = `\`\`\`{=html}\n${html.trim()}\n\`\`\`\n`;
  await writeFile(path.join(outputDir, `${name}.html`), rawHtml, "utf8");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getImageSizeAttrs(src) {
  const size = imageDimensions[src];
  return size ? `width="${size.width}" height="${size.height}"` : "";
}

function renderTitlePart(part) {
  if (typeof part === "string") return escapeHtml(part);
  const text = escapeHtml(part?.text || "");
  if (!part?.url) return text;
  return `<a href="${escapeHtml(part.url)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
}

function renderResearchTitle(entry) {
  if (Array.isArray(entry?.titleParts) && entry.titleParts.length > 0) {
    return entry.titleParts.map(renderTitlePart).join("");
  }
  const safeTitle = escapeHtml(entry?.title || "");
  if (!entry?.titleUrl) return `<span>${safeTitle}</span>`;
  return `<a href="${escapeHtml(entry.titleUrl)}" target="_blank" rel="noopener noreferrer">${safeTitle}</a>`;
}

function renderResourceLinks(entry, order = resourceLinkOrder) {
  const links = order
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
  return links ? `<div class="scholar-resource-links">${links}</div>` : "";
}

function renderResearchBulletList(items, level = 0) {
  if (!items || items.length === 0) return "";
  const listItems = items.map((item) => renderResearchBulletItem(item, level)).join("");
  return `<ul class="scholar-bullets level-${level}">${listItems}</ul>`;
}

function renderResearchBulletItem(item, level) {
  if (typeof item === "string") return `<li>${escapeHtml(item)}</li>`;
  const text = escapeHtml(item?.text || "");
  return `<li>${text}${renderResearchBulletList(item?.children || [], level + 1)}</li>`;
}

const SELF_NAME = "Zihan Liang";

function renderResearchAuthors(authors) {
  return escapeHtml(authors).replace(
    new RegExp(`${SELF_NAME}\\*?`),
    (name) => `<strong>${name}</strong>`
  );
}

function renderResearchTagRow(entry) {
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

// Papers carry an explicit year and venue; projects fall back to their period.
function renderResearchEntry(entry, today) {
  const range = entry.year ? null : parsePeriod(entry.period, today);
  const years = entry.year ? escapeHtml(entry.year) : renderExperienceYears(range);
  const venue = entry.venueShort || (range ? entry.period : "");
  const meta = [
    entry.authors ? renderResearchAuthors(entry.authors) : "",
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
        <h3 class="pub-title">${renderResearchTitle(entry)}</h3>
        ${meta ? `<p class="scholar-meta pub-meta">${meta}</p>` : ""}
        ${renderResearchTagRow(entry)}
        ${entry.tldr ? `<p class="pub-tldr">${escapeHtml(entry.tldr)}</p>` : ""}
        ${renderResearchBulletList(entry.bullets || [])}
        ${footnote}
      </div>
    </article>
  `;
}

function renderResearchSection(section, index, today) {
  return `
    <section class="exp-section" id="${escapeHtml(section.id || "")}">
      <h2 class="section-title exp-section-title"><span class="exp-section-index">0${index + 1}</span>${escapeHtml(section.title)}</h2>
      <div class="exp-list pub-list">
        ${(section.entries || []).map((entry) => renderResearchEntry(entry, today)).join("")}
      </div>
    </section>
  `;
}

function getTodayValue(date = new Date()) {
  return date.getFullYear() + (date.getMonth() + (date.getDate() - 1) / 31) / 12;
}

// Periods are written as "Aug. 2023 – May 2026"; the end month is inclusive.
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

function renderExperienceYears(range) {
  if (!range) return "";
  if (range.endYear === null) return `${range.startYear}<span>–</span>`;
  if (range.startYear === range.endYear) return `${range.startYear}`;
  return `${range.startYear}<span>–</span>${range.endYear}`;
}

function renderExperienceDetails(details) {
  if (!details || details.length === 0) return "";
  return `<ul class="exp-details">${details.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function renderExperienceMetrics(metrics) {
  if (!metrics || metrics.length === 0) return "";
  return `
    <dl class="exp-metrics">${metrics
      .map(
        (metric) => `
      <div class="exp-metric">
        <dt>${metric.label}</dt>
        <dd>${metric.value}</dd>
      </div>
    `
      )
      .join("")}</dl>
  `;
}

function renderExperienceHighlights(highlights) {
  if (!highlights || highlights.length === 0) return "";
  return `<ul class="exp-chips">${highlights.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function renderExperienceMore(more) {
  if (!more || !(more.groups || []).length) return "";
  return `
    <details class="exp-more">
      <summary>${more.label || "More"}</summary>
      <div class="exp-more-groups">${more.groups
        .map(
          (group) => `
        <div class="exp-more-group">
          <p class="exp-more-label">${group.label}</p>
          <ul class="exp-more-items">${(group.items || []).map((item) => `<li>${item}</li>`).join("")}</ul>
        </div>
      `
        )
        .join("")}</div>
    </details>
  `;
}

function renderExperienceEntry(entry, today) {
  const range = parsePeriod(entry.period, today);
  const isCurrent = Boolean(range && range.start <= today && today < range.end);
  const org = entry.orgUrl
    ? `<a href="${entry.orgUrl}" target="_blank" rel="noopener noreferrer">${entry.org}</a>`
    : `<span>${entry.org}</span>`;
  return `
    <article class="exp-entry${isCurrent ? " is-current" : ""}" id="${entry.id}">
      <div class="exp-when">
        <p class="exp-years">${renderExperienceYears(range)}</p>
        <p class="exp-period">${entry.period || ""}</p>
        ${isCurrent ? `<p class="exp-now">Now</p>` : ""}
      </div>
      <div class="exp-body">
        <h3 class="exp-org">${org}</h3>
        <p class="exp-role">${entry.role || ""}</p>
        ${renderExperienceDetails(entry.details)}
        ${renderExperienceMetrics(entry.metrics)}
        ${entry.summary ? `<p class="exp-summary">${entry.summary}</p>` : ""}
        ${renderExperienceHighlights(entry.highlights)}
        ${renderExperienceMore(entry.more)}
      </div>
    </article>
  `;
}

function renderExperienceSection(section, index, today) {
  return `
    <section class="exp-section" id="${section.id}">
      <h2 class="section-title exp-section-title"><span class="exp-section-index">0${index + 1}</span>${section.title}</h2>
      <div class="exp-list">
        ${(section.entries || []).map((entry) => renderExperienceEntry(entry, today)).join("")}
      </div>
    </section>
  `;
}

function renderExperienceOverview(sections, today) {
  const rows = sections.flatMap((section) =>
    (section.entries || []).map((entry) => ({ section, entry, range: parsePeriod(entry.period, today) }))
  ).filter((row) => row.range);
  if (!rows.length) return "";

  const axisStart = Math.floor(Math.min(...rows.map((row) => row.range.start)));
  const axisEnd = Math.ceil(Math.max(...rows.map((row) => row.range.end)));
  const span = axisEnd - axisStart;
  const toPercent = (value) => `${(((value - axisStart) / span) * 100).toFixed(3)}%`;
  const showNow = today > axisStart && today < axisEnd;

  const ticks = Array.from({ length: span }, (_, i) => axisStart + i)
    .map(
      (year, i) => `
      <span class="exp-gantt-tick${i % 2 ? " is-odd" : ""}" style="left: ${toPercent(year + 0.5)}">
        ${year}
      </span>
    `
    )
    .join("");

  const groups = sections
    .map((section) => {
      const sectionRows = rows.filter((row) => row.section === section);
      if (!sectionRows.length) return "";
      return `
      <div class="exp-gantt-group exp-gantt-group--${section.id}" role="listitem">
        <a class="exp-gantt-row exp-gantt-row--heading" href="#${section.id}">
          <span class="exp-gantt-label">${section.title}</span>
          <span class="exp-gantt-track" aria-hidden="true"></span>
        </a>
        ${sectionRows
          .map(({ entry, range }) => {
            const futureStart = Math.max(range.start, Math.min(today, range.end));
            const solidWidth = ((futureStart - range.start) / (range.end - range.start)) * 100;
            return `
          <a class="exp-gantt-row" href="#${entry.id}" aria-label="${entry.org}, ${entry.period}">
            <span class="exp-gantt-label">${entry.short || entry.org}</span>
            <span class="exp-gantt-track" aria-hidden="true">
              <span class="exp-gantt-bar" style="left: ${toPercent(range.start)}; width: calc(${toPercent(range.end)} - ${toPercent(range.start)}); --solid: ${solidWidth.toFixed(2)}%"></span>
            </span>
          </a>
        `;
          })
          .join("")}
      </div>
    `;
    })
    .join("");

  return `
    <div class="exp-gantt${showNow ? " has-now" : ""}" style="--years: ${span}; --now: ${toPercent(today)}" role="list" aria-label="Timeline of experiences">
      ${groups}
      <div class="exp-gantt-axis" aria-hidden="true">
        <span class="exp-gantt-label"></span>
        <span class="exp-gantt-ticks">${ticks}${showNow ? `<span class="exp-gantt-now-label">Now</span>` : ""}</span>
      </div>
    </div>
  `;
}

const runExecFile = promisify(execFile);

// Page counts come from the PDFs themselves (Poppler's pdfinfo), so they stay
// correct whenever a note is updated. Without pdfinfo, counts are left out.
async function readPdfPageCount(relativePath) {
  try {
    const { stdout } = await runExecFile("pdfinfo", [path.join(projectRoot, relativePath)]);
    const match = stdout.match(/^Pages:\s+(\d+)/m);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

async function addNotePageCounts(data) {
  await Promise.all(
    (data.sections || []).flatMap((section) =>
      (section.items || []).map(async (note) => {
        if (note.file) note.pages = await readPdfPageCount(note.file);
      })
    )
  );
  return data;
}

function renderNoteCard(note) {
  const upcoming = note.status === "upcoming";
  const meta = upcoming
    ? `<span class="note-meta note-meta--upcoming">Coming soon</span>`
    : note.pages
      ? `<span class="note-meta">${note.pages} pp.</span>`
      : "";
  const inner = `
    <div class="note-card-top">
      <span class="note-icon" aria-hidden="true">${escapeHtml(note.icon || "§")}</span>
      ${meta}
    </div>
    <h3 class="note-subject">${note.subject}</h3>
    <p class="note-language">${note.language}</p>
  `;
  const language = escapeHtml(String(note.language || "").toLowerCase());
  const downloadPath = note.file || note.url;
  return downloadPath && !upcoming
    ? `<a class="note-card" data-language="${language}" href="${downloadPath}" target="_blank" rel="noopener noreferrer">${inner}</a>`
    : `<article class="note-card note-card--upcoming" data-language="${language}">${inner}</article>`;
}

function renderNotesSection(section) {
  return `
    <section class="note-section">
      <h2 class="section-title">${section.title}</h2>
      <div class="note-grid">
        ${(section.items || []).map(renderNoteCard).join("")}
      </div>
    </section>
  `;
}

function renderTextWithEmoji(value) {
  return escapeHtml(value).replace(emojiSequencePattern, '<span class="zh-hero-emoji">$1</span>');
}

function renderZhTitle(entry) {
  if (Array.isArray(entry?.titleParts) && entry.titleParts.length > 0) {
    return entry.titleParts.map(renderTitlePart).join("");
  }
  const title = entry?.title || "";
  if (!entry?.titleUrl) return `<span>${title}</span>`;
  return `<a href="${escapeHtml(entry.titleUrl)}" target="_blank" rel="noopener noreferrer">${title}</a>`;
}

function renderZhPaperEntry(entry) {
  const statusParts = [entry.venue, entry.status].filter(Boolean).join(" | ");
  const details = [
    entry.authors ? `<span class="zh-entry-authors">${escapeHtml(entry.authors)}</span>` : "",
    entry.period ? `<span class="zh-entry-period">${escapeHtml(entry.period)}</span>` : "",
    statusParts
      ? `<span class="zh-entry-status"><span class="zh-meta-label">录取/状态：</span>${statusParts}</span>`
      : ""
  ]
    .filter(Boolean)
    .join("");
  return `
    <article class="scholar-entry zh-list-entry zh-paper-entry">
      <div class="zh-entry-content">
        <h3 class="scholar-entry-title">${renderZhTitle(entry)}</h3>
        ${details ? `<div class="zh-entry-details">${details}</div>` : ""}
      </div>
      ${renderResourceLinks(entry, zhResourceLinkOrder)}
    </article>
  `;
}

function toZhCompactExperience(entry) {
  const org = entry.orgUrl
    ? `<a href="${escapeHtml(entry.orgUrl)}" target="_blank" rel="noopener noreferrer">${entry.org}</a>`
    : entry.org;
  return { title: [org, entry.role].filter(Boolean).join(" | "), period: entry.period };
}

function renderZhCompactEntry(entry) {
  const period = entry?.period
    ? `<div class="zh-entry-details"><span class="zh-entry-period">${escapeHtml(entry.period)}</span></div>`
    : "";
  return `
    <article class="scholar-entry zh-list-entry zh-compact-entry">
      <div class="zh-entry-content">
        <h3 class="scholar-entry-title">${renderZhTitle(entry)}</h3>
        ${period}
      </div>
    </article>
  `;
}

function renderHome({ hero, about, news, beyond, research, contact }) {
  const nameWithChineseFont = (about.nameZh || "").replace(
    /([\u3400-\u9FFF]+)/g,
    '<span class="zh-font">$1</span>'
  );
  return `
<div class="site-shell site-shell--home">
  <section class="hero-grid" aria-label="Introduction">
    <div id="hero-text" class="hero-copy">
      <p class="hero-kicker">${about.affiliation}</p>
      <h1 class="hero-title">${hero.greeting} <span>${hero.name}</span> ${hero.tagline}</h1>
      <div class="hero-summary">
        <p class="hero-summary-meta">${nameWithChineseFont} · <a href="mailto:${about.email}">${about.email}</a></p>
        <div class="hero-summary-copy">${(about.paragraphs || []).map((paragraph) => `<p>${paragraph}</p>`).join("")}</div>
      </div>
    </div>
    <div id="hero-image-wrap" class="hero-image-wrap">
      <img src="${hero.profileImage}" alt="${hero.name}" class="hero-image" ${getImageSizeAttrs(hero.profileImage)} loading="eager" decoding="async" fetchpriority="high" />
    </div>
  </section>

  <section class="research">
    <div class="research-head">
      <p id="research-label" class="research-label">${research.label}</p>
      <p id="research-lead" class="research-lead">${research.lead}</p>
    </div>
    <div class="research-side">
      <div id="research-paragraphs" class="research-paragraphs">${research.paragraphs.map((p) => `<p>${p}</p>`).join("")}</div>
      <a id="research-link" class="text-link" href="${research.link.url}">${research.link.label}</a>
    </div>
    <ol id="research-items" class="research-items">${research.items
      .map(
        (item) => `
      <li>
        <h3>${item.title}</h3>
        <p>${item.text}</p>
      </li>
    `
      )
      .join("")}</ol>
  </section>

  <section class="news">
    <h2 id="news-title" class="section-title">${news.title || "Recent News"}</h2>
    <div id="news-items" class="news-list" aria-label="${news.title || "Recent News"} list">${(news.items || [])
      .map(
        (item) => `
      <article class="news-item">
        <p class="news-meta">${item.date || ""}</p>
        <p class="news-text">${item.text || ""}</p>
      </article>
    `
      )
      .join("")}</div>
  </section>

  <section class="beyond">
    <div class="beyond-grid">
      <div class="beyond-head">
        <h2 id="beyond-title" class="section-title beyond-title">${beyond.title}</h2>
        <a id="beyond-link" class="text-link" href="${beyond.link.url}">${beyond.link.label}</a>
      </div>
      <ul id="beyond-items" class="beyond-items">${beyond.items
        .map(
          (item) => `
        <li>
          <h3>${item.title}</h3>
          <p>${item.description}</p>
        </li>
      `
        )
        .join("")}</ul>
    </div>
  </section>

  <section class="contact">
    <div class="contact-grid">
      <h2 id="contact-title" class="section-title">${contact.title}</h2>
      <ul id="contact-links" class="contact-links">${(contact.items || [])
        .map(
          (item) => `
      <li>
        <span class="contact-icon">${item.icon || "•"}</span>
        <a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.label}</a>
      </li>
    `
        )
        .join("")}</ul>
    </div>
  </section>
</div>

<script src="assets/js/main.js"></script>
<script src="assets/js/hero-photo.js"></script>`;
}

function renderResearchPage(data) {
  const today = getTodayValue();
  return `
<div class="site-shell scholar-page research-page" aria-label="Research portfolio">
  <header class="exp-header">
    <h2 id="page-first-title" class="section-title page-first-title">${escapeHtml(data.pageTitle || "Research")}</h2>
    <p id="research-intro" class="exp-intro">${data.pageIntro || ""}</p>
  </header>
  <div id="scholar-sections" class="scholar-sections exp-sections">${(data.sections || [])
    .map((section, index) => renderResearchSection(section, index, today))
    .join("")}</div>
  <p id="scholar-page-footnote" class="scholar-footnote page-footnote">${escapeHtml(data.pageFootnote || "")}</p>
</div>

<script src="assets/js/research.js"></script>`;
}

function renderExperiencesPage(data) {
  const today = getTodayValue();
  const sections = data.sections || [];
  return `
<div class="site-shell scholar-page experiences-page" aria-label="Experiences">
  <header class="exp-header">
    <h2 id="page-first-title" class="section-title page-first-title">${data.pageTitle || "Experiences"}</h2>
    <p id="exp-intro" class="exp-intro">${data.pageIntro || ""}</p>
  </header>
  <section id="exp-overview" class="exp-overview" aria-label="Timeline overview">${renderExperienceOverview(sections, today)}</section>
  <div id="scholar-sections" class="scholar-sections exp-sections">${sections
    .map((section, index) => renderExperienceSection(section, index, today))
    .join("")}</div>
  <p id="scholar-page-footnote" class="scholar-footnote page-footnote">${data.pageFootnote || ""}</p>
</div>

<script src="assets/js/experiences.js"></script>`;
}

function renderNotesPage(data) {
  const notes = (data.sections || []).flatMap((section) => section.items || []);
  const published = notes.filter((note) => note.status !== "upcoming");
  const totalPages = published.reduce((sum, note) => sum + (note.pages || 0), 0);
  const allCounted = published.every((note) => note.pages);
  const stats = [
    `${published.length} sets of notes`,
    allCounted ? `${totalPages.toLocaleString("en-US")} pages` : ""
  ]
    .filter(Boolean)
    .join(" · ");
  const languages = ["English", "Bilingual"];
  const countFor = (language) => published.filter((note) => note.language === language).length;
  const filterButton = (value, label, count) =>
    `<button type="button" class="notes-filter-button" data-filter="${value}" aria-pressed="${value === "all"}">${label} <span>${count}</span></button>`;

  return `
<div class="site-shell notes-page" aria-label="Study notes">
  <header class="notes-header">
    <div class="exp-header notes-header-text">
      <h2 id="page-first-title" class="section-title notes-title page-first-title">${data.overview?.title || "Study Notes"}</h2>
      ${(data.overview?.paragraphs || []).map((p) => `<p class="exp-intro">${p}</p>`).join("")}
      <p class="notes-stats">${stats}</p>
    </div>
    <div class="notes-filter" role="group" aria-label="Filter notes by language">
      ${filterButton("all", "All", published.length)}
      ${languages.map((language) => filterButton(language.toLowerCase(), language, countFor(language))).join("")}
    </div>
  </header>

  <div id="notes-sections" class="notes-sections">${(data.sections || []).map(renderNotesSection).join("")}</div>
  ${data.overview?.footnote ? `<p class="scholar-footnote page-footnote notes-footnote">${data.overview.footnote}</p>` : ""}
</div>

<script src="assets/js/notes.js"></script>`;
}

function renderZhPage({ homeHero, chineseHome, contact, research, experiences }) {
  const hero = chineseHome.hero || {};
  const about = chineseHome.about || {};
  const paperSections = (research.sections || [])
    .filter((section) => zhPaperSectionTitles.has(section.title))
    .map(
      (section) => `
        <section class="scholar-section">
          <h3 class="zh-subsection-title">${zhPaperSectionTitles.get(section.title)}</h3>
          <div class="scholar-entry-list">
            ${(section.entries || []).map(renderZhPaperEntry).join("")}
          </div>
        </section>
      `
    )
    .join("");
  const collaborativeSection = (research.sections || []).find(
    (section) => section.title === "Collaborative Research Projects"
  );
  const experienceSections = (experiences.sections || [])
    .map(
      (section) => `
        <section class="zh-compact-section">
          <h3 class="zh-subsection-title">${zhExperienceSectionTitles.get(section.title) || escapeHtml(section.title)}</h3>
          <div class="scholar-entry-list">
            ${(section.entries || []).map((entry) => renderZhCompactEntry(toZhCompactExperience(entry))).join("")}
          </div>
        </section>
      `
    )
    .join("");
  const contactLabelMap = new Map([
    ["Email", "邮箱"],
    ["Google Scholar", "谷歌学术"],
    ["LinkedIn", "领英"],
    ["Github", "GitHub"]
  ]);
  return `
<div class="site-shell site-shell--home zh-page" aria-label="梁梓涵中文主页">
  <section class="hero-grid" aria-label="个人介绍">
    <div id="zh-hero-text" class="hero-copy">
      <p class="hero-kicker">${escapeHtml(about.affiliation)}</p>
      <h1 class="hero-title zh-hero-title">${renderTextWithEmoji(hero.greeting)}<span>${renderTextWithEmoji(hero.name)}</span>${renderTextWithEmoji(hero.tagline)}</h1>
      <div class="hero-summary">
        <p class="hero-summary-meta">${escapeHtml(about.name)} · <a href="mailto:${escapeHtml(about.email)}">${escapeHtml(about.email)}</a></p>
        <div class="hero-summary-copy">${(about.paragraphs || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</div>
      </div>
    </div>
    <div id="zh-hero-image-wrap" class="hero-image-wrap">
      <img src="${escapeHtml(homeHero.profileImage)}" alt="${escapeHtml(hero.profileImageAlt || hero.name)}" class="hero-image" ${getImageSizeAttrs(homeHero.profileImage)} loading="eager" decoding="async" fetchpriority="high" />
    </div>
  </section>

  <section class="zh-scholar-block">
    <h2 class="section-title">论文与成果 <span>Research</span></h2>
    <div id="zh-paper-sections" class="scholar-sections zh-scholar-sections">${paperSections}</div>
    <p id="zh-research-footnote" class="scholar-footnote page-footnote">${research.pageFootnote ? "* 这些作者对本工作做出了同等贡献。" : ""}</p>
  </section>

  <section class="zh-scholar-block">
    <h2 class="section-title">合作研究项目 <span>Collaborative Research Projects</span></h2>
    <div id="zh-collaborative-projects" class="scholar-entry-list">${(collaborativeSection?.entries || [])
      .map(renderZhCompactEntry)
      .join("")}</div>
  </section>

  <section class="zh-scholar-block">
    <h2 class="section-title">经历 <span>Experiences</span></h2>
    <div id="zh-experience-sections" class="zh-compact-sections">${experienceSections}</div>
  </section>

  <section class="contact zh-contact">
    <div class="contact-grid">
      <h2 id="zh-contact-title" class="section-title">联系 <span>Contact</span></h2>
      <ul id="zh-contact-links" class="contact-links">${(contact.items || [])
        .map(
          (item) => `
          <li>
            <span class="contact-icon">${item.icon || "•"}</span>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${contactLabelMap.get(item.label) || escapeHtml(item.label)}</a>
          </li>
        `
        )
        .join("")}</ul>
    </div>
  </section>
</div>

<script src="assets/js/zh.js"></script>
<script src="assets/js/hero-photo.js"></script>`;
}

await mkdir(outputDir, { recursive: true });

const [hero, about, news, beyond, homeResearch, contact, research, experiences, notes, chineseHome] =
  await Promise.all([
    readJson("data/home/hero.json"),
    readJson("data/home/about.json"),
    readJson("data/home/news.json"),
    readJson("data/home/beyond.json"),
    readJson("data/home/research.json"),
    readJson("data/home/contact.json"),
    readJson("data/research/sections.json"),
    readJson("data/experiences/sections.json"),
    readJson("data/notes/sections.json"),
    readJson("data/zh/home.json")
  ]);

await Promise.all([
  writeFragment("index", renderHome({ hero, about, news, beyond, research: homeResearch, contact })),
  writeFragment("research", renderResearchPage(research)),
  writeFragment("experiences", renderExperiencesPage(experiences)),
  writeFragment("notes", renderNotesPage(await addNotePageCounts(notes))),
  writeFragment(
    "zh",
    renderZhPage({ homeHero: hero, chineseHome, contact, research, experiences })
  )
]);

console.log("Generated static HTML from JSON content.");
