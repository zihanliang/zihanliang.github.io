import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(projectRoot, "_generated");

const imageDimensions = {
  "figures/home/zihan-liang-profile.jpg": { width: 1280, height: 1707 },
  "figures/home/whatimdoing-ml.png": { width: 1280, height: 823 },
  "figures/home/whatimdoing-data.png": { width: 1280, height: 823 },
  "figures/home/whatimdoing-aicomm.jpg": { width: 1280, height: 823 },
  "figures/home/whatimdoing-culture.jpg": { width: 1280, height: 823 }
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
  ["Education Experiences", "教育经历"],
  ["Teaching Experiences", "教学经历"],
  ["Industry Experiences", "行业经历"],
  ["Leadership Experiences", "领导力经历"]
]);

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

function renderResearchVenueRow(entry) {
  const venueParts = [];
  if (entry.venue) venueParts.push(escapeHtml(entry.venue));
  if (entry.status) venueParts.push(entry.status);
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

function renderResearchEntry(entry) {
  const primaryMeta = [entry.authors, entry.period].filter(Boolean).map(escapeHtml).join(" | ");
  const footnote = entry.footnote
    ? `<p class="scholar-footnote">${escapeHtml(entry.footnote)}</p>`
    : "";
  return `
    <article class="scholar-entry">
      <h3 class="scholar-entry-title">${renderResearchTitle(entry)}</h3>
      ${primaryMeta ? `<p class="scholar-meta">${primaryMeta}</p>` : ""}
      ${renderResearchVenueRow(entry)}
      ${renderResearchBulletList(entry.bullets || [])}
      ${footnote}
    </article>
  `;
}

function renderResearchSection(section, includeTitle = true) {
  return `
    <section class="scholar-section">
      ${includeTitle ? `<h2 class="section-title">${escapeHtml(section.title)}</h2>` : ""}
      <div class="scholar-entry-list">
        ${(section.entries || []).map(renderResearchEntry).join("")}
      </div>
    </section>
  `;
}

function renderExperienceBulletList(items, level = 0) {
  if (!items || items.length === 0) return "";
  const listItems = items.map((item) => renderExperienceBulletItem(item, level)).join("");
  return `<ul class="scholar-bullets level-${level}">${listItems}</ul>`;
}

function renderExperienceBulletItem(item, level) {
  if (typeof item === "string") return `<li>${item}</li>`;
  return `<li>${item?.text || ""}${renderExperienceBulletList(item?.children || [], level + 1)}</li>`;
}

function renderExperienceEntry(entry) {
  const title = entry.titleUrl
    ? `<a href="${entry.titleUrl}" target="_blank" rel="noopener noreferrer">${entry.title}</a>`
    : `<span>${entry.title}</span>`;
  const primaryMeta = [entry.authors, entry.period].filter(Boolean).join(" | ");
  const venueMeta = [entry.venue, entry.status].filter(Boolean).join(" | ");
  const footnote = entry.footnote ? `<p class="scholar-footnote">${entry.footnote}</p>` : "";
  return `
    <article class="scholar-entry">
      <h3 class="scholar-entry-title">${title}</h3>
      ${primaryMeta ? `<p class="scholar-meta">${primaryMeta}</p>` : ""}
      ${venueMeta ? `<p class="scholar-venue">${venueMeta}</p>` : ""}
      ${renderExperienceBulletList(entry.bullets || [])}
      ${footnote}
    </article>
  `;
}

function renderExperienceSection(section, includeTitle = true) {
  return `
    <section class="scholar-section">
      ${includeTitle ? `<h2 class="section-title">${section.title}</h2>` : ""}
      <div class="scholar-entry-list">
        ${(section.entries || []).map(renderExperienceEntry).join("")}
      </div>
    </section>
  `;
}

function renderDemoTags(tags) {
  if (!tags || tags.length === 0) return "";
  return `
    <ul class="demo-tags" aria-label="Project topics">
      ${tags.map((tag) => `<li>${escapeHtml(tag)}</li>`).join("")}
    </ul>
  `;
}

function renderDemoLinks(links) {
  if (!links || links.length === 0) return "";
  return `
    <div class="demo-actions">
      ${links
        .map((link) => {
          const variantClass = link?.variant === "primary" ? " demo-link-primary" : "";
          return `
    <a class="demo-link${variantClass}" href="${escapeHtml(link?.url || "#")}" target="_blank" rel="noopener noreferrer">
      ${escapeHtml(link?.label || "Open")}
    </a>
  `;
        })
        .join("")}
    </div>
  `;
}

function renderDemoCard(item) {
  const kicker = item?.kicker ? `<p class="demo-kicker">${escapeHtml(item.kicker)}</p>` : "";
  return `
    <article class="demo-card">
      <div class="demo-card-head">
        <div class="demo-emoji" aria-hidden="true">${escapeHtml(item?.emoji || "🧪")}</div>
        ${kicker}
      </div>
      <div class="demo-card-copy">
        <h3 class="demo-card-title">${escapeHtml(item?.title || "Untitled Demo")}</h3>
        <p class="demo-card-description">${escapeHtml(item?.description || "")}</p>
      </div>
      ${renderDemoTags(item?.tags || [])}
      ${renderDemoLinks(item?.links || [])}
    </article>
  `;
}

function renderDemoPlaceholderCard() {
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

function renderNoteCard(note) {
  const inner = `
    <div class="note-icon">${note.icon || "📝"}</div>
    <h3 class="note-subject">${note.subject}</h3>
    <p class="note-language">${note.language}</p>
  `;
  const downloadPath = note.file || note.url;
  return downloadPath
    ? `<a class="note-card" href="${downloadPath}" target="_blank" rel="noopener noreferrer">${inner}</a>`
    : `<article class="note-card">${inner}</article>`;
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

function renderHome({ hero, about, news, doing, research, contact }) {
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
    <p id="research-lead" class="research-lead">${research.lead}</p>
    <div id="research-paragraphs" class="research-paragraphs">${research.paragraphs.map((p) => `<p>${p}</p>`).join("")}</div>
    <ul id="research-bullets" class="research-bullets">${research.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>
  </section>

  <section class="doing">
    <h2 id="doing-title" class="section-title">${doing.title}</h2>
    <div id="doing-cards" class="card-grid">${doing.items
      .map(
        (item) => `
      <article class="work-card">
        <img src="${item.image}" alt="${item.title}" class="card-image" ${getImageSizeAttrs(item.image)} loading="lazy" decoding="async" />
        <h3>${item.title}</h3>
        <p>${item.description}</p>
      </article>
    `
      )
      .join("")}</div>
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

<script src="assets/js/main.js"></script>`;
}

function renderResearchPage(data) {
  const [firstSection, ...remainingSections] = data.sections || [];
  return `
<div class="site-shell scholar-page" aria-label="Research portfolio">
  <h2 id="page-first-title" class="section-title page-first-title">${escapeHtml(firstSection?.title || "")}</h2>
  <div id="scholar-sections" class="scholar-sections">${[
    firstSection ? renderResearchSection(firstSection, false) : "",
    ...remainingSections.map((section) => renderResearchSection(section))
  ].join("")}</div>
  <p id="scholar-page-footnote" class="scholar-footnote page-footnote">${escapeHtml(data.pageFootnote || "")}</p>
</div>

<script src="assets/js/research.js"></script>`;
}

function renderExperiencesPage(data) {
  const [firstSection, ...remainingSections] = data.sections || [];
  return `
<div class="site-shell scholar-page experiences-page" aria-label="Experiences">
  <h2 id="page-first-title" class="section-title page-first-title">${firstSection?.title || ""}</h2>
  <div id="scholar-sections" class="scholar-sections">${[
    firstSection ? renderExperienceSection(firstSection, false) : "",
    ...remainingSections.map((section) => renderExperienceSection(section))
  ].join("")}</div>
  <p id="scholar-page-footnote" class="scholar-footnote page-footnote">${data.pageFootnote || ""}</p>
</div>

<script src="assets/js/experiences.js"></script>`;
}

function renderDemoPage(data) {
  return `
<div class="site-shell demo-shell" aria-label="Demos">
  <section class="demo-hero">
    <h2 id="demo-page-title" class="section-title demo-title">${escapeHtml(data.pageTitle || "Demo")}</h2>
    <p id="demo-page-subtitle" class="scholar-page-subtitle demo-subtitle">${escapeHtml(data.pageSubtitle || "")}</p>
  </section>

  <section id="demo-grid" class="demo-grid" aria-label="Demo projects">${(data.items || [])
    .map(renderDemoCard)
    .join("")}${renderDemoPlaceholderCard()}</section>
</div>

<script src="assets/js/demo.js"></script>`;
}

function renderNotesPage(data) {
  const overviewParagraphs = (data.overview?.paragraphs || [])
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("");
  return `
<div class="site-shell notes-page" aria-label="Study notes">
  <h2 id="page-first-title" class="section-title notes-title page-first-title">${data.overview?.title || ""}</h2>
  <section id="notes-overview" class="notes-overview">${
    overviewParagraphs ? `<div class="notes-overview-copy">${overviewParagraphs}</div>` : ""
  }</section>

  <section class="notes-hero">
    <h2 class="section-title notes-title">Incoming Notes</h2>
    <ul id="incoming-notes-list" class="incoming-notes-list">${(data.incomingNotes || [])
      .map((item) => `<li>${item}</li>`)
      .join("")}</ul>
  </section>

  <div id="notes-sections" class="notes-sections">${(data.sections || []).map(renderNotesSection).join("")}</div>
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
            ${(section.entries || []).map(renderZhCompactEntry).join("")}
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

<script src="assets/js/zh.js"></script>`;
}

await mkdir(outputDir, { recursive: true });

const [hero, about, news, doing, homeResearch, contact, research, experiences, demo, notes, chineseHome] =
  await Promise.all([
    readJson("data/home/hero.json"),
    readJson("data/home/about.json"),
    readJson("data/home/news.json"),
    readJson("data/home/doing.json"),
    readJson("data/home/research.json"),
    readJson("data/home/contact.json"),
    readJson("data/research/sections.json"),
    readJson("data/experiences/sections.json"),
    readJson("data/demo/sections.json"),
    readJson("data/notes/sections.json"),
    readJson("data/zh/home.json")
  ]);

await Promise.all([
  writeFragment("index", renderHome({ hero, about, news, doing, research: homeResearch, contact })),
  writeFragment("research", renderResearchPage(research)),
  writeFragment("experiences", renderExperiencesPage(experiences)),
  writeFragment("demo", renderDemoPage(demo)),
  writeFragment("notes", renderNotesPage(notes)),
  writeFragment(
    "zh",
    renderZhPage({ homeHero: hero, chineseHome, contact, research, experiences })
  )
]);

console.log("Generated static HTML from JSON content.");
