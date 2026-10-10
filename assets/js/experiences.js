const researchDataFile = "data/experiences/sections.json";

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

function linkOrText(title, url) {
  if (!url) return `<span>${title}</span>`;
  return `<a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a>`;
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

function renderYears(range) {
  if (!range) return "";
  if (range.endYear === null) return `${range.startYear}<span>–</span>`;
  if (range.startYear === range.endYear) return `${range.startYear}`;
  return `${range.startYear}<span>–</span>${range.endYear}`;
}

function renderDetails(details) {
  if (!details || details.length === 0) return "";
  return `<ul class="exp-details">${details.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function renderMetrics(metrics) {
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

function renderHighlights(highlights) {
  if (!highlights || highlights.length === 0) return "";
  return `<ul class="exp-chips">${highlights.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function renderMore(more) {
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

function renderEntry(entry, today) {
  const range = parsePeriod(entry.period, today);
  const isCurrent = Boolean(range && range.start <= today && today < range.end);

  return `
    <article class="exp-entry${isCurrent ? " is-current" : ""}" id="${entry.id}">
      <div class="exp-when">
        <p class="exp-years">${renderYears(range)}</p>
        <p class="exp-period">${entry.period || ""}</p>
        ${isCurrent ? `<p class="exp-now">Now</p>` : ""}
      </div>
      <div class="exp-body">
        <h3 class="exp-org">${linkOrText(entry.org, entry.orgUrl)}</h3>
        <p class="exp-role">${entry.role || ""}</p>
        ${renderDetails(entry.details)}
        ${renderMetrics(entry.metrics)}
        ${entry.summary ? `<p class="exp-summary">${entry.summary}</p>` : ""}
        ${renderHighlights(entry.highlights)}
        ${renderMore(entry.more)}
      </div>
    </article>
  `;
}

function renderSection(section, index, today) {
  const entriesHtml = (section.entries || []).map((entry) => renderEntry(entry, today)).join("");
  return `
    <section class="exp-section" id="${section.id}">
      <h2 class="section-title exp-section-title"><span class="exp-section-index">0${index + 1}</span>${section.title}</h2>
      <div class="exp-list">
        ${entriesHtml}
      </div>
    </section>
  `;
}

function renderOverview(sections, today) {
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

async function init() {
  try {
    const data = await fetchJson(researchDataFile);
    const today = getTodayValue();
    const sections = data.sections || [];

    const titleEl = document.getElementById("page-first-title");
    const introEl = document.getElementById("exp-intro");
    const overviewEl = document.getElementById("exp-overview");
    const sectionsEl = document.getElementById("scholar-sections");
    const footnoteEl = document.getElementById("scholar-page-footnote");

    if (titleEl) titleEl.textContent = data.pageTitle || "Experiences";
    if (introEl) introEl.innerHTML = data.pageIntro || "";
    if (overviewEl) overviewEl.innerHTML = renderOverview(sections, today);
    sectionsEl.innerHTML = sections.map((section, index) => renderSection(section, index, today)).join("");
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
