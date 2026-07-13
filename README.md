# JUFO Scholar

A Firefox extension that shows publication-forum ranking levels as coloured
badges on Google Scholar profile and search pages, sourced live from the
[JUFO REST API](https://jufo-rest.csc.fi/) (Julkaisufoorumi / Publication
Forum, maintained by CSC – IT Center for Science). Channel data is
Julkaisufoorumi's, republished here under CC-BY 4.0
(https://julkaisufoorumi.fi/fi/julkaisufoorumi/tietoa-julkaisufoorumifi-sivustosta).

## What it does

Each publication row gets a badge:

| Badge | Meaning |
|-------|---------|
| **JUFO 3** (magenta) | Leading international forum |
| **JUFO 2** (blue) | Good forum |
| **JUFO 1** (light blue) | Basic level forum |
| **JUFO 0** (grey) | Identified by JUFO but rated below level 1 |
| **JUFO -** (grey) | Registered with JUFO but never tiered (non-ranked) |
| **JUFO ?** (grey) | Venue not found at all — click to retry via CrossRef |

Hovering a badge shows the matched venue name. Clicking a **JUFO ?** badge triggers a manual CrossRef lookup for that paper.

Unresolved venues are automatically retried via the [CrossRef API](https://api.crossref.org) using the paper title to find the full conference/journal name; when CrossRef returns an ISSN, that's checked against JUFO's database first (an exact match), before falling back to name-based matching.

### Ranking system: Finland or Norway

The JUFO API also carries Norway's national ranking for the same channels
(a different evaluation panel, so it doesn't always agree with Finland's
rating). Click the toolbar button to switch between them — badges relabel
to **NO 2** / **NO -** / etc. under Norway, so it's always clear which
system a badge reflects. The switch applies live to any open Scholar tabs.
Denmark's ranking isn't supported yet (see `REQUIREMENTS.md`, FR-11).

## Installation

Download the latest version from the release-folder in this repository using Firefox. If installation does not start automatically, drag and drop downloaded file to Firefox. If the purple icon does not show up, the addon might need to be enabled. Open a tab and navigate to about:addons.
For development, load temporarily the development version:

1. Open `about:debugging` → *This Firefox* → *Load Temporary Add-on*
2. Select `manifest.json` from this directory

## Custom venue mappings

Some venues can't be resolved automatically — for example, papers published in *Proceedings of Machine Learning Research* may appear under a conference name on Scholar that doesn't match the JUFO entry.

Click the extension toolbar button to open the mapping editor. Add a mapping from the Scholar venue name to the corresponding JUFO entry name. Mappings are saved locally in your browser and applied immediately.

A set of default mappings is bundled with the extension and seeded on first install.

## Keeping the data current

The extension refreshes its own JUFO data in the background — no reinstall
needed. It checks daily and, when the local copy is more than 24h old,
fetches the JUFO API's nightly bulk export directly, so it stays current
even if you never update the extension itself. Click the toolbar button to
see when data was last refreshed or trigger a refresh manually.

`jufo-data.json` (bundled in the extension package) is only the first-run/
offline fallback, used before the first live refresh completes or if the
API is unreachable — it's never the primary source once a live refresh has
succeeded.

## Building the venue data

`jufo-data.json` is regenerated from the live JUFO API (no more manually
downloading CSV exports). To rebuild the bundled fallback snapshot, e.g.
before cutting a new release:

```
python build-data.py
```

This downloads the current bulk export directly from the API and writes a
fresh `jufo-data.json` in this directory. Pass a local `massa.json.zip` path
instead of hitting the network (useful offline or for testing):

```
python build-data.py path/to/massa.json.zip
```

The `jufo-data/` directory of hand-downloaded CSV exports is no longer used
by anything and can be ignored (left in place rather than deleted, in case
it's still useful as a historical snapshot).

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension manifest |
| `content.js` | Badge injection, CrossRef/ISSN lookups, ranking-system UI updates |
| `background.js` | Data loading, venue/ISSN lookup, message handling |
| `jufo-refresh.js` | Background live refresh from the JUFO API (fetch, unzip, transform) |
| `lib/fflate.min.js` | Vendored zip-decompression library used by `jufo-refresh.js` |
| `popup.html` / `popup.js` | Ranking-system switch, refresh status, custom mapping editor |
| `jufo-data.json` | Bundled first-run/offline fallback venue database |
| `default-mappings.json` | Bundled default custom mappings |
| `build-data.py` | Script to regenerate the bundled `jufo-data.json` from the API |
| `KNOWN_CASES.md` | Log of tricky/edge-case venues found during manual testing |
| `REQUIREMENTS.md` | Requirements baseline and planned future work |
