"""
Stage a browser-specific build of the extension into build/<target>/.

Both Firefox and Chrome require the manifest file to be literally named
manifest.json inside the folder you point them at, so this repo keeps two
source manifests (manifest.firefox.json, manifest.chrome.json) and copies
the right one into place per target rather than keeping a single ambiguous
manifest.json at the repo root. Everything else is shared source, copied
as-is — see REQUIREMENTS.md §10 for why the manifests have to differ
(Manifest V2 vs V3) while the rest of the code doesn't.

Usage:
  python package.py            # builds build/firefox/ and build/chrome/
  python package.py firefox    # just one target
  python package.py chrome
"""

import os
import shutil
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.join(ROOT, "build")

# Needed by both targets, copied unchanged.
SHARED_FILES = [
    "background.js",
    "content.js",
    "popup.html",
    "popup.js",
    "jufo-refresh.js",
    "jufo-data.json",
    "default-mappings.json",
    "LICENSE",
]
SHARED_DIRS = ["icons", "lib"]

TARGETS = {
    "firefox": {
        "manifest": "manifest.firefox.json",
        "extra_files": [],
    },
    "chrome": {
        "manifest": "manifest.chrome.json",
        # The MV3 service-worker entry point (importScripts shim) — see
        # background.chrome.js. Not used by Firefox's MV2 background page.
        "extra_files": ["background.chrome.js"],
    },
}


def build(target):
    config = TARGETS[target]
    out_dir = os.path.join(BUILD_DIR, target)
    if os.path.exists(out_dir):
        shutil.rmtree(out_dir)
    os.makedirs(out_dir)

    for name in SHARED_FILES + config["extra_files"]:
        shutil.copy2(os.path.join(ROOT, name), os.path.join(out_dir, name))
    for name in SHARED_DIRS:
        shutil.copytree(os.path.join(ROOT, name), os.path.join(out_dir, name))

    shutil.copy2(os.path.join(ROOT, config["manifest"]), os.path.join(out_dir, "manifest.json"))
    print(f"Built {out_dir}")


def main():
    targets = sys.argv[1:] or list(TARGETS.keys())
    for target in targets:
        if target not in TARGETS:
            print(f"Unknown target: {target!r} (expected 'firefox' or 'chrome')")
            sys.exit(1)
    for target in targets:
        build(target)


if __name__ == "__main__":
    main()
