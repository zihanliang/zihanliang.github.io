import { execFileSync } from "node:child_process";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sitemapPath = path.join(projectRoot, "docs", "sitemap.xml");
const siteUrl = "https://www.zihanliang.com";
const homepageCanonicalUrl = `${siteUrl}/`;

// Pages dated by the files their content comes from (directories count every
// tracked file inside them).
const pageSources = new Map([
  [
    homepageCanonicalUrl,
    [
      "index.qmd",
      "data/home/hero.json",
      "data/home/about.json",
      "data/home/news.json",
      "data/home/beyond.json",
      "data/home/research.json",
      "data/home/contact.json"
    ]
  ],
  [`${siteUrl}/research.html`, ["research.qmd", "data/research/sections.json"]],
  [`${siteUrl}/deadlines.html`, ["deadlines.qmd", "data/deadlines-snapshot.json"]],
  [`${siteUrl}/experiences.html`, ["experiences.qmd", "data/experiences/sections.json"]],
  [`${siteUrl}/notes.html`, ["notes.qmd", "data/notes/sections.json"]],
  [`${siteUrl}/cv.html`, ["cv.qmd", "zihan_liang_academic_cv"]],
  [
    `${siteUrl}/zh.html`,
    [
      "zh.qmd",
      "data/zh/home.json",
      "data/home/hero.json",
      "data/home/contact.json",
      "data/research/sections.json",
      "data/experiences/sections.json"
    ]
  ]
]);

// Study-note reader pages, listed at their canonical notes/<name>/ address and
// dated by the note's folder (its Markdown or LaTeX source and figures) and PDF.
const notesCatalog = JSON.parse(await readFile(path.join(projectRoot, "data/notes/sections.json"), "utf8"));
for (const note of (notesCatalog.sections || []).flatMap((section) => section.items || [])) {
  if (!note.source || note.status === "upcoming") continue;
  const noteDir = path.posix.dirname(note.source);
  pageSources.set(`${siteUrl}/${noteDir}/`, [noteDir, note.file, "data/notes/sections.json"].filter(Boolean));
}

function git(args) {
  try {
    return execFileSync("git", args, { cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

// The date of the last commit that changed a path. Paths with uncommitted
// changes (a local build) use their modification time instead. File times are
// not used otherwise, because a fresh checkout gives every file the same one.
async function lastModified(relativePath) {
  const changed = git(["status", "--porcelain", "--", relativePath]);
  const committed = changed ? null : git(["log", "-1", "--format=%cI", "--", relativePath]);
  if (committed) return new Date(committed).getTime();

  const fileStat = await stat(path.join(projectRoot, relativePath));
  return fileStat.isDirectory() ? Date.now() : fileStat.mtimeMs;
}

async function latestModification(relativePaths) {
  const times = await Promise.all(relativePaths.map(lastModified));
  return new Date(Math.max(...times)).toISOString();
}

// Link previews (Open Graph and Twitter cards). Quarto takes the preview
// title from each page's `title`, which these pages leave empty (the study
// notes get " – Zihan Liang"), and adds no description. Use the page's own
// <title> and meta description instead, and add the canonical URL.
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

function setMeta(html, attribute, name, content, after) {
  const tag = `<meta ${attribute}="${name}" content="${content}">`;
  const existing = new RegExp(`<meta ${attribute}="${name}" content="[^"]*">`);
  if (existing.test(html)) return html.replace(existing, tag);
  return after && html.includes(after) ? html.replace(after, `${after}\n${tag}`) : html;
}

let previewPages = 0;
for (const file of await htmlFiles(path.join(projectRoot, "docs"))) {
  const html = await readFile(file, "utf8");
  if (!html.includes('property="og:title"')) continue;

  const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim();
  const description = html.match(/<meta name="description" content="([^"]*)">/)?.[1];
  const canonical = html.match(/<link rel="canonical" href="([^"]*)">/)?.[1];

  let updated = html;
  if (title) {
    updated = setMeta(updated, "property", "og:title", title);
    updated = setMeta(updated, "name", "twitter:title", title);
  }
  if (description) {
    updated = setMeta(updated, "property", "og:description", description, updated.match(/<meta property="og:title"[^>]*>/)?.[0]);
    updated = setMeta(updated, "name", "twitter:description", description, updated.match(/<meta name="twitter:title"[^>]*>/)?.[0]);
  }
  if (canonical) {
    updated = setMeta(updated, "property", "og:url", canonical, updated.match(/<meta property="og:title"[^>]*>/)?.[0]);
    updated = setMeta(updated, "property", "og:type", "website", updated.match(/<meta property="og:url"[^>]*>/)?.[0]);
  }
  if (updated !== html) {
    await writeFile(file, updated, "utf8");
    previewPages += 1;
  }
}
console.log(`Completed link-preview tags on ${previewPages} pages.`);

const sitemap = await readFile(sitemapPath, "utf8");

// List folder pages at their canonical address (https://…/notes/ml/, not
// …/notes/ml/index.html), and leave the 404 page out.
let normalizedSitemap = sitemap
  .replace(/<loc>([^<]*\/)index\.html<\/loc>/g, "<loc>$1</loc>")
  .replace(/\s*<url>\s*<loc>[^<]*\/404\.html<\/loc>[\s\S]*?<\/url>/g, "");

if (!normalizedSitemap.includes(`<loc>${homepageCanonicalUrl}</loc>`)) {
  throw new Error(`Homepage URL was not found in ${sitemapPath}.`);
}

for (const [url, sourcePaths] of pageSources) {
  const pagePattern = new RegExp(
    `(<loc>${url.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}</loc>\\s*<lastmod>)[^<]+(</lastmod>)`
  );
  if (!pagePattern.test(normalizedSitemap)) {
    throw new Error(`Sitemap entry was not found for ${url}.`);
  }
  const lastModifiedTime = await latestModification(sourcePaths);
  normalizedSitemap = normalizedSitemap.replace(pagePattern, `$1${lastModifiedTime}$2`);
}

await writeFile(sitemapPath, normalizedSitemap, "utf8");
console.log("Normalized sitemap URLs and dated each page by its last committed change.");
