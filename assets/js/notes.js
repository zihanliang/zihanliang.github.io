const notesDataFile = "data/notes/sections.json";

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

function renderCard(note) {
  const cardInner = `
    <div class="note-icon">${note.icon || "📝"}</div>
    <h3 class="note-subject">${note.subject}</h3>
    <p class="note-language">${note.language}</p>
  `;

  const downloadPath = note.file || note.url;
  if (downloadPath) {
    const filename = (downloadPath.split("/").pop() || "note.pdf").trim();
    return `
      <a class="note-card" href="${downloadPath}" download="${filename}" data-animate>
        ${cardInner}
      </a>
    `;
  }

  return `
    <article class="note-card" data-animate>
      ${cardInner}
    </article>
  `;
}

function renderSection(section) {
  const cards = (section.items || []).map(renderCard).join("");
  return `
    <section class="note-section" data-animate>
      <h2 class="section-title">${section.title}</h2>
      <div class="note-grid">
        ${cards}
      </div>
    </section>
  `;
}

async function init() {
  try {
    const data = await fetchJson(notesDataFile);
    const incomingNotesEl = document.getElementById("incoming-notes-list");
    const sectionsEl = document.getElementById("notes-sections");
    incomingNotesEl.innerHTML = (data.incomingNotes || [])
      .map((item) => `<li>${item}</li>`)
      .join("");
    sectionsEl.innerHTML = (data.sections || []).map(renderSection).join("");
    setupScrollAnimation();
  } catch (error) {
    console.error("Failed to load notes page content:", error);
    revealAllAnimatedBlocks();
    const sectionsEl = document.getElementById("notes-sections");
    sectionsEl.innerHTML = `<p class="scholar-page-subtitle">Content failed to load. Please check <code>data/notes/sections.json</code>.</p>`;
  }
}

init();
