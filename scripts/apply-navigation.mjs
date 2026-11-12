// Applies data/navigation.json to the rendered pages (a Quarto post-render step).
//
// Navbar entries marked `"visible": false` are removed from every page's HTML,
// so the menu is final when the page arrives and the browser never has to fetch
// the settings before showing it.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(projectRoot, "docs");

function pageKey(href) {
  const fileName = String(href || "")
    .split(/[?#]/)[0]
    .replace(/\/+$/, "/index.html")
    .split("/")
    .pop();
  return (fileName || "index.html").replace(/\.qmd$/i, ".html").toLowerCase();
}

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === "site_libs" ? [] : htmlFiles(fullPath);
      return entry.name.endsWith(".html") ? [fullPath] : [];
    })
  );
  return files.flat();
}

const config = JSON.parse(await readFile(path.join(projectRoot, "data/navigation.json"), "utf8"));
const hidden = (config.pages || []).filter((page) => page.visible === false);
const hiddenHrefs = new Set(hidden.map((page) => pageKey(page.href)).filter(Boolean));
const hiddenTexts = new Set(hidden.map((page) => String(page.text || "").trim().toLowerCase()).filter(Boolean));

if (hidden.length === 0) {
  console.log("Navigation: every navbar entry is visible.");
} else {
  // Quarto writes each navbar entry as <li class="nav-item"> holding one .nav-link.
  const navItemPattern = /[ \t]*<li class="nav-item">\s*<a class="nav-link[^"]*" href="([^"]*)"[^>]*>\s*<span class="menu-text">([^<]*)<\/span><\/a>\s*<\/li>[ \t]*\n?/g;
  let removed = 0;

  for (const file of await htmlFiles(outputDir)) {
    const html = await readFile(file, "utf8");
    const updated = html.replace(navItemPattern, (item, href, text) => {
      const isHidden = hiddenHrefs.has(pageKey(href)) || hiddenTexts.has(text.trim().toLowerCase());
      if (isHidden) removed += 1;
      return isHidden ? "" : item;
    });
    if (updated !== html) await writeFile(file, updated, "utf8");
  }

  console.log(`Navigation: hid ${hidden.map((page) => page.text).join(", ")} (${removed} navbar entries removed).`);
}
