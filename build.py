#!/usr/bin/env python3
"""
Bundle src/ into a single self-contained HTML file in dist/.

The venue may have no internet, so the built file inlines the stylesheets,
the script, the pixel font and the logo lockup. Nothing is fetched at runtime.

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

    js = (SRC / "app.js").read_text(encoding="utf-8")
    if "</script>" in js:
        sys.exit("  app.js contains a literal </script>, which would end the tag early")
    block = f"<script>\n{js}\n</script>"
    html = re.sub(r'<script src="app\.js"></script>', lambda _m: block, html, count=1)
    print("    app.js -> <script>")

    DIST.mkdir(exist_ok=True)
    OUT.write_text(html, encoding="utf-8")

    # only check real tags in the markup, not tag strings the script builds at runtime
    markup = html.split("<script>")[0]
    leftovers = re.findall(r'<(?:link|script)[^>]+(?:href|src)="(?!data:)([^"]+)"', markup)
    if leftovers:
        sys.exit(f"  built file still points at external files: {leftovers}")

    print(f"\nwrote {OUT.relative_to(ROOT)}  ({OUT.stat().st_size / 1024:.0f} KB)")
    print("Self-contained — copy it anywhere, no internet needed.")


if __name__ == "__main__":
    main()
