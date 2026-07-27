const zhDataFiles = {
  homeHero: "data/home/hero.json",
  chineseHome: "data/zh/home.json",
  contact: "data/home/contact.json",
  research: "data/research/sections.json",
  experiences: "data/experiences/sections.json"
};

const zhImageDimensions = {
  "figures/home/zihan-liang-profile.jpg": { width: 1280, height: 1707 }
};

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

function renderTextWithEmoji(value) {
  return escapeHtml(value).replace(
    emojiSequencePattern,
    '<span class="zh-hero-emoji">$1</span>'
  );
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function getImageSizeAttrs(src) {
  const size = zhImageDimensions[src];
  return size ? `width="${size.width}" height="${size.height}"` : "";
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

  const title = entry?.title || "";
  if (!entry?.titleUrl) return `<span>${title}</span>`;

  return `<a href="${escapeHtml(entry.titleUrl)}" target="_blank" rel="noopener noreferrer">${title}</a>`;
}

function renderResourceLinks(entry) {
  const links = zhResourceLinkOrder
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

function renderPaperEntry(entry) {
  const statusParts = [entry.venue, entry.status].filter(Boolean).join(" | ");
  const details = [
    entry.authors
      ? `<span class="zh-entry-authors">${escapeHtml(entry.authors)}</span>`
      : "",
    entry.period
      ? `<span class="zh-entry-period">${escapeHtml(entry.period)}</span>`
      : "",
    statusParts
      ? `<span class="zh-entry-status"><span class="zh-meta-label">录取/状态：</span>${statusParts}</span>`
      : ""
  ]
    .filter(Boolean)
    .join("");
  const resourceLinks = renderResourceLinks(entry);

  return `
    <article class="scholar-entry zh-list-entry zh-paper-entry">
      <div class="zh-entry-content">
        <h3 class="scholar-entry-title">${renderTitle(entry)}</h3>
        ${details ? `<div class="zh-entry-details">${details}</div>` : ""}
      </div>
      ${resourceLinks}
    </article>
  `;
}

function renderCompactEntry(entry) {
  const period = entry?.period
    ? `<div class="zh-entry-details"><span class="zh-entry-period">${escapeHtml(entry.period)}</span></div>`
    : "";

  return `
    <article class="scholar-entry zh-list-entry zh-compact-entry">
      <div class="zh-entry-content">
        <h3 class="scholar-entry-title">${renderTitle(entry)}</h3>
        ${period}
      </div>
    </article>
  `;
}

function renderPaperSections(researchData) {
  const sections = (researchData.sections || [])
    .filter((section) => zhPaperSectionTitles.has(section.title))
    .map(
      (section) => `
        <section class="scholar-section">
          <h3 class="zh-subsection-title">${zhPaperSectionTitles.get(section.title)}</h3>
          <div class="scholar-entry-list">
            ${(section.entries || []).map(renderPaperEntry).join("")}
          </div>
        </section>
      `
    )
    .join("");

  setHtml("zh-paper-sections", sections);
  setHtml(
    "zh-research-footnote",
    researchData.pageFootnote ? "* 这些作者对本工作做出了同等贡献。" : ""
  );
}

function renderCollaborativeProjects(researchData) {
  const section = (researchData.sections || []).find(
    (item) => item.title === "Collaborative Research Projects"
  );

  setHtml(
    "zh-collaborative-projects",
    (section?.entries || []).map(renderCompactEntry).join("")
  );
}

function renderExperiences(experiencesData) {
  const sections = (experiencesData.sections || [])
    .map(
      (section) => `
        <section class="zh-compact-section">
          <h3 class="zh-subsection-title">${zhExperienceSectionTitles.get(section.title) || escapeHtml(section.title)}</h3>
          <div class="scholar-entry-list">
            ${(section.entries || []).map(renderCompactEntry).join("")}
          </div>
        </section>
      `
    )
    .join("");

  setHtml("zh-experience-sections", sections);
}

function renderHero(homeHero, chineseHome) {
  document.documentElement.lang = "zh-CN";

  const hero = chineseHome.hero || {};
  const about = chineseHome.about || {};
  const summary = (about.paragraphs || [])
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");

  setHtml(
    "zh-hero-text",
    `
      <p class="hero-kicker">${escapeHtml(about.affiliation)}</p>
      <h1 class="hero-title zh-hero-title">${renderTextWithEmoji(hero.greeting)}<span>${renderTextWithEmoji(hero.name)}</span>${renderTextWithEmoji(hero.tagline)}</h1>
      <div class="hero-summary">
        <p class="hero-summary-meta">${escapeHtml(about.name)} · <a href="mailto:${escapeHtml(about.email)}">${escapeHtml(about.email)}</a></p>
        <div class="hero-summary-copy">${summary}</div>
      </div>
    `
  );
  setHtml(
    "zh-hero-image-wrap",
    `
      <img src="${escapeHtml(homeHero.profileImage)}" alt="${escapeHtml(hero.profileImageAlt || hero.name)}" class="hero-image" ${getImageSizeAttrs(homeHero.profileImage)} loading="eager" decoding="async" fetchpriority="high" />
    `
  );
}

function renderContact(contact) {
  const labelMap = new Map([
    ["Email", "邮箱"],
    ["Google Scholar", "谷歌学术"],
    ["LinkedIn", "领英"],
    ["Github", "GitHub"]
  ]);

  setHtml("zh-contact-title", "联系 <span>Contact</span>");
  setHtml(
    "zh-contact-links",
    (contact.items || [])
      .map(
        (item) => `
          <li>
            <span class="contact-icon">${item.icon || "•"}</span>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${labelMap.get(item.label) || escapeHtml(item.label)}</a>
          </li>
        `
      )
      .join("")
  );
}

function renderChineseFooter() {
  const updateFooter = () => {
    const footerText = document.querySelector(".footer .nav-footer-center p");
    if (!footerText) return false;

    footerText.innerHTML = `
      Computational Biology and Bioinformatics Program, Duke University | zihan.liang@duke.edu
      <br><span class="zh-footer-note">论文、项目与研究经历的详细说明，请参见英文版相关页面。</span>
      <br><a href="index.html">English</a> | © 2026 Zihan Liang. All rights reserved.
    `;
    return true;
  };

  if (!updateFooter()) {
    document.addEventListener("DOMContentLoaded", updateFooter, { once: true });
  }
}

async function init() {
  try {
    const [homeHero, chineseHome, contact, research, experiences] =
      await Promise.all([
        fetchJson(zhDataFiles.homeHero),
        fetchJson(zhDataFiles.chineseHome),
        fetchJson(zhDataFiles.contact),
        fetchJson(zhDataFiles.research),
        fetchJson(zhDataFiles.experiences)
      ]);

    renderHero(homeHero, chineseHome);
    renderPaperSections(research);
    renderCollaborativeProjects(research);
    renderExperiences(experiences);
    renderContact(contact);
    renderChineseFooter();
    markContentReady();
  } catch (error) {
    console.error("Failed to load Chinese page content:", error);
    setHtml(
      "zh-hero-text",
      `内容加载失败。请检查 <code>data/zh/home.json</code>、<code>data/research/sections.json</code> 和 <code>data/experiences/sections.json</code>。`
    );
    renderChineseFooter();
    markContentReady();
  }
}

init();
