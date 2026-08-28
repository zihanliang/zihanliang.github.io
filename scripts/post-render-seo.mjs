import { readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sitemapPath = path.join(projectRoot, "docs", "sitemap.xml");
const homepageOutputUrl = "https://www.zihanliang.com/index.html";
const homepageCanonicalUrl = "https://www.zihanliang.com/";

const pageSources = new Map([
  [
    homepageCanonicalUrl,
    [
      "index.qmd",
      "data/home/hero.json",
      "data/home/about.json",
      "data/home/news.json",
      "data/home/doing.json",
      "data/home/research.json",
      "data/home/contact.json"
    ]
  ],
  ["https://www.zihanliang.com/research.html", ["research.qmd", "data/research/sections.json"]],
  [
    "https://www.zihanliang.com/experiences.html",
    ["experiences.qmd", "data/experiences/sections.json"]
  ],
  ["https://www.zihanliang.com/demo.html", ["demo.qmd", "data/demo/sections.json"]],
  ["https://www.zihanliang.com/notes.html", ["notes.qmd", "data/notes/sections.json"]],
  ["https://www.zihanliang.com/cv.html", ["cv.qmd", "zihan_liang_academic_cv/cv.pdf"]],
  [
    "https://www.zihanliang.com/zh.html",
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

async function latestModification(relativePaths) {
  const stats = await Promise.all(
    relativePaths.map((relativePath) => stat(path.join(projectRoot, relativePath)))
  );
  return new Date(Math.max(...stats.map((fileStat) => fileStat.mtimeMs))).toISOString();
}

const sitemap = await readFile(sitemapPath, "utf8");
let normalizedSitemap = sitemap.replace(
  `<loc>${homepageOutputUrl}</loc>`,
  `<loc>${homepageCanonicalUrl}</loc>`
);

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
  const lastModified = await latestModification(sourcePaths);
  normalizedSitemap = normalizedSitemap.replace(pagePattern, `$1${lastModified}$2`);
}

await writeFile(sitemapPath, normalizedSitemap, "utf8");
console.log("Normalized sitemap URLs and JSON-aware modification times.");
