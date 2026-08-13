# Chrome Web Store listing draft — JUFO Scholar

Copy-paste source for the Chrome Web Store Developer Dashboard. Field names
below match the general shape of the current dashboard (Store Listing /
Privacy practices / Distribution tabs); exact wording can shift between
Google's UI revisions — tell me what you see and I'll map it to the right
section if it doesn't match 1:1.

## Before you start
- **One-time $5 registration fee** to create a Chrome Web Store developer
  account (if you haven't already), paid via Google's Developer Dashboard.
- Google may ask for **publisher identity verification** on a first
  submission (individual vs. organization, possibly a phone/contact check).
  This is a manual step only you can complete.
- **Privacy policy URL (required)** — Chrome requires a live, publicly
  reachable link, unlike AMO's in-form questionnaire. Use the GitHub-rendered
  view of the file I drafted, once it's pushed:
  `https://github.com/Trinli/jufo-scholar/blob/master/PRIVACY.md`

## Item package
Upload: `build/web-ext-artifacts/jufo-scholar-chrome-1.5.2.zip`

## Store listing tab

**Name:** JUFO Scholar

**Summary** (132 char limit):
Shows JUFO publication-forum ranking badges on Google Scholar profile and
search pages.

**Description:**
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
- Custom venue-name mappings (editable from the toolbar popup), with a
  bundled set of common defaults (e.g. PMLR, CVPR)
- Background data refresh: the bundled venue database updates itself daily
  from the JUFO API — no reinstall needed to get current rankings

JUFO channel data is Julkaisufoorumi's, republished here under CC-BY 4.0.
This extension is not affiliated with Julkaisufoorumi, CSC, or Google.

**Category:** closest available match — likely "Productivity" or "Tools"
(pick whichever the current category list actually offers; I'm not certain
of Google's exact current category names).

**Language:** English

**Icon:** `icons/icon-128.png`

**Screenshots:** `screenshots/chrome-store/screenshot-1-profile-badges.png`
(1280x800, alpha-stripped — meets the spec). Only one is ready; consider
adding 2-3 more later (popup mapping editor, Finland/Norway switch) — not
required for submission.

## Privacy practices tab

**Single purpose description:**
Displays JUFO and Norwegian national publication-forum ranking badges on
Google Scholar profile and search-result pages, based on the venue of each
publication shown.

**Permission justifications** (one text box per requested permission):
- `storage` / `unlimitedStorage` — caches the JUFO venue ranking database
  (~5MB) and user-defined custom venue-name mappings locally, so lookups
  work without a network call on every page view.
- `alarms` — schedules a once-daily background check that refreshes the
  local venue database from the JUFO API.
- **Host permissions** (`scholar.google.com`, `scholar.googleusercontent.com`,
  `api.crossref.org`, `jufo-rest.csc.fi`): `scholar.google.com` and
  `scholar.googleusercontent.com` are where the extension reads publication/
  venue text and injects ranking badges — its core function. `api.crossref.org`
  and `jufo-rest.csc.fi` are the two lookup APIs used to resolve venues and
  retrieve ranking data.

**Are you using remote code?** No — all executed code ships inside the
package; the extension only fetches data (JSON), never scripts, from the
network.

**Data usage disclosures** (check the boxes that reflect actual behavior):
- **Website content** — Yes, collected: the extension reads publication
  venue names and paper titles from the Google Scholar page being viewed,
  in order to look up their ranking. This is used solely to provide the
  extension's core functionality.
- All other categories (personally identifiable info, health info, financial
  info, authentication info, personal communications, location, web history,
  user activity) — No.
- "Used for purposes unrelated to the item's core functionality" — No.
- "Used to determine creditworthiness or for lending purposes" — No.
- "Data sold to third parties" — No.
- "Data transferred to third parties" — Yes, limited to: venue names/paper
  titles/ISSNs sent to `api.crossref.org` and `jufo-rest.csc.fi` solely to
  perform the ranking lookup described above — no identifying information.

**Privacy policy URL:**
`https://github.com/Trinli/jufo-scholar/blob/master/PRIVACY.md`
(only live once `PRIVACY.md` is committed and pushed — not done yet, see
below)

## Distribution tab
- Visibility: **Public**
- Regions: all regions (default), unless you want to restrict it

## After submitting
Review timing for Chrome Web Store varies more than AMO's, especially for a
first-time developer account and an extension using host permissions —
commonly anywhere from a few hours to a couple of weeks. No action needed
on your end while it's in review; I'll help interpret any policy-violation
emails if Google sends one back with requested changes.
