// Study-note reader pages (laid out by scripts/note-reader.lua): highlights the
// current section in the table of contents. On desktop the contents sit in a
// sticky sidebar; on narrow screens they open as a side drawer from a button
// that stays in the corner while reading.

(function () {
  const root = document.documentElement;
  const toc = document.querySelector(".note-toc");
  const details = toc && toc.querySelector(".note-toc-details");
  const desktop = window.matchMedia("(min-width: 992px)");

  // Reader pages live under notes/, so mark the Study Notes nav link as current.
  document.querySelectorAll(".navbar .nav-link").forEach((link) => {
    if (/(^|\/)notes\.html$/.test(link.getAttribute("href") || "")) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });

  if (!toc || !details) return;

  root.classList.add("note-toc-enhanced");
  toc.id = toc.id || "note-toc";
  const list = toc.querySelector(".note-toc-list");

  // The list is always expanded; the summary is only a label.
  details.open = true;
  details.querySelector("summary").addEventListener("click", (event) => event.preventDefault());

  // Drawer controls for narrow screens.
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "note-toc-toggle";
  toggle.setAttribute("aria-controls", toc.id);
  toggle.setAttribute("aria-expanded", "false");
  toggle.innerHTML = '<span class="note-toc-toggle-icon" aria-hidden="true"></span>Contents';

  const close = document.createElement("button");
  close.type = "button";
  close.className = "note-toc-close";
  close.setAttribute("aria-label", "Close contents");
  close.innerHTML = '<span aria-hidden="true">×</span>';
  details.querySelector("summary").after(close);

  const backdrop = document.createElement("div");
  backdrop.className = "note-toc-backdrop";
  backdrop.setAttribute("aria-hidden", "true");

  document.body.append(backdrop, toggle);

  // On narrow screens the drawer lives directly under <body>, so no page
  // wrapper's stacking context can put it below the header or the backdrop.
  const home = document.createComment("note-toc");
  toc.before(home);
  function placeToc() {
    if (desktop.matches) home.after(toc);
    else backdrop.before(toc);
  }
  placeToc();

  function isOpen() {
    return root.classList.contains("note-toc-open");
  }

  function syncInert() {
    toc.inert = !desktop.matches && !isOpen();
  }

  function openDrawer() {
    root.classList.add("note-toc-open");
    toggle.setAttribute("aria-expanded", "true");
    syncInert();
    revealCurrent("center");
    (toc.querySelector("a[aria-current]") || close).focus({ preventScroll: true });
  }

  function closeDrawer({ restoreFocus = true } = {}) {
    if (!isOpen()) return;
    root.classList.remove("note-toc-open");
    toggle.setAttribute("aria-expanded", "false");
    syncInert();
    if (restoreFocus) toggle.focus({ preventScroll: true });
  }

  toggle.addEventListener("click", () => (isOpen() ? closeDrawer() : openDrawer()));
  close.addEventListener("click", () => closeDrawer());
  backdrop.addEventListener("click", () => closeDrawer());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDrawer();
  });
  desktop.addEventListener("change", () => {
    closeDrawer({ restoreFocus: false });
    placeToc();
    syncInert();
  });
  syncInert();

  const links = Array.from(toc.querySelectorAll("a[data-target]"));
  const targets = links
    .map((link) => ({ link, element: document.getElementById(link.dataset.target) }))
    .filter((entry) => entry.element);

  links.forEach((link) => {
    link.addEventListener("click", () => closeDrawer({ restoreFocus: false }));
  });

  let current = null;

  // Keep the highlighted entry visible inside whichever list is scrolling.
  function revealCurrent(position) {
    if (!current) return;
    const scroller = desktop.matches ? list : toc;
    const top = current.link.offsetTop - scroller.offsetTop;
    const outside = top < scroller.scrollTop || top > scroller.scrollTop + scroller.clientHeight - 40;
    if (position === "center" || outside) {
      scroller.scrollTo({ top: Math.max(0, top - scroller.clientHeight / 3) });
    }
  }

  function setCurrent(entry) {
    if (entry === current) return;
    if (current) {
      current.link.removeAttribute("aria-current");
      current.link.closest(".note-toc-group")?.classList.remove("is-active");
    }
    current = entry;
    if (!entry) return;

    entry.link.setAttribute("aria-current", "location");
    entry.link.closest(".note-toc-group")?.classList.add("is-active");
    if (desktop.matches) revealCurrent();
  }

  function update() {
    // A section becomes current once its heading passes the upper third of the screen.
    const threshold = Math.min(window.innerHeight * 0.35, 280);
    let active = null;
    for (const entry of targets) {
      if (entry.element.getBoundingClientRect().top > threshold) break;
      active = entry;
    }
    setCurrent(active || targets[0] || null);
  }

  let frame = 0;
  window.addEventListener(
    "scroll",
    () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    },
    { passive: true }
  );
  // Anchor jumps and MathJax typesetting move headings after the first pass.
  ["resize", "load", "hashchange"].forEach((type) => window.addEventListener(type, update));
  update();
})();
