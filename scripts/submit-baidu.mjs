import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const token = process.env.BAIDU_PUSH_TOKEN?.trim();
const siteUrl = (process.env.BAIDU_SITE_URL || "https://www.zihanliang.com").replace(/\/$/, "");
const baiduSite = process.env.BAIDU_SITE?.trim() || new URL(siteUrl).host;
const beforeSha = process.env.BAIDU_BEFORE_SHA?.trim();
const currentSha = process.env.BAIDU_CURRENT_SHA?.trim() || "HEAD";

const pageUrls = {
  home: `${siteUrl}/`,
  cv: `${siteUrl}/cv.html`,
  research: `${siteUrl}/research.html`,
  experiences: `${siteUrl}/experiences.html`,
  demo: `${siteUrl}/demo.html`,
  notes: `${siteUrl}/notes.html`,
  zh: `${siteUrl}/zh.html`
};

if (!token) {
  console.log("BAIDU_PUSH_TOKEN is not configured; skipping Baidu URL submission.");
  process.exit(0);
}

function isInitialPush() {
  return !beforeSha || /^0+$/.test(beforeSha);
}

async function changedFiles() {
  if (isInitialPush()) return null;

  try {
    const { stdout } = await execFileAsync("git", [
      "diff",
      "--name-only",
      beforeSha,
      currentSha
    ]);
    return stdout
      .split("\n")
      .map((file) => file.trim())
      .filter(Boolean);
  } catch {
    console.warn("Could not determine changed files; submitting the canonical page set.");
    return null;
  }
}

function urlsForFiles(files) {
  if (!files) return new Set(Object.values(pageUrls));

  const urls = new Set();
  const globalSeoFiles = new Set([
    "_quarto.yml",
    "robots.txt",
    "assets/includes/head-icons.html",
    "data/navigation.json",
    "scripts/render-static-content.mjs",
    "scripts/post-render-seo.mjs"
  ]);

  for (const file of files) {
    if (globalSeoFiles.has(file)) {
      Object.values(pageUrls).forEach((url) => urls.add(url));
      continue;
    }

    const directPage = {
      "index.qmd": "home",
      "cv.qmd": "cv",
      "research.qmd": "research",
      "experiences.qmd": "experiences",
      "demo.qmd": "demo",
      "notes.qmd": "notes",
      "zh.qmd": "zh"
    }[file];

    if (directPage) urls.add(pageUrls[directPage]);
    if (file.startsWith("data/home/")) urls.add(pageUrls.home);
    if (file === "data/home/hero.json" || file === "data/home/contact.json") {
      urls.add(pageUrls.zh);
    }
    if (file.startsWith("data/research/")) {
      urls.add(pageUrls.research);
      urls.add(pageUrls.zh);
    }
    if (file.startsWith("data/experiences/")) {
      urls.add(pageUrls.experiences);
      urls.add(pageUrls.zh);
    }
    if (file.startsWith("data/demo/")) urls.add(pageUrls.demo);
    if (file.startsWith("data/notes/")) urls.add(pageUrls.notes);
    if (file.startsWith("data/zh/")) urls.add(pageUrls.zh);
    if (file === "pdf/Zihan_Liang_CV_Public.pdf" || file.startsWith("figures/cv/")) {
      urls.add(pageUrls.cv);
    }
  }

  return urls;
}

const files = await changedFiles();
const urls = [...urlsForFiles(files)];

if (urls.length === 0) {
  console.log("No indexable page content changed; skipping Baidu URL submission.");
  process.exit(0);
}

if (process.env.BAIDU_PUSH_DRY_RUN === "1") {
  console.log(`Dry run: would submit ${urls.length} canonical URL(s) to Baidu.`);
  urls.forEach((url) => console.log(url));
  process.exit(0);
}

const endpoint = new URL("https://data.zz.baidu.com/urls");
endpoint.searchParams.set("site", baiduSite);
endpoint.searchParams.set("token", token);

const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "text/plain; charset=utf-8" },
  body: `${urls.join("\n")}\n`
});
const responseText = await response.text();
let result;

try {
  result = JSON.parse(responseText);
} catch {
  result = { message: responseText };
}

if (!response.ok || result.error) {
  throw new Error(
    `Baidu URL submission failed (${response.status}): ${result.message || result.error || "unknown error"}`
  );
}

console.log(`Submitted ${urls.length} updated canonical URL(s) to Baidu.`);
console.log(JSON.stringify(result));
