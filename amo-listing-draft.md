# AMO listing draft — JUFO Scholar

Copy-paste source for the "listed" distribution fields on addons.mozilla.org.
Not part of the extension package — delete or keep out of `package.py`'s
copy list once the listing is submitted.

## Name
JUFO Scholar

## Summary (short blurb, AMO limit ~250 chars)
Shows JUFO publication-forum ranking badges (and Norway's equivalent ranking)
on Google Scholar profile and search pages, so you can see a venue's
standing at a glance.

## Description (long, supports basic formatting on AMO)
JUFO Scholar annotates Google Scholar profile and search-result pages with
colour-coded badges showing each publication venue's JUFO (Julkaisufoorumi /
Finnish Publication Forum) ranking level.

Each row gets a badge:
- JUFO 3 (magenta) — leading international forum
- JUFO 2 (blue) — good, established forum
- JUFO 1 (light blue) — basic/emerging level forum
- JUFO 0 (grey) — identified by JUFO but rated below level 1
- JUFO - (grey) — registered with JUFO but never tiered (non-ranked)
- JUFO ? (grey) — venue not found — click to retry via a CrossRef lookup

Hovering a badge shows the matched venue name. The extension also supports
switching to Norway's national publication ranking for the same channels
(badges relabel to NO 2 / NO 1 / etc.) via the toolbar popup.

Additional features:
- Min-level filter and "sort by JUFO" on both profile and search pages
- Profile-page summary box: publication counts by level, broken down by
  first- vs. last-author position
- Custom venue-name mappings (editable from the toolbar popup) for venues
  Scholar's text doesn't match automatically, with a bundled set of common
  defaults (e.g. PMLR, CVPR)
- Background data refresh: the bundled venue database updates itself daily
  from the JUFO API — no reinstall needed to get current rankings

JUFO channel data is Julkaisufoorumi's, republished here under CC-BY 4.0.
This extension is not affiliated with Julkaisufoorumi, CSC, or Google.

## Category
Search Tools (alternate: Productivity)

## Tags
academic, research, google-scholar, citations, publications, ranking

## Homepage / Support
- Support email: optional, and it's publicly shown on the listing page (not
  your private account login email) — leave blank unless you want a public
  contact address. If you do, prefer a dedicated address over a personal one.
- Support website: optional alternative to an email — a link to the GitHub
  repo's Issues page works well, if the repo is public.
- Homepage URL: <link to the GitHub repo, only if it's public — check
  visibility before adding this>

## License (code)
CC0 1.0 Universal (matches `jufo-scholar/LICENSE`). Note in the description
or a "Notes to reviewer" field, if offered, that the bundled JUFO ranking
*data* (`jufo-data.json`, `default-mappings.json`) is Julkaisufoorumi's own
data, republished under CC-BY 4.0 — a separate license from the CC0 code.

## Data collection questionnaire
- Declares no data collection (`data_collection_permissions: required:
  ["none"]` already set in the manifest).
- Honest supplementary note if AMO's form asks for detail: the extension
  sends publication venue names, paper titles, and (when available) ISSNs to
  two third-party APIs — `api.crossref.org` (venue-name resolution) and
  `jufo-rest.csc.fi` (the JUFO ranking data source) — to look up ranking
  information. No user-identifying data (name, email, IP-linked identity,
  browsing history) is transmitted or stored.

## Permission justifications (per host_permission / permission)
- `https://scholar.google.com/*` — where badges, filters, and the summary
  box are injected (the extension's core content-script target).
- `https://scholar.googleusercontent.com/*` — Scholar's own asset host;
  needed alongside the main Scholar origin for pages to render/behave
  correctly.
- `https://api.crossref.org/*` — fallback lookup to resolve a venue name or
  ISSN when the Scholar page text alone doesn't match the local JUFO
  database.
- `https://jufo-rest.csc.fi/*` — the JUFO REST API itself: source of the
  ranking data the extension displays, and of the daily background refresh.
- `storage` / `unlimitedStorage` — caches the JUFO venue database (~5MB)
  and user-defined custom mappings locally, so lookups work offline/fast
  and don't require a live API call on every page load.
- `alarms` — schedules the once-daily background check that refreshes the
  local venue database from the JUFO API.

## Source code note (if AMO asks about minified/machine-generated code)
`lib/browser-polyfill.min.js` and `lib/fflate.min.js` are vendored,
unmodified third-party libraries:
- webextension-polyfill — https://github.com/mozilla/webextension-polyfill
- fflate — https://github.com/101arrowz/fflate

All first-party code (`background.js`, `content.js`, `popup.js`,
`jufo-refresh.js`) is plain, unminified, unbundled JavaScript — readable
directly in the submitted package, no separate source upload needed for it.

## Icon
`icons/icon-128.png` (already exists, correct size/format for the listing
icon — the in-package runtime icon stays `icon.svg`, this is only for the
AMO store page).

## Screenshots
Only one exists today: `screenshots/Screenshot 2026-07-19 at 17.01.04.png`.
Recommend capturing 2-3 more before/soon after submitting — not required,
but a single-screenshot listing looks sparse next to comparable extensions:
- A Google Scholar profile page with JUFO badges visible
- The toolbar popup (custom mapping editor / Finland-Norway switch)
- The min-level filter bar and/or the profile summary box
