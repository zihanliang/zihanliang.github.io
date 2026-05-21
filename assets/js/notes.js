const notesDataFile = "data/notes/sections.json";

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

function renderCard(note) {
  const cardInner = `
    <div class="note-icon">${note.icon || "📝"}</div>
    <h3 class="note-subject">${note.subject}</h3>
    <p class="note-language">${note.language}</p>
  `;

  const downloadPath = note.file || note.url;
  if (downloadPath) {
    return `
      <a class="note-card" href="${downloadPath}" target="_blank" rel="noopener noreferrer">
        ${cardInner}
      </a>
    `;
  }

  return `
    <article class="note-card">
      ${cardInner}
    </article>
  `;
}

function renderSection(section) {
  const cards = (section.items || []).map(renderCard).join("");
  return `
    <section class="note-section">
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
    markContentReady();
  } catch (error) {
    console.error("Failed to load notes page content:", error);
    const sectionsEl = document.getElementById("notes-sections");
    sectionsEl.innerHTML = `<p class="scholar-page-subtitle">Content failed to load. Please check <code>data/notes/sections.json</code>.</p>`;
    markContentReady();
  }
}

init();
