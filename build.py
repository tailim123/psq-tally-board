#!/usr/bin/env python3
"""
Bundle src/ into a single self-contained HTML file in dist/.

The venue may have no internet, so the built file inlines the stylesheets, the
script, the pixel font and the logo lockup. Nothing is fetched at runtime.

src/js/*.js are fragments of one closure, not standalone scripts. index.html
lists them in load order — that listing is the only place the order lives — and
this script concatenates them inside a single

    (function(){ "use strict"; ... })();

Each part also opens with its own "use strict"; so that Live Server, which loads
them as twelve separate scripts, runs them just as strictly as the built file
does. This script drops those duplicate directives, since the wrapper supplies
one. Without them development would be the more forgiving of the two, and a
mistake would surface first in the file that goes to the venue.

    python3 build.py

No dependencies beyond the standard library.
"""

import base64
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
DIST = ROOT / "dist"
OUT = DIST / "psq-tally-board.html"

MIME = {".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml"}

APP_BLOCK = re.compile(r"<!-- app:.*?-->(.*?)<!-- /app -->", re.S)
DIRECTIVE = re.compile(r'^\s*"use strict";[ \t]*\r?\n')


def data_uri(path: pathlib.Path) -> str:
    mime = MIME.get(path.suffix.lower(), "application/octet-stream")
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"


def inline_assets(css: str, css_dir: pathlib.Path) -> str:
    """Replace url(../assets/foo.png) with a base64 data URI."""

    def sub(m):
        raw = m.group(1).strip("'\"")
        if raw.startswith(("data:", "http:", "https:")):
            return m.group(0)
        target = (css_dir / raw).resolve()
        if not target.exists():
            sys.exit(f"  missing asset referenced by CSS: {raw}")
        print(f"    inlined {target.name} ({target.stat().st_size:,} bytes)")
        return f'url("{data_uri(target)}")'

    return re.sub(r'url\(\s*([^)]+?)\s*\)', sub, css)


def inline_scripts(html: str) -> str:
    """Replace the listed <script src> tags with one inlined closure."""
    m = APP_BLOCK.search(html)
    if not m:
        sys.exit("  no <!-- app: ... --> ... <!-- /app --> block in index.html")

    names = re.findall(r'<script src="([^"]+)"></script>', m.group(1))
    if not names:
        sys.exit("  the app block in index.html lists no scripts")

    parts = []
    for name in names:
        path = SRC / name
        if not path.exists():
            sys.exit(f"  index.html lists {name}, which does not exist")
        text = path.read_text(encoding="utf-8")
        text, dropped = DIRECTIVE.subn("", text, count=1)
        if not dropped:
            sys.exit(f'  {name} does not open with "use strict"; — see the note in this file')
        if "</script>" in text:
            sys.exit(f"  {name} contains a literal </script>, which would end the tag early")
        parts.append(text)
        print(f"    {name:<22} {text.count(chr(10)):>4} lines")

    stray = sorted(p.name for p in (SRC / "js").glob("*.js") if f"js/{p.name}" not in names)
    if stray:
        sys.exit(f"  src/js has files index.html does not list: {stray}")

    block = '<script>\n(function(){\n  "use strict";\n' + "".join(parts) + '})();\n</script>'
    print(f"    {len(parts)} parts -> one <script>")
    return html[: m.start()] + block + html[m.end():]


def main() -> None:
    html = (SRC / "index.html").read_text(encoding="utf-8")
    print("building…")

    for tag_id, filename in (("baseStyle", "styles/base.css"), ("dspStyle", "styles/display.css")):
        path = SRC / filename
        css = inline_assets(path.read_text(encoding="utf-8"), path.parent)
        pattern = re.compile(rf'<link id="{tag_id}"[^>]*>')
        if not pattern.search(html):
            sys.exit(f"  no <link id=\"{tag_id}\"> in index.html")
        # the app reads these two elements by id when it opens the audience
        # window, so the ids have to survive the bundling
        block = f'<style id="{tag_id}">\n{css}\n</style>'
        html = pattern.sub(lambda _m, b=block: b, html, count=1)
        print(f"    {filename} -> <style id=\"{tag_id}\">")

    html = inline_scripts(html)

    # checked before writing, so a failed build never leaves a broken artifact
    # behind. Only real tags in the markup, not tag strings the script builds at
    # runtime
    markup = html.split("<script>")[0]
    leftovers = re.findall(r'<(?:link|script)[^>]+(?:href|src)="(?!data:)([^"]+)"', markup)
    if leftovers:
        sys.exit(f"  built file would still point at external files: {leftovers}")

    DIST.mkdir(exist_ok=True)
    OUT.write_text(html, encoding="utf-8")

    print(f"\nwrote {OUT.relative_to(ROOT)}  ({OUT.stat().st_size / 1024:.0f} KB)")
    print("Self-contained — copy it anywhere, no internet needed.")


if __name__ == "__main__":
    main()
