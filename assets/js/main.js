const dataFiles = [
  "data/home/hero.json",
  "data/home/about.json",
  "data/home/news.json",
  "data/home/doing.json",
  "data/home/research.json",
  "data/home/contact.json"
];

const VISIBLE_NEWS_ITEMS = 4;
const NEWS_SCROLL_TOLERANCE = 2;
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
    newsList.setAttribute("aria-label", `${news.title || "Recent News"} list`);
  }

  setupNewsControls(news.title || "Recent News");
}

function getNewsItems(newsList) {
  return Array.from(newsList.querySelectorAll(".news-item"));
}

function getNewsItemGap(newsList) {
  const styles = window.getComputedStyle(newsList);
  return Number.parseFloat(styles.rowGap || styles.gap || "0") || 0;
}

function getNewsScrollStep(newsList) {
  const firstItem = newsList.querySelector(".news-item");
  if (!firstItem) return 0;

  return firstItem.getBoundingClientRect().height + getNewsItemGap(newsList);
}

function getNewsControls() {
  return {
    controls: document.getElementById("news-controls"),
    upButton: document.getElementById("news-scroll-up"),
    downButton: document.getElementById("news-scroll-down")
  };
}

function updateNewsControls() {
  const newsList = document.getElementById("news-items");
  if (!newsList) return;

  const { controls, upButton, downButton } = getNewsControls();
  if (!controls || !upButton || !downButton) return;

  const maxScrollTop = newsList.scrollHeight - newsList.clientHeight;
  const canScroll = maxScrollTop > NEWS_SCROLL_TOLERANCE;
  const atTop = newsList.scrollTop <= NEWS_SCROLL_TOLERANCE;
  const atBottom = newsList.scrollTop >= maxScrollTop - NEWS_SCROLL_TOLERANCE;

  controls.hidden = !canScroll;
  upButton.hidden = !canScroll || atTop;
  downButton.hidden = !canScroll || atBottom;
  upButton.disabled = !canScroll || atTop;
  downButton.disabled = !canScroll || atBottom;
}

function scrollNews(direction) {
  const newsList = document.getElementById("news-items");
  if (!newsList) return;

  const step = getNewsScrollStep(newsList);
  if (!step) return;

  const maxScrollTop = newsList.scrollHeight - newsList.clientHeight;
  const edgeTolerance = Math.max(getNewsItemGap(newsList), NEWS_SCROLL_TOLERANCE);
  let nextScrollTop = Math.min(
    Math.max(newsList.scrollTop + direction * step, 0),
    maxScrollTop
  );

  if (nextScrollTop <= edgeTolerance) {
    nextScrollTop = 0;
  } else if (maxScrollTop - nextScrollTop <= edgeTolerance) {
    nextScrollTop = maxScrollTop;
  }

  newsList.scrollTop = nextScrollTop;
  updateNewsControls();
}

window.scrollNews = scrollNews;
window.updateNewsControls = updateNewsControls;

function setupNewsControls(label) {
  const newsList = document.getElementById("news-items");
  if (!newsList || document.getElementById("news-controls")) return;

  let frame = newsList.closest(".news-list-frame");
  if (!frame) {
    frame = document.createElement("div");
    frame.className = "news-list-frame";
    newsList.insertAdjacentElement("beforebegin", frame);
    frame.appendChild(newsList);
  }

  const controls = document.createElement("div");
  controls.id = "news-controls";
  controls.className = "news-controls";
  controls.hidden = true;
  controls.innerHTML = `
    <button id="news-scroll-up" class="news-scroll-button" type="button" aria-label="Scroll ${label} up" onclick="window.scrollNews(-1)" hidden></button>
    <button id="news-scroll-down" class="news-scroll-button" type="button" aria-label="Scroll ${label} down" onclick="window.scrollNews(1)"></button>
  `;

  frame.appendChild(controls);

  newsList.addEventListener("scroll", updateNewsControls, { passive: true });
}

function syncNewsListViewport() {
  const newsList = document.getElementById("news-items");
  if (!newsList) return;

  const items = getNewsItems(newsList);
  if (!items.length) {
    newsList.style.removeProperty("--news-list-max-height");
    newsList.classList.remove("is-scrollable");
    updateNewsControls();
    return;
  }

  const visibleCount = Math.min(VISIBLE_NEWS_ITEMS, items.length);
  const gap = getNewsItemGap(newsList);
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
  updateNewsControls();
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
