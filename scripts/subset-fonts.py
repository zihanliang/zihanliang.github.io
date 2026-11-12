#!/usr/bin/env python3
"""Build small web copies of the Chinese fonts.

The full Chinese fonts are 8-16 MB each, but the site only shows a few hundred
distinct characters with them. This script collects every character in the
site's own text (the JSON data, page sources, and browser scripts), keeps only
those glyphs, and writes WOFF2 files to fonts/subsets/, which the stylesheet
loads.

A manifest records what each subset was built from, so the script does nothing
when the text has not changed. Characters added later that are missing from a
subset still render, in the next font of the CSS font stack.

Usage:
  python3 scripts/subset-fonts.py           # warn and keep the existing subsets if fontTools is missing
  python3 scripts/subset-fonts.py --strict  # fail instead (used by the deploy workflow)

Requires fontTools and brotli: pip install fonttools brotli
"""

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "fonts" / "subsets"
MANIFEST = OUTPUT_DIR / "manifest.json"
SCRIPT_VERSION = 1

# Text that can end up in the Chinese fonts: the page content and the strings
# written by the build and browser scripts. Study notes are not included; their
# reader pages use system fonts.
TEXT_SOURCES = [
    "data/**/*.json",
    "assets/js/*.js",
    "scripts/render-static-content.mjs",
    "*.qmd",
    "_quarto.yml",
]

# Always kept, so Latin text and common punctuation set in these fonts never
# falls back mid-word.
BASE_CHARACTERS = (
    "".join(chr(code) for code in range(0x20, 0x7F))
    + " ©·–—‘’“”•…→×"
    + "　、。《》「」【】"
    + "！（），：；？"
)

CJK_PATTERN = re.compile(r"[㐀-鿿]+")


def site_text():
    files = sorted({path for pattern in TEXT_SOURCES for path in ROOT.glob(pattern) if path.is_file()})
    return "".join(path.read_text(encoding="utf-8") for path in files)


def chinese_name_text():
    # LXGW WenKai only sets the Chinese characters of the name on the English
    # home page (see the .zh-font span in main.js and render-static-content.mjs).
    about = json.loads((ROOT / "data/home/about.json").read_text(encoding="utf-8"))
    return "".join(CJK_PATTERN.findall(about.get("nameZh", "")))


def site_characters():
    characters = set(site_text()) | set(BASE_CHARACTERS)
    return "".join(sorted(ch for ch in characters if ch.isprintable() or ch == "　"))


JOBS = [
    # (output name, source font, text function)
    ("alibaba-puhuiti-400.woff2", "fonts/AlibabaPuHuiTi/AlibabaPuHuiTi-2-55-Regular.ttf", site_characters),
    ("alibaba-puhuiti-500.woff2", "fonts/AlibabaPuHuiTi/AlibabaPuHuiTi-2-65-Medium.ttf", site_characters),
    ("alibaba-puhuiti-600.woff2", "fonts/AlibabaPuHuiTi/AlibabaPuHuiTi-2-75-SemiBold.ttf", site_characters),
    ("alibaba-puhuiti-700.woff2", "fonts/AlibabaPuHuiTi/AlibabaPuHuiTi-2-85-Bold.ttf", site_characters),
    ("lxgw-wenkai-700.woff2", "fonts/LXGWWenKai/LXGWWenKai-Bold.ttf", chinese_name_text),
]


def signature(source, text):
    digest = hashlib.sha256()
    digest.update(f"{SCRIPT_VERSION}\n{source}\n{(ROOT / source).stat().st_size}\n".encode())
    digest.update(text.encode("utf-8"))
    return digest.hexdigest()


def build_subset(source, text, output):
    from fontTools import subset

    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.hinting = False
    options.desubroutinize = True
    options.notdef_outline = True

    font = subset.load_font(str(ROOT / source), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    subset.save_font(font, str(output), options)


def main():
    strict = "--strict" in sys.argv[1:]
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}

    pending = []
    for name, source, text_function in JOBS:
        text = text_function()
        sig = signature(source, text)
        if manifest.get(name, {}).get("signature") == sig and (OUTPUT_DIR / name).exists():
            continue
        pending.append((name, source, text, sig))

    if not pending:
        print("Font subsets are up to date.")
        return 0

    try:
        import fontTools  # noqa: F401
        import brotli  # noqa: F401
    except ImportError:
        message = (
            "fontTools and brotli are needed to rebuild the Chinese font subsets "
            "(pip install fonttools brotli)."
        )
        if strict:
            print(f"error: {message}", file=sys.stderr)
            return 1
        print(f"warning: {message} Keeping the existing subsets.", file=sys.stderr)
        return 0

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, source, text, sig in pending:
        output = OUTPUT_DIR / name
        build_subset(source, text, output)
        manifest[name] = {
            "source": source,
            "characters": len(set(text)),
            "bytes": output.stat().st_size,
            "signature": sig,
        }
        print(f"Built {output.relative_to(ROOT)}: {len(set(text))} characters, {output.stat().st_size / 1024:.0f} KB")

    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
