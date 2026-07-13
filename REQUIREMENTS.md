# JUFO Scholar — Requirements

Status: draft, reverse-engineered from the existing codebase (v1.4.3) since the
project never had a written spec. Intended as (a) a baseline description of
current behavior worth preserving, and (b) requirements for the next round of
work, chiefly replacing the static JUFO data snapshot with the JUFO API.

## 1. Background

JUFO Scholar is a Firefox extension that annotates Google Scholar profile and
search-result pages with [JUFO](https://jufo.fi) (Julkaisufoorumi / Publication
Forum) ranking information for each publication's venue.

JUFO data is currently bundled as a static file (`jufo-data.json`, ~1 MB,
27 000+ entries) built by `build-data.py` from manually downloaded CSV exports
(one per field panel, from jufo.fi/en/sources). This means the data goes stale
between manual rebuilds and someone has to remember to re-download 20+ CSVs.
JUFO also exposes an API; the main driver for this requirements pass is
evaluating a move from the static snapshot to that API. A Chrome/Chromium
port is a stated future goal but explicitly out of scope for this
iteration — see [§10](#10-future-phase-chromechromium-port).

## 2. Domain model

- JUFO rates *publication channels* (journals, conference series, book
  publishers), not individual papers. A paper's JUFO level is the level of
  the channel it was published in.
- **Level 3** — leading international forum (best).
- **Level 2** — good, established forum.
- **Level 1** — basic/emerging level ("lite ditåt" — recognized but entry-level).
- **Level 0** — channel is in JUFO's system but explicitly rated as not
  meeting the bar for levels 1–3 ("muut tunnistetut julkaisukanavat" / "other
  identified publication channels" — a real, deliberate rating, not an
  absence of data). **Verified against the live API on 2026-07-13: still
  very much in active use** (e.g. JUFO_ID 80500, 82000, 70500 all currently
  return `"Level":"0"`) — see §3 for how this was confirmed.
- **Non-ranked** — the channel is registered/identified in JUFO's database
  but has never been assigned any tier at all, not even 0. **Verified**: in
  the current bulk export this is represented as `Level:""` (empty string),
  distinct from both a real level and from level "0", and accounts for
  ~2 525 of 42 670 channels (≈6%), skewed toward book publishers that JUFO
  tracks but hasn't evaluated yet.
- **Not in JUFO at all** — the channel doesn't exist as a JUFO_ID in the
  database, i.e. it was never registered/identified in the first place. This
  is a fourth, separate case from all three above, and is what a failed
  name-match today collapses into "JUFO ?" together with genuine API/network
  matching failures (see [§6 Known issues, 6.1](#61-level-0-vs-not-found-vs-non-ranked)).
- Data is republished under CC-BY 4.0 by Julkaisufoorumi for the CSV/export
  route; the API's own terms of use were not stated on the documentation page
  and should be confirmed (see [open question 7.4](#7-open-questions)).
- JUFO's own model above (`Level`) is not the only national ranking the API
  exposes: channel records also carry **Norway's** (`Norway_Level`) and
  **Denmark's** (`Denmark_Level`) rankings, from those countries'
  independent evaluation panels. These disagree with Finland's rating on a
  substantial share of channels — see FR-11.
  **Correction (per direct domain feedback, supersedes the "scale 0-2"
  claim in earlier drafts of this document):** Norway's real graded tiers
  are only **1** and **2** — there is no genuine "level 0" the way Finland
  has one. Norway instead flags predatory venues as a separate category,
  "X", which does not appear to be distinguished from a real level in the
  raw `Norway_Level` field we've observed (`"0"`/`"1"`/`"2"`/`""`) — the
  raw `"0"` value likely *is* that predatory flag, not a graded rating, but
  this hasn't been confirmed against JUFO/CSC directly. Badge/color logic
  should treat Norway's `0` as "unclassified/not a real tier" rather than
  as equivalent to Finland's genuine level 0, until this is confirmed (see
  [open question 7.10](#8-open-questions)).

## 3. Current functionality (baseline)

### 3.1 Pages supported
- Google Scholar **profile** pages (`scholar.google.com/citations*`).
- Google Scholar **search** pages (`scholar.google.com/scholar*`).

### 3.2 Venue resolution
- Venue name is extracted from the DOM (profile: second `.gs_gray` span in
  the row; search: parsed out of the `.gs_a` byline between en-dash and
  hyphen separators).
- Extracted names are cleaned with a heuristic regex pipeline
  (`cleanVenueName`) that strips ordinals, "Proceedings of the", trailing
  parenthetical abbreviations, trailing years, etc.
- Truncated names (ending in `…`) are resolved via a CrossRef lookup using
  the paper title before venue matching is attempted.
- Cleaned names are matched against `jufo-data.json` via `lookupVenueRaw`,
  which tries: exact key, `"conference on " + key`, `"proceedings of the " +
  key`, an accent-stripped/ampersand-normalized form, an "Annual"-stripped
  form, a "The"-prepended/stripped form, and a colon-inserted sub-journal
  form (e.g. "The Lancet Digital Health" → "the lancet : digital health").
- User-defined **custom mappings** (Scholar venue name → JUFO entry name) are
  checked first, ahead of the heuristics above. A bundled
  `default-mappings.json` seeds known problem cases (e.g. PMLR, CVPR) on
  first install.
- If nothing matches, a **CrossRef API** lookup (`api.crossref.org`) is
  attempted automatically using the paper title, extracting `event.name` or
  `container-title` as a candidate venue name, which is then re-run through
  the same matching pipeline.
- If a venue still can't be resolved, the row gets a "JUFO ?" badge that the
  user can click to force a manual CrossRef retry.

### 3.3 Badges
- Each row gets a badge showing `JUFO 3` / `JUFO 2` / `JUFO 1` / `JUFO 0` /
  `JUFO ?` (not found) / `JUFO …` (pending), color-coded, with a tooltip
  showing the matched venue name.
- Rows/cards with level 2 or 3 get a highlighted left border and background.

### 3.4 Filter bar
- Injected above the results table/list on both page types.
- **Min JUFO level** filter: Any / 0+ / 1+ / 2+ / 3.
- **Author position** filter (profile pages only): Any / First / Last /
  First-or-last. Requires resolving full author lists for rows where
  Scholar's author string is truncated (fetches the paper detail page).
- Live count of shown/total rows.

### 3.5 Sort
- "Sort by JUFO" button reorders rows/cards by level descending (profile:
  moves `.gsc_a_tr` rows within `#gsc_a_b`; search: moves `.gs_r.gs_or` cards
  within `#gs_res_ccl_mid`). Disabled until initial lookups resolve.

### 3.6 Summary box (profile pages only)
- Injected into the sidebar (`#gsc_rsb`).
- Shows counts of level 1/2/3 publications broken down by first-author vs
  last-author, recomputed (debounced) whenever badges update.
- Note in UI that counts are only complete once all articles are loaded
  (Scholar profile pages paginate via "Show more").

### 3.7 Author position detection
- Surname extraction handles common infix particles (van, von, de, du, la,
  etc.) so as not to misidentify surnames in names like "van der Berg".
- Falls back to fetching the full paper detail page when the author list is
  truncated on the listing page.

### 3.8 Custom mapping editor (popup)
- Toolbar popup lists current custom mappings (Scholar name → JUFO name),
  supports adding and deleting entries.
- Mappings are stored in `browser.storage.local` and pushed to the
  background script via a `MAPPINGS_UPDATED` message so lookups pick them up
  without a reload.

### 3.9 Dynamic content handling
- A `MutationObserver` watches for newly added rows (profile "Show more",
  search pagination) and runs the same pipeline on them incrementally.

### 3.10 Architecture
- Manifest V2, Firefox-only (`browser_specific_settings.gecko`), min version
  142.0, also targets `gecko_android`.
- Non-persistent background script holds the loaded JUFO dataset and custom
  mappings in memory; content script communicates via
  `browser.runtime.sendMessage`.
- Permissions: `storage`, Scholar origins, `api.crossref.org`.
- No analytics/telemetry; `data_collection_permissions` declared as `none`.

## 4. Known issues in current implementation

### 4.1 Level 0 vs "not found" vs non-ranked
The extension currently has exactly two "no confident level" outcomes:
`jufo-0` (rendered when the matched entry's stored level is `0`) and
`jufo-none`/"JUFO ?" (rendered when no entry matched at all — which conflates
*"this venue isn't a real match"* with *"this venue was never evaluated by
JUFO"*). Per the domain model (§2), these are three distinct real-world
states — level 0, non-ranked, and match failure — but the code and the CSV
pipeline only carry a single integer level per venue, so "non-ranked" and
"match failure" are indistinguishable from each other, and both look
different from a genuine level-0 rating only by accident of whether a row
happens to exist in the dataset. This should be resolved as part of the API
migration (see [FR-9](#fr-9-tri-state-result-level-0-vs-non-ranked-vs-not-found)).

### 4.2 Matching fragility
Venue matching relies on a chain of hand-tuned regex heuristics
(`cleanVenueName`, `lookupVenueRaw`) built up incrementally to patch specific
observed mismatches (PMLR, CVPR, "Annual", "The Lancet : …", etc.), evidenced
by `default-mappings.json` existing purely as a workaround list. This is
brittle against new venues/name variants and hard to extend with confidence.
Past manual verification work that produced these heuristics was never
written down outside the code itself; see `KNOWN_CASES.md` (new as of this
requirements pass) for a human-readable log of specific cases going forward,
so future matching fixes aren't rediscovered from scratch.

### 4.3 Manual data freshness
`jufo-data.json` requires a human to re-download ~20+ CSVs from jufo.fi and
re-run `build-data.py` to refresh; the README documents this as the current
process and the data is dated "22 April 2026" in the bundled snapshot.

### 4.4 Data file size
`jufo-data.json` (~1 MB, 27 000+ entries) ships in the extension package and
is fetched in full on every background script cold start.

## 5. The JUFO REST API (verified 2026-07-13)

Source: [Julkaisukanavatietokannan REST-rajapinta](https://wiki.eduuni.fi/spaces/cscvirtajtp/pages/48922203/Julkaisukanavatietokannan+REST-rajapinta)
(CSC – IT Center for Science, on behalf of Julkaisufoorumi). Facts below were
independently confirmed with live requests against the production API rather
than taken solely from the wiki page — the page turned out to contain at
least two inaccuracies (noted below), so treat unverified claims from it with
caution.

- **Base URL:** `https://jufo-rest.csc.fi/`. Current stable version is
  **v1.1** (`/v1.1/...`). `v1.0` no longer serves `/kanava/{id}` (404) — don't
  target it. `v2.0` is mentioned on the wiki page but **does not exist yet**
  in production (confirmed 404 on `/v2.0/etsi.php`) — do not build against it.
- **Auth:** none. All endpoints are public, no API key.
- **CORS:** confirmed enabled — a live request with
  `Origin: https://scholar.google.com` got back
  `Access-Control-Allow-Origin: *`. Direct fetches from the content/background
  script are viable; no proxy needed.
- **Rate limits / ToS:** none documented on the wiki page. Still worth being a
  good citizen (see FR-6).

### 5.1 Endpoints

**`GET /v1.1/etsi.php`** — search. Query params: `nimi` (name), `issn`,
`isbn`, `lyhenne` (abbreviation), `tyyppi` (1=journal/series, 2=book
publisher, 3=conference). Returns a JSON array of `{Jufo_ID, Link, Name,
Type}`; `[]` with HTTP 200 if nothing matches.
- `issn` is an **exact match** — confirmed
  `?issn=0262-5253` returns exactly one channel. This is far more reliable
  than name matching wherever an ISSN is available (e.g. from CrossRef
  metadata).
- `lyhenne` is also effectively exact for known abbreviations — confirmed
  `?lyhenne=CVPR` resolves directly to "IEEE Computer society conference on
  computer vision and pattern recognition", i.e. the exact case
  `default-mappings.json` exists to hand-patch today.
- `nimi` is a **broad/fuzzy, tokenized OR search**, not a substring or
  prefix match — confirmed a multi-word query returned channels sharing no
  substring with the query at all. It needs client-side ranking/filtering to
  be usable directly; it is not a drop-in replacement for the current exact
  local dictionary lookup.

**`GET /v1.1/kanava/{JUFO_ID}`** — single channel by numeric ID. Returns a
JSON array with one full record (all fields listed in §3.2's model, e.g.
`Level`, `Name`, `ISSN1/2`, `Type`, `Active`, `Continues`/`Continued_by`,
per-year history `Jufo_2012`…`Jufo_2025`, etc.) — confirmed against
JUFO_ID 64592 ("Oxford journal of archaeology") live. `Level` is returned as
a **JSON string**, not a number (`"Level":"2"`), and needs parsing.
- Non-numeric ID → HTTP 404 (confirmed; the wiki page's claim of "400 Bad
  Request for bad parameters" does **not** match observed behavior).
- Well-formed but non-existent numeric ID → HTTP 404 with an **empty body**
  (confirmed against ID 99999999), not `[]`. Callers must handle this
  differently from the `[]`-on-200 "no match" case returned by `etsi.php`.

**`GET /v1.1/massa.json.zip`** — full nightly bulk export, zipped, ~4.1 MB
compressed (confirmed `Content-Length` and same-day `Last-Modified`,
i.e. it is genuinely refreshed nightly as documented). Contains a flat JSON
array of **42 670** channel records (counted from a live download), each with
the same field set as `/kanava/{id}` plus a few extra bookkeeping fields
(`Continues`, `Continued_by`, `Substitutive_Channel`, `Grounds_Removal`,
`ReEvaluation`). **No uncompressed `massa.json` endpoint exists** (confirmed
404) — a zip is the only option, meaning any client that consumes this
directly needs an unzip step (browsers have no native unzip; would require a
small JS zip library if done in the extension itself, or — more simply — done
by build/CI tooling outside the browser, see FR-8).
- **`Level` value distribution** in the live bulk export: `"1"`: 24 802,
  `"0"`: 11 078, `"2"`: 2 841, `"3"`: 1 424, `""` (empty): 2 525. No `null`
  values were observed anywhere, in the bulk file or in individual `/kanava`
  lookups — **this contradicts an initial (AI-summarized) reading of the
  wiki page claiming level `0` was retired in favor of `null` in 2026**; live
  data as of this writing clearly still uses `"0"` as a real, common value.
  Treat any future claim of a `null`-based scheme as needing re-verification
  against live data before being trusted.
- **272 of 42 365 unique names collide** across different `Jufo_ID`s in the
  bulk export (renames, successor journals, mergers) — the current
  `build-data.py` flattens by lowercased name and keeps `max(level)` per
  name, which silently merges these distinct channels together. The bulk
  data's `Continues`/`Continued_by`/`Substitutive_Channel` fields exist
  specifically to track this and should be used instead of a name-only key
  (see FR-9).

**`GET /v1.1/virta-additions-massa.json.zip`** — supplementary
JUFO_ID ↔ publication-identifier mapping table from the VIRTA service; not
explored in depth, likely irrelevant to this extension's venue-matching use
case.

## 6. Requirements for this iteration

### FR-1: Replace static snapshot with an automatically refreshed one, sourced from the JUFO API
Given `massa.json.zip` is the only bulk endpoint and requires an unzip step
the browser can't do natively, the recommended design is to **keep the
runtime architecture (a flat local JSON dictionary the background script
loads)** but **automate its generation from the live API** instead of the
current manual "download 20+ CSVs, run `build-data.py` by hand" process —
e.g. a small script/CI job that downloads and unzips `massa.json.zip` and
regenerates `jufo-data.json` on a schedule (nightly or weekly, matching the
API's own update cadence), committing/publishing the refreshed file for the
extension to pick up. This directly resolves [§4.3](#43-manual-data-freshness).
An alternative — fetching and unzipping `massa.json.zip` directly inside the
extension at runtime — is possible (CORS allows it) but adds a zip-decompression
dependency to the extension bundle for comparatively little benefit over a
scheduled rebuild; not recommended as the default approach.

### FR-2: Local caching layer
The background script SHALL continue to load a single local JSON dictionary
into memory (as today), now refreshed automatically per FR-1 rather than by
hand. Live per-venue API calls (`etsi.php`) are only needed for the CrossRef
fallback path (FR-5) and for occasional cache-miss lookups, not for every
page load — so no additional runtime caching layer beyond "the local
dictionary is current to within a day" is required for the common case.

### FR-3: Offline / API-unavailable fallback
Because the primary lookup path (FR-1/FR-2) is a locally-bundled/refreshed
file rather than a live call, the extension is inherently resilient to the
JUFO API being down — the worst case is a stale-by-a-few-days local file, not
a broken UI. The only *live* call in the hot path is the existing CrossRef
lookup (unchanged) and, if adopted, live `etsi.php`/`issn` calls in the
matching pipeline (FR-9). Those SHALL fail closed to today's "JUFO ?" /
click-to-retry behavior on network error, exactly as CrossRef failures do
today — no new fallback mechanism is needed beyond what already exists.

### FR-4: Preserve custom mapping override behavior
User-defined custom mappings SHALL continue to take precedence over
automatic matching, resolving to whatever key the new local dictionary uses
(see FR-9 on moving to `Jufo_ID`/ISSN-based keys rather than lowercased
names).

### FR-5: Preserve CrossRef fallback, upgraded to use ISSN when available
The existing CrossRef-based venue-name resolution for truncated/unmatched
venues SHALL continue to work as today. Additionally, since CrossRef's
`works` response commonly includes an `ISSN` array for journal articles,
the pipeline SHOULD attempt an exact `etsi.php?issn=` lookup first when an
ISSN is available (verified exact-match behavior, §5.1) before falling back
to the existing fuzzy name-cleaning heuristics — this sidesteps a large class
of the brittleness described in [§4.2](#42-matching-fragility) for any paper
whose venue has an ISSN.

### EXP-1: Title-first matching as the primary strategy (needs testing before it's a decided requirement)
Profile pages are a special case: the venue text there is whatever the
Scholar user typed or hand-edited when adding/correcting a citation, not
something Scholar itself parsed from the paper — so it's inherently less
trustworthy than the venue string on search-result pages (which Scholar's
own crawler produced). The paper *title* is comparatively much more stable
against manual mangling than the venue field.

The hypothesis worth testing: make **title → CrossRef exact-title match →
ISSN → exact `etsi.php?issn=` lookup** the *primary* matching path for every
row (profile pages especially), rather than only running CrossRef as today's
fallback for truncated/unmatched venues — falling back to today's local
venue-string heuristics only when CrossRef has no confident title match
(e.g. preprints or venues CrossRef doesn't index).

This is **not yet a decided approach** — it needs to be tried against a real
sample of profile pages before committing, specifically to check:
- **Hit rate:** what fraction of rows get a confident (exact-normalized-title)
  CrossRef match at all, vs. today's fallback-only usage.
- **Latency/cost:** a CrossRef call per row instead of per-unmatched-row is
  a meaningfully larger number of network requests per page load — measure
  whether this is still fast enough in practice.
- **False-match rate:** whether CrossRef's title search occasionally returns
  a same-titled-different-paper or wrong-venue result that would produce a
  wrong badge with higher apparent confidence than today's "not found" state
  — arguably worse than an honest "JUFO ?" since a wrong badge that looks
  authoritative can mislead more than a "no confident match" one.

If testing supports it, this changes FR-5 from "fallback for truncated
names" to "primary path, with local heuristics as the fallback" — but that
decision should wait for the test results.

### FR-6: Be a reasonable API citizen
No rate limit is documented, but per-page-load traffic to `jufo-rest.csc.fi`
SHOULD stay low by design (FR-1/FR-2 mean the common case makes zero live
calls per page load). Any live `etsi.php` calls (CrossRef-fallback path,
FR-5/FR-9) SHOULD stay batched to one request per unresolved venue, matching
today's pattern of one CrossRef call per unresolved row.

### FR-7: Attribution compliance
Wherever JUFO data is displayed, the extension SHALL continue to meet
Julkaisufoorumi's attribution requirements for redistributed data. The API's
own licensing terms weren't stated on the documentation page (see
[open question 7.3](#7-open-questions)) — confirm before shipping whether
API-sourced data carries the same CC-BY 4.0 terms as the CSV exports the
README currently cites, and update the README's licensing note accordingly.

### FR-8: Replace the manual CSV pipeline with an automated one
`build-data.py` (which currently expects hand-downloaded per-field CSVs)
SHALL be replaced by a script that downloads `massa.json.zip`, unzips it, and
regenerates `jufo-data.json` — run on a schedule (CI cron or similar) rather
than manually. Given §5.1's finding that 272 names collide across distinct
`Jufo_ID`s, the regeneration SHOULD key entries by a matchable identifier
(ISSN/abbreviation where present) rather than blindly flattening by
lowercased name and taking `max(level)` as today, to stop silently merging
distinct channels.

### FR-9: Tri-state result — level 0 vs. non-ranked vs. not found
Confirmed via live data (§5.1): the API already distinguishes these as
different `Level` values, so this is a straightforward mapping exercise, not
an open question. Badge labels are decided:
1. **Matched, explicit level 0–3** — `Level` is `"0"`, `"1"`, `"2"`, or
   `"3"` in the channel record. Render as today: `JUFO 0` / `JUFO 1` /
   `JUFO 2` / `JUFO 3`.
2. **Matched, but non-ranked** — `Level` is `""` (empty string) in the
   channel record: the channel exists in JUFO's database but has never been
   tiered. Renders as **`JUFO -`** — its own badge state, distinct from both
   a real level and from "not found"; it is a confident fact ("JUFO has this
   channel, un-tiered"), not a matching failure.
3. **Not found** — no `Jufo_ID` matches at all (empty `etsi.php` result, or
   no entry in the local dictionary). Keeps today's **`JUFO ?`** /
   click-to-retry behavior unchanged, since it may still mean either
   "genuinely never registered with JUFO" or "our matching failed to find an
   existing channel" — the API does not resolve that particular ambiguity,
   so it's honest to keep it as an uncertain state rather than asserting
   either interpretation confidently.

The UI (badge text/color, filter dropdown min-level options, and summary
box) SHALL be updated to add the new "non-ranked" state from case 2, wherever
the local dictionary carries it through.

### FR-10: No regression to existing UI features
Filtering, sorting, the profile summary box, and author-position detection
SHALL continue to work unchanged from the user's perspective — this is a
data-layer migration, not a UI redesign, except where FR-9 requires the one
new state to be surfaced.

### FR-11: Support switching the active ranking system (Finland / Norway; Denmark deferred)
**Status: implemented, Finland verified against real profiles, Norway not
yet manually verified.** The popup shows a warning note when Norway is
selected, pending that verification.

The JUFO API's channel records also carry Norway's and Denmark's national
publication-ranking levels (`Norway_Level`, `Denmark_Level`), not just
Finland's. Decision: add a single **active-system switch** (dropdown/toggle,
placement TBD — likely the filter bar or the toolbar popup) that changes
which system's level drives badges, the min-level filter, sorting, and the
profile summary box — i.e. one ranking is "live" at a time, the whole UI
reflects it, rather than showing three badges per row side by side.

Scope for this iteration is **Finland + Norway only**; Denmark is
deliberately deferred (see rationale below and [open question 7.9](#8-open-questions)).

- **Finland (`Level`)** and **Norway (`Norway_Level`)** are both present in
  the nightly bulk export (`massa.json.zip`) — confirmed by direct
  inspection of a live download. Both fit the existing FR-1/FR-2 design
  (local dictionary refreshed on a schedule, zero extra live calls) at no
  additional architectural cost.
- **Norway uses a different scale than Finland, and it's narrower than we
  first assumed**: the raw `Norway_Level` field takes values `"0"`/`"1"`/
  `"2"`/`""`, but per direct domain correction, Norway's only *real* graded
  tiers are **1 and 2** — raw `"0"` is not a genuine "level 0" the way
  Finland's is; Norway instead flags predatory venues as a separate "X"
  category, which the raw `"0"` value likely represents (unconfirmed — see
  [open question 7.10](#8-open-questions)). Badge colors (FR-9-adjacent):
  Norway's level 2 reuses Finland's level-3 color, Norway's level 1 reuses
  Finland's level-1 color — Finland's level-2 color has no Norway
  equivalent, since Norway only has two real tiers. The UI (badge palette,
  filter dropdown's max option, summary box breakdown) SHALL adapt its
  range to whichever system is active rather than assuming a fixed 0–3
  scale.
- The two systems **disagree often**: of 21,945 channels with both a
  Finnish and a Norwegian level set, ~23% (5,137) differ — e.g. IEEE CVPR is
  Finland level 2 but Norway level 1. This is expected (independent national
  panels) and confirms the feature has real value, not just cosmetic
  duplication.
- **Denmark (`Denmark_Level`) is a special case, deferred for now**:
  confirmed **absent entirely** from the bulk export (the key doesn't exist
  on any of 42,670 bulk records) but present with real values when a channel
  is fetched individually via `/kanava/{JUFO_ID}` (e.g. JUFO_ID 64592 has
  `Denmark_Level:"2"` there). There is no practical way to bulk-prefetch it
  for all ~42k channels (that's 42k individual HTTP requests, not a viable
  refresh-job operation). Supporting Denmark later would require a
  lazy-fetch-and-cache design — look up `Denmark_Level` via `/kanava/{id}`
  the first time a resolved channel is displayed in Denmark mode, then cache
  it locally — which is a meaningfully different (heavier, per-channel,
  per-installation) data path than Finland/Norway's "one shared local file"
  approach, and was decided as out of scope for this pass.

## 7. Non-functional requirements

- **Performance:** badge rendering must not visibly block page interaction;
  lookups should remain asynchronous and batched as today. FR-1/FR-2 mean
  the common-case page load makes zero live JUFO API calls, only local
  dictionary lookups — same performance envelope as today.
- **Privacy:** only venue names / paper titles (and, per FR-5, ISSNs already
  obtained from CrossRef) are sent to third-party APIs, consistent with the
  current `data_collection_permissions: none` declaration; no
  user-identifying data should be added to any request.
- **Browser support:** Firefox desktop + Android (`gecko_android`), Manifest
  V2, matching current `manifest.json` targeting — no change in scope
  expected from this migration alone.
- **Resilience:** a JUFO API outage should not make the extension appear
  broken (see FR-3) — the local-dictionary-first design means it can't, short
  of the outage also lasting through several scheduled refresh cycles.

## 8. Open questions

1. ~~What is the JUFO API's base URL, auth model, and rate limit?~~ Resolved
   — see §5 (`https://jufo-rest.csc.fi/v1.1/`, no auth, no documented rate
   limit).
2. ~~Does it support batch queries?~~ Resolved — no batch endpoint beyond the
   full nightly `massa.json.zip` dump; single-item lookups are one-at-a-time.
3. Are the API's terms of use/licensing the same CC-BY 4.0 as the CSV
   exports, or different (affecting FR-7)? Not stated on the wiki page —
   needs a direct check with CSC/Julkaisufoorumi before shipping.
4. Is there a lighter-weight way to get `massa.json` without the zip wrapper
   (e.g. by asking CSC), to simplify the automated-refresh tooling in FR-8?
5. How broad is `lyhenne` (abbreviation) coverage across conference venues —
   is it broad enough to shrink or replace `default-mappings.json`, or does
   it only cover a handful of well-known conferences like CVPR?
6. ~~What should the exact badge label for the new FR-9 "non-ranked"
   state be?~~ Resolved — `JUFO -`, distinct from `JUFO 0` (level 0) and
   `JUFO ?` (not found). Badge color still needs picking (see FR-9), but
   should visually read as more "neutral/unknown" than "negative", to avoid
   implying the channel was judged and rejected rather than simply untiered.
7. Should the refresh schedule (FR-8) be nightly (matching the API's own
   cadence) or less frequent (e.g. weekly) to reduce load/PR noise from
   auto-generated data commits?
8. Does title-first matching (EXP-1) actually improve on today's approach
   once tested against real profile pages, on hit rate, latency, and
   false-match rate — undecided until that test is run.
9. Should Denmark support (FR-11) eventually use a lazy-fetch-and-cache
   design, or is it worth asking CSC whether `Denmark_Level` could be added
   to `massa.json.zip` — deferred rather than answered for this iteration.
10. Does raw `Norway_Level:"0"` actually mean "predatory (category X)", as
    domain feedback suggests, or something else? If confirmed, should it get
    its own distinct badge/color (e.g. a warning treatment) instead of
    rendering as a plain `NO 0` — currently it falls back to the same grey
    "base" color as a non-graded value, which doesn't actively mislabel it
    as a real low tier, but also doesn't flag it as a predatory-venue
    warning either.

## 9. Out of scope (for this iteration)

- **Chrome/Chromium port** — a planned future phase, not abandoned (see §10),
  but explicitly not part of this iteration: ship the API migration and
  FR-11 on Firefox first.
- Manifest V3 migration — not needed for Firefox today, but see §10: it's
  effectively a prerequisite for the Chrome port later, since Chrome no
  longer accepts new Manifest V2 extensions.
- Changes to the CrossRef-based truncated-title/author resolution logic
  itself, beyond wiring its output into the new lookup path (FR-5).
- Denmark ranking support (see FR-11) — deferred until Finland/Norway
  switching has shipped and the lazy-fetch design question is resolved.

## 10. Future phase: Chrome/Chromium port

Noted as a stated goal for later, not for this iteration — recorded here so
current work doesn't have to guess at it, but without expanding this pass's
scope.

- **Manifest V3 is effectively required**: Chrome stopped accepting new
  Manifest V2 extensions in its Web Store, so the port isn't just "add a
  Chrome entry to `manifest.json`" — it needs the background script
  migrated from a persistent/event page (`background.scripts` +
  `persistent: false`, current `manifest.json`) to an MV3 service worker,
  which has a different lifecycle (can be killed/restarted between
  messages, so anything relying on in-memory state living across calls —
  e.g. `jufoData`/`customMappings` in `background.js` today — needs to
  tolerate being reloaded from storage rather than assuming it's always
  warm).
- **`browser.*` vs `chrome.*` namespace**: all current code
  (`content.js`, `background.js`, `popup.js`) uses the `browser.*`
  WebExtensions API, which Chrome doesn't natively support (Chrome uses
  `chrome.*`, callback-based unless wrapped). A cross-browser build would
  need either the `webextension-polyfill` library or an explicit
  `chrome.*`-based fork of the messaging/storage calls.
- **No action needed now** — this is purely a forward-looking note so that,
  when the Chrome port is picked up, it isn't a surprise how much of the
  current architecture (manifest, background script lifecycle, API
  namespace) needs to change. Nothing in FR-1 through FR-11 should be
  designed around Chrome compatibility at this stage; keep building for
  Firefox as today.
