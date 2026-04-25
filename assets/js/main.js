const dataFiles = [
  "data/home/hero.json",
  "data/home/about.json",
  "data/home/news.json",
  "data/home/doing.json",
  "data/home/research.json",
  "data/home/contact.json"
];

const VISIBLE_NEWS_ITEMS = 3;
const imageDimensions = {
  "figures/home/zihan-liang-profile.jpg": { width: 1280, height: 1707 },
  "figures/home/whatimdoing-ml.png": { width: 1280, height: 823 },
  "figures/home/whatimdoing-data.png": { width: 1280, height: 823 },
  "figures/home/whatimdoing-aicomm.jpg": { width: 1280, height: 823 },
  "figures/home/whatimdoing-culture.jpg": { width: 1280, height: 823 }
};

function markContentReady() {
  document.dispatchEvent(new CustomEvent("site:content-ready"));
}

function getImageSizeAttrs(src) {
  const size = imageDimensions[src];
  return size ? `width="${size.width}" height="${size.height}"` : "";
}

async function fetchJson(file) {
  const response = await fetch(file);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${file}: ${response.status}`);
  }
  return response.json();
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function renderHero(hero) {
  setHtml(
    "hero-text",
    `
      <p class="hero-title">${hero.greeting} <span>${hero.name}</span>, ${hero.tagline}</p>
    `
  );

  setHtml(
    "hero-image-wrap",
    `
      <img src="${hero.profileImage}" alt="${hero.name}" class="hero-image" ${getImageSizeAttrs(hero.profileImage)} loading="eager" decoding="async" fetchpriority="high" />
    `
  );
}

function renderAbout(about) {
  const nameWithChineseFont = (about.nameZh || "").replace(
    /([\u3400-\u9FFF]+)/g,
    '<span class="zh-font">$1</span>'
  );

  setHtml(
    "about-headline",
    `${nameWithChineseFont} | <a href="mailto:${about.email}">${about.email}</a> | ${about.affiliation}`
  );

  setHtml(
    "about-paragraphs",
    about.paragraphs.map((p) => `<p>${p}</p>`).join("")
  );
}

function renderDoing(doing) {
  setHtml("doing-title", doing.title);

  const cards = doing.items
    .map(
      (item) => `
      <article class="work-card">
        <img src="${item.image}" alt="${item.title}" class="card-image" ${getImageSizeAttrs(item.image)} loading="lazy" decoding="async" />
        <h3>${item.title}</h3>
        <p>${item.description}</p>
      </article>
    `
    )
    .join("");

  setHtml("doing-cards", cards);
}

function renderNews(news) {
  setHtml("news-title", news.title || "Recent News");

  const items = (news.items || [])
    .map(
      (item) => `
      <article class="news-item">
        <p class="news-meta">${item.date || ""}</p>
        <p class="news-text">${item.text || ""}</p>
      </article>
    `
    )
    .join("");

  setHtml("news-items", items);

  const newsList = document.getElementById("news-items");
  if (newsList) {
    newsList.setAttribute("tabindex", "0");
    newsList.setAttribute("aria-label", `${news.title || "Recent News"} list`);
  }
}

function syncNewsListViewport() {
  const newsList = document.getElementById("news-items");
  if (!newsList) return;

  const items = Array.from(newsList.querySelectorAll(".news-item"));
  if (!items.length) {
    newsList.style.removeProperty("--news-list-max-height");
    newsList.classList.remove("is-scrollable");
    return;
  }

  const visibleCount = Math.min(VISIBLE_NEWS_ITEMS, items.length);
  const styles = window.getComputedStyle(newsList);
  const gap =
    Number.parseFloat(styles.rowGap || styles.gap || "0") || 0;
  const viewportHeight =
    items
      .slice(0, visibleCount)
      .reduce((total, item) => total + item.getBoundingClientRect().height, 0) +
    gap * Math.max(visibleCount - 1, 0);

  newsList.style.setProperty(
    "--news-list-max-height",
    `${Math.ceil(viewportHeight)}px`
  );
  newsList.classList.toggle("is-scrollable", items.length > VISIBLE_NEWS_ITEMS);
}

function setupNewsListViewport() {
  syncNewsListViewport();
  window.addEventListener("resize", syncNewsListViewport);

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      syncNewsListViewport();
    });
  }

  window.requestAnimationFrame(() => {
    syncNewsListViewport();
  });
}

function renderResearch(research) {
  setHtml("research-lead", research.lead);
  setHtml(
    "research-paragraphs",
    research.paragraphs.map((p) => `<p>${p}</p>`).join("")
  );
  setHtml(
    "research-bullets",
    research.bullets.map((b) => `<li>${b}</li>`).join("")
  );
}

function renderContact(contact) {
  setHtml("contact-title", contact.title);
  setHtml(
    "contact-links",
    (contact.items || [])
      .map(
        (item) => `
      <li>
        <span class="contact-icon">${item.icon || "•"}</span>
        <a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.label}</a>
      </li>
    `
      )
      .join("")
  );
}

async function init() {
  try {
    const [hero, about, news, doing, research, contact] = await Promise.all(
      dataFiles.map((file) => fetchJson(file))
    );

    renderHero(hero);
    renderAbout(about);
    renderNews(news);
    renderDoing(doing);
    renderResearch(research);
    renderContact(contact);

    setupNewsListViewport();
    markContentReady();
  } catch (error) {
    console.error("Failed to load page content:", error);
    setHtml(
      "hero-text",
      `<p class="hero-title">Content failed to load. Please check <code>data/home/*.json</code>.</p>`
    );
    markContentReady();
  }
}

init();
