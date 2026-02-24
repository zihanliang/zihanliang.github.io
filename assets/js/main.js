const dataFiles = [
  "data/home/hero.json",
  "data/home/about.json",
  "data/home/news.json",
  "data/home/doing.json",
  "data/home/research.json",
  "data/home/contact.json"
];

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
      <img src="${hero.profileImage}" alt="${hero.name}" class="hero-image" />
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
      <article class="work-card" data-animate>
        <img src="${item.image}" alt="${item.title}" class="card-image" />
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
      <article class="news-item" data-animate>
        <p class="news-meta">${item.date || ""}</p>
        <p class="news-text">${item.text || ""}</p>
      </article>
    `
    )
    .join("");

  setHtml("news-items", items);
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

    setupScrollAnimation();
  } catch (error) {
    console.error("Failed to load page content:", error);
    revealAllAnimatedBlocks();
    setHtml(
      "hero-text",
      `<p class="hero-title">Content failed to load. Please check <code>data/home/*.json</code>.</p>`
    );
  }
}

init();
