// The notes catalog is pre-rendered at build time (scripts/render-static-content.mjs),
// including page counts read from each PDF. This script only adds the language filter.

function markContentReady() {
  document.dispatchEvent(new CustomEvent("site:content-ready"));
}

function applyFilter(value) {
  document.querySelectorAll(".notes-filter-button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.filter === value));
  });

  document.querySelectorAll(".note-section").forEach((section) => {
    let visible = 0;
    section.querySelectorAll(".note-card").forEach((card) => {
      const show = value === "all" || card.dataset.language === value;
      card.hidden = !show;
      if (show) visible += 1;
    });
    section.hidden = visible === 0;
  });
}

function init() {
  document.querySelectorAll(".notes-filter-button").forEach((button) => {
    button.addEventListener("click", () => applyFilter(button.dataset.filter));
  });
  markContentReady();
}

init();
