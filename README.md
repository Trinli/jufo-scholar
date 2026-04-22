# JUFO Scholar

A Firefox extension that shows [JUFO publication forum](https://jufo.fi) levels as coloured badges on Google Scholar profile and search pages.

## What it does

Each publication row gets a badge:

| Badge | Meaning |
|-------|---------|
| **JUFO 3** (deep blue) | Leading international forum |
| **JUFO 2** (blue) | Top-tier forum |
| **JUFO 1** (light blue) | Basic level forum |
| **JUFO 0** (grey) | Not rated |
| **JUFO ?** (grey) | Venue not found |

Hovering a badge shows the matched JUFO venue name. Clicking a **JUFO ?** badge triggers a manual CrossRef lookup for that paper.

Unresolved venues are automatically retried via the [CrossRef API](https://api.crossref.org) using the paper title to find the full conference/journal name.

## Installation

Install from [Firefox Add-ons](https://addons.mozilla.org) *(link pending)*, or load temporarily:

1. Open `about:debugging` → *This Firefox* → *Load Temporary Add-on*
2. Select `manifest.json` from this directory

## Custom venue mappings

Some venues can't be resolved automatically — for example, papers published in *Proceedings of Machine Learning Research* may appear under a conference name on Scholar that doesn't match the JUFO entry.

Click the extension toolbar button to open the mapping editor. Add a mapping from the Scholar venue name to the corresponding JUFO entry name. Mappings are saved locally in your browser and applied immediately.

A set of default mappings is bundled with the extension and seeded on first install.

## Building the venue data

The JUFO data is pre-built and included as `jufo-data.json`. To rebuild it from fresh CSV exports:

1. Download the publication channel CSV exports from [jufo.fi](https://jufo.fi/en/sources) (one per field panel)
2. Place all CSV files in a directory
3. Run:
   ```
   python build-data.py <path-to-csv-directory>
   ```
4. Copy the generated `jufo-data.json` into this directory

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension manifest |
| `content.js` | Badge injection and CrossRef lookups |
| `background.js` | JUFO data loading and venue lookup |
| `popup.html` / `popup.js` | Custom mapping editor UI |
| `jufo-data.json` | Compiled JUFO venue database (27 000+ entries) |
| `default-mappings.json` | Bundled default custom mappings |
| `build-data.py` | Script to rebuild `jufo-data.json` from CSV exports |
