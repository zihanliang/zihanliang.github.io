// Sizes the hero portrait so its height matches the text beside it.
// The photo keeps its aspect ratio; only its width changes with the window.
(function () {
  const TWO_COLUMN_QUERY = window.matchMedia("(min-width: 720.02px)");
  const FRAME_OFFSET = 11; // .hero-image-wrap padding (top and left)
  const MIN_WIDTH = 260;
  const MAX_WIDTH = 470;
  const MAX_SHARE = 0.42; // largest share of the grid the portrait may take

  const grid = document.querySelector(".hero-grid");
  const copy = grid?.querySelector(".hero-copy");
  if (!grid || !copy || !("ResizeObserver" in window)) return;

  function getRatio() {
    const img = grid.querySelector(".hero-image");
    if (!img) return 0;
    const width = img.naturalWidth || Number(img.getAttribute("width"));
    const height = img.naturalHeight || Number(img.getAttribute("height"));
    return width && height ? width / height : 0;
  }

  function fit() {
    const ratio = getRatio();
    if (!TWO_COLUMN_QUERY.matches || !ratio) {
      grid.classList.remove("hero-grid--fit");
      grid.style.removeProperty("--hero-photo-width");
      return;
    }

    const textHeight = copy.getBoundingClientRect().height;
    const maxWidth = Math.min(MAX_WIDTH, grid.getBoundingClientRect().width * MAX_SHARE);
    const target = (textHeight - FRAME_OFFSET) * ratio + FRAME_OFFSET;
    const width = Math.round(Math.min(Math.max(target, MIN_WIDTH), maxWidth));

    const current = parseFloat(grid.style.getPropertyValue("--hero-photo-width")) || 0;
    if (Math.abs(current - width) >= 2) {
      grid.style.setProperty("--hero-photo-width", `${width}px`);
    }
    grid.classList.add("hero-grid--fit");
  }

  new ResizeObserver(fit).observe(copy);
  window.addEventListener("resize", fit);
  TWO_COLUMN_QUERY.addEventListener("change", fit);
  grid.addEventListener("load", fit, true);
  document.fonts?.ready.then(fit);
  fit();
})();
