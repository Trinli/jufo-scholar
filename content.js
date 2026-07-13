"use strict";

// ── Styles ───────────────────────────────────────────────────────────────────

const STYLE = `
.jufo-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  vertical-align: middle;
  white-space: nowrap;
  cursor: default;
}
.jufo-pending  { background: #eee; color: #888; }
.jufo-none     { background: #f0f0f0; color: #999; cursor: pointer; }
.jufo-none:hover { background: #e0e0e0; }
.jufo-unranked { background: #e5e7eb; color: #6b7280; }
/* Colored by rank within whichever system is active (see levelColorClass),
   not by the literal level number — Finland's 3 and Norway's 2 are both
   "top", and get the same color, even though the numbers differ. */
.jufo-base { background: #f1f5f9; color: #94a3b8; }
.jufo-mid  { background: #bfdbfe; color: #1e3a5f; }
.jufo-high { background: #3b82f6; color: #ffffff; }
.jufo-top  { background: #3730a3; color: #ffffff; }

#jufo-filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  padding: 6px 8px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 13px;
}
#jufo-filter-bar label { font-weight: 600; }
#jufo-filter-bar select { font-size: 13px; }
#jufo-count { color: #555; margin-left: auto; }
#jufo-sort-btn { font-size: 13px; padding: 2px 10px; cursor: pointer; }
#jufo-sort-btn:disabled { opacity: 0.45; cursor: default; }

#jufo-summary {
  display: block;
  margin-bottom: 10px;
  padding: 8px 10px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
  width: 100%;
}
#jufo-summary table { border-collapse: collapse; width: 100%; }
#jufo-summary th { font-weight: 600; padding: 2px 8px 4px 0; color: #555; text-align: center; }
#jufo-summary th:first-child { text-align: left; }
#jufo-summary td { padding: 2px 8px 2px 0; text-align: center; }
#jufo-summary td:first-child { text-align: left; }

.jufo-row-high { border-left: 3px solid #3b82f6; background: rgba(59, 130, 246, 0.05); }
.jufo-row-top  { border-left: 4px solid #3730a3; background: rgba(55, 48, 163, 0.08); }
`;

function injectStyles() {
  const el = document.createElement("style");
  el.textContent = STYLE;
  document.head.appendChild(el);
}

// ── Active ranking system (Finland / Norway) ─────────────────────────────────

let activeSystem = "fi"; // "fi" or "no" — kept in sync with the popup's setting

function systemLabel() {
  return activeSystem === "no" ? "NO" : "JUFO";
}

// Finland has 4 real tiers (0-3). Norway's real tiers are just 1 and 2 —
// its own "0" in the raw API data isn't a graded level the way Finland's
// 0 is (Norway instead flags predatory venues as a separate category "X",
// not currently surfaced as its own badge state — see REQUIREMENTS.md).
function maxLevel() {
  return activeSystem === "no" ? 2 : 3;
}

// Colors align by rank across systems, not by the literal number: Norway's
// level 2 reuses Finland's level-3 color (jufo-top) and Norway's level 1
// reuses Finland's level-1 color (jufo-mid) — Norway has no equivalent of
// Finland's level 2 (jufo-high), since it only has two real tiers.
const LEVEL_COLOR_CLASS = {
  fi: { 0: "jufo-base", 1: "jufo-mid", 2: "jufo-high", 3: "jufo-top" },
  no: { 1: "jufo-mid", 2: "jufo-top" },
};

function levelColorClass(level) {
  return LEVEL_COLOR_CLASS[activeSystem]?.[level] ?? "jufo-base";
}

// ── Page type ─────────────────────────────────────────────────────────────────

function getPageType() {
  return location.pathname.startsWith("/scholar") ? "search" : "profile";
}

// ── Shared venue name cleaning ────────────────────────────────────────────────

function cleanVenueName(text) {
  return text.trim()
    .replace(/&amp;/gi, "&")
    .replace(/^[A-Z][A-Za-z]*\s+['']?\d{2,4}[:\-]\s+(?:[Tt]he\s+)?/, "")
    .replace(/^[Ii]n\s+(?=[A-Z])/,"")
    .replace(/^[Pp]roceedings\s+of\s+(the\s+)?/i, "")
    .replace(/^\d{4}\s+(\d+\w+\s+)?/, "")   // strip leading year "2010 IEEE…" or "2010 10th …"
    .replace(/^\d+(?:st|nd|rd|th)\s+/i, "") // strip numeric ordinal "40th Conference…"
    .replace(/^(?:[A-Z][a-z]+tieth|[A-Z][a-z]+-(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth))\s+/i, "") // strip written ordinal "Forty-first …"
    .replace(/\s*\([^)]{1,10}\)\s*$/, "")   // strip trailing "(SDM)", "(ECML)", etc.
    .replace(/,.*$/, "")
    .replace(/\s+\d.*$/, "")
    .trim() || null;
}

// ── Profile page DOM helpers ──────────────────────────────────────────────────

function getProfileRows() {
  return Array.from(document.querySelectorAll("#gsc_a_b .gsc_a_tr"));
}

function getProfileVenueEl(row) {
  const grays = row.querySelectorAll(".gsc_a_t .gs_gray");
  return grays.length >= 2 ? grays[1] : null;
}

function getProfileVenueName(row) {
  if (row.dataset.jufoVenue !== undefined) return row.dataset.jufoVenue || null;
  const el = getProfileVenueEl(row);
  const name = el ? cleanVenueName(el.textContent) : null;
  row.dataset.jufoVenue = name ?? "";
  return name;
}

// ── Search page DOM helpers ───────────────────────────────────────────────────

function getSearchRows() {
  return Array.from(document.querySelectorAll("div.gs_ri"));
}

function getSearchVenueEl(row) {
  return row.querySelector(".gs_a");
}

function getSearchVenueName(row) {
  if (row.dataset.jufoVenue !== undefined) return row.dataset.jufoVenue || null;
  const el = getSearchVenueEl(row);
  if (!el) { row.dataset.jufoVenue = ""; return null; }
  // ".gs_a" text: "Authors – Venue, Year - domain.com" (en dash before venue, hyphen before domain)
  const parts = el.textContent.split(/[\u00A0\u0020]\u002D[\u00A0\u0020]/);
  const raw = parts.length >= 2 ? parts[1].trim() : "";
  if (!raw) { row.dataset.jufoVenue = ""; return null; }
  const name = cleanVenueName(raw);
  // Bare year means no venue (e.g. "Authors - 2020 - domain")
  if (!name || /^\d{4}$/.test(name)) { row.dataset.jufoVenue = ""; return null; }
  // Check truncation after cleaning so "Data Mining and …, 2020" → "Data Mining and …" is caught
  if (name.endsWith("…") || name.endsWith("...")) {
    row.dataset.jufoVenueTruncated = "1";
    return null; // fetchFullVenueName will set jufoVenue later
  }
  row.dataset.jufoVenue = name;
  return name;
}

async function fetchFullVenueName(row) {
  const titleEl = getPageType() === "search"
    ? row.querySelector(".gs_rt a, .gs_rt b")
    : row.querySelector(".gsc_a_t a");
  const title = titleEl?.textContent.trim();
  if (!title) { row.dataset.jufoVenue = ""; return null; }
  try {
    const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(title)}&rows=3&select=title,container-title,event,ISSN`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(resp.status);
    const data = await resp.json();
    const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-–—]/g, " ").replace(/\s+/g, " ").trim();
    const t = norm(title);
    for (const item of data.message?.items ?? []) {
      const itemTitle = norm(item.title?.[0] ?? "");
      if (itemTitle.length < t.length * 0.6) continue;
      if (itemTitle !== t) continue;
      // This is our best title match — capture its ISSN (if any) for an
      // exact JUFO lookup, independent of whether a usable venue name is
      // also found below (see resolveVenues / LOOKUP_ISSN).
      if (!row.dataset.jufoIssn) {
        const issn = item.ISSN?.[0];
        if (issn) row.dataset.jufoIssn = issn;
      }
      // Prefer event.name (gives specific conference) over container-title (may be a series like PMLR)
      const candidates = [item.event?.name, item["container-title"]?.[0]].filter(Boolean);
      for (const venue of candidates) {
        const name = cleanVenueName(venue);
        if (name) { row.dataset.jufoVenue = name; return name; }
      }
    }
  } catch (e) {
    console.warn("[JUFO Scholar] CrossRef lookup failed", e);
  }
  row.dataset.jufoVenue = "";
  return null;
}

// ── Venue resolution (ISSN-first, then name-based lookup) ───────────────────

// candidates: [{ row, name }] — name may be null/undefined for rows that
// only have an ISSN (captured by fetchFullVenueName) and no usable venue
// name. Resolves every row via setBadge(); never leaves a row pending.
async function resolveVenues(candidates) {
  const issnToRows = new Map();
  for (const { row } of candidates) {
    const issn = row.dataset.jufoIssn;
    if (issn) {
      if (!issnToRows.has(issn)) issnToRows.set(issn, []);
      issnToRows.get(issn).push(row);
    }
  }

  const resolvedRows = new Set();
  if (issnToRows.size > 0) {
    let issnResp;
    try { issnResp = await browser.runtime.sendMessage({ type: "LOOKUP_ISSN", issns: Array.from(issnToRows.keys()) }); }
    catch (e) { issnResp = null; }
    for (const [issn, rowsForIssn] of issnToRows) {
      const level = issnResp?.results?.[issn];
      if (level !== undefined) {
        for (const row of rowsForIssn) { setBadge(row, level); resolvedRows.add(row); }
      }
    }
  }

  const nameToRows = new Map();
  const unresolvedNoName = [];
  for (const { row, name } of candidates) {
    if (resolvedRows.has(row)) continue;
    if (!name) { unresolvedNoName.push(row); continue; }
    if (!nameToRows.has(name)) nameToRows.set(name, []);
    nameToRows.get(name).push(row);
  }
  unresolvedNoName.forEach((row) => setBadge(row, undefined));

  if (nameToRows.size === 0) return;
  let resp;
  try { resp = await browser.runtime.sendMessage({ type: "LOOKUP", venues: Array.from(nameToRows.keys()) }); }
  catch (e) {
    for (const rowsForVenue of nameToRows.values()) rowsForVenue.forEach((r) => setBadge(r, undefined));
    return;
  }
  for (const [venue, rowsForVenue] of nameToRows) {
    const level = resp?.results?.[venue];
    for (const row of rowsForVenue) setBadge(row, level);
  }
}

async function retryWithCrossRef(candidateRows) {
  const unmatched = candidateRows.filter((r) => r.dataset.jufoLevel === "not-found");
  if (unmatched.length === 0) return;
  const crossRefCandidates = [];
  for (const row of unmatched) {
    const name = await fetchFullVenueName(row);
    crossRefCandidates.push({ row, name });
  }
  await resolveVenues(crossRefCandidates);
}

// ── Routing helpers ───────────────────────────────────────────────────────────

function getRows() {
  return getPageType() === "search" ? getSearchRows() : getProfileRows();
}

function getVenueElForRow(row) {
  return getPageType() === "search" ? getSearchVenueEl(row) : getProfileVenueEl(row);
}

function getVenueNameForRow(row) {
  return getPageType() === "search" ? getSearchVenueName(row) : getProfileVenueName(row);
}

// ── Badge management ─────────────────────────────────────────────────────────

let _summaryTimer = null;
function scheduleSummaryUpdate() {
  if (getPageType() !== "profile") return;
  clearTimeout(_summaryTimer);
  _summaryTimer = setTimeout(updateSummaryBox, 400);
}

// level: undefined -> not found, null -> non-ranked, number -> a real level.
function setBadge(row, level) {
  let badge = row.querySelector(".jufo-badge");
  if (!badge) {
    badge = document.createElement("span");
    const venueEl = getVenueElForRow(row);
    if (!venueEl) return;
    venueEl.insertAdjacentElement("afterend", badge);
  }
  badge.className = "jufo-badge";
  const venueName = row.dataset.jufoVenue || "";

  if (level === undefined) {
    badge.classList.add("jufo-none");
    badge.textContent = "JUFO ?";
    badge.title = "Not found — click to look up via CrossRef" + (venueName ? ` · matched: ${venueName}` : "");
    badge.onclick = async (e) => {
      e.stopPropagation();
      delete row.dataset.jufoVenue;
      delete row.dataset.jufoIssn;
      badge.className = "jufo-badge jufo-pending";
      badge.textContent = "JUFO …";
      badge.onclick = null;
      const name = await fetchFullVenueName(row);
      await resolveVenues([{ row, name }]);
      applyFilter();
    };
  } else if (level === null) {
    badge.classList.add("jufo-unranked");
    badge.textContent = `${systemLabel()} -`;
    badge.title = "Registered with JUFO but not tiered" + (venueName ? ` · ${venueName}` : "");
  } else {
    badge.classList.add(levelColorClass(level));
    badge.textContent = `${systemLabel()} ${level}`;
    badge.title = `${activeSystem === "no" ? "Norway" : "JUFO"} level ${level}` + (venueName ? ` · ${venueName}` : "");
  }
  row.dataset.jufoLevel = level === undefined ? "not-found" : level === null ? "unranked" : String(level);

  // Highlight the full row for the top two ranks, whatever their numbers are
  // in the active system (see levelColorClass).
  const highlightEl = getPageType() === "search" ? (row.closest(".gs_r") ?? row) : row;
  highlightEl.classList.remove("jufo-row-high", "jufo-row-top");
  if (typeof level === "number") {
    const rankClass = levelColorClass(level);
    if (rankClass === "jufo-high") highlightEl.classList.add("jufo-row-high");
    if (rankClass === "jufo-top") highlightEl.classList.add("jufo-row-top");
  }

  if (typeof level === "number" && level >= 1) scheduleSummaryUpdate();
}

function setPending(row) {
  let badge = row.querySelector(".jufo-badge");
  if (!badge) {
    badge = document.createElement("span");
    const venueEl = getVenueElForRow(row);
    if (!venueEl) return;
    venueEl.insertAdjacentElement("afterend", badge);
  }
  badge.className = "jufo-badge jufo-pending";
  badge.textContent = "JUFO …";
  badge.title = "Looking up JUFO level…";
}

// ── Author position (profile pages only) ─────────────────────────────────────

// Used for resolveAuthorPosition batches so we don't fire a burst of
// simultaneous requests to Scholar's own citation-detail pages, which is
// what's likely to trip its rate limiter in the first place (see
// fetchFullAuthors).
const MAX_CONCURRENT_AUTHOR_FETCHES = 3;

// Runs fn over items with at most `limit` in flight at once, instead of
// Promise.all's unbounded concurrency.
async function mapWithConcurrency(items, limit, fn) {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

function normalizeStr(s) {
  return s.normalize("NFD").replace(/\p{Mn}/gu, "").toLowerCase();
}

const SURNAME_INFIXES = new Set([
  "van", "de", "den", "der", "von", "la", "le", "du", "di", "del",
  "te", "ten", "ter", "y", "af", "av", "da", "das", "dos", "des", "al"
]);

function extractSurname(nameStr) {
  const parts = normalizeStr(nameStr.trim()).split(/\s+/);
  if (parts.length === 0) return "";
  let i = parts.length - 1;
  // Walk backwards absorbing known infixes, but keep at least one word before (the first name)
  while (i > 1 && SURNAME_INFIXES.has(parts[i - 1])) i--;
  return parts.slice(i).join(" ");
}

function getProfileLastName() {
  const name = (document.querySelector("#gsc_prf_in")?.textContent.trim() ?? "")
    .replace(/,.*$/, "").trim();
  return extractSurname(name);
}

function isAuthorListTruncated(row) {
  const grays = row.querySelectorAll(".gsc_a_t .gs_gray");
  const text = grays[0]?.textContent ?? "";
  return text.includes("…") || text.includes("...");
}

// Scholar's own citation-detail pages occasionally rate-limit/error under
// the concurrent load these lookups create (see MAX_CONCURRENT_AUTHOR_FETCHES
// below). A single transient failure here used to be cached as "" (no
// author data) forever, permanently misclassifying that row's author
// position as "other" with no way to recover short of a page reload. This
// retries a few times first, and — if still failing — deliberately leaves
// dataset.jufoFullAuthors unset (instead of caching "") so a later call
// gets another chance instead of being stuck wrong forever.
async function fetchFullAuthors(row) {
  if (row.dataset.jufoFullAuthors !== undefined) {
    return row.dataset.jufoFullAuthors ? row.dataset.jufoFullAuthors.split("|") : null;
  }
  const link = row.querySelector(".gsc_a_t a");
  if (!link) { row.dataset.jufoFullAuthors = ""; return null; }

  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const resp = await fetch(link.href);
      if (!resp.ok) throw new Error(String(resp.status));
      const html = await resp.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      // The field *label* is localized to the profile's Scholar UI language
      // (e.g. "Tekijät" instead of "Authors" for hl=fi) so matching against
      // the English string "Authors" silently fails for non-English
      // profiles — every time, not just transiently, so retries never help.
      // The Authors field is reliably the *first* row in this table
      // regardless of language, so match by position instead.
      const value = doc.querySelector("#gsc_oci_table .gs_scl .gsc_oci_value")?.textContent.trim();
      if (value) {
        const authors = value.split(",").map((a) => a.trim());
        row.dataset.jufoFullAuthors = authors.join("|");
        return authors;
      }
      // Page loaded fine but had no fields at all — nothing to retry.
      row.dataset.jufoFullAuthors = "";
      return null;
    } catch (e) {
      if (attempt === MAX_ATTEMPTS) {
        console.warn("[JUFO Scholar] failed to fetch paper detail after retries, will retry on next update instead of guessing", e);
        return null; // not cached — see comment above
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

function authorPosition(authors, lastName) {
  if (!authors || authors.length === 0) return "other";
  const first = extractSurname(authors[0]) === lastName;
  const last  = extractSurname(authors[authors.length - 1]) === lastName;
  return first && last ? "both" : first ? "first" : last ? "last" : "other";
}

async function resolveAuthorPosition(row, lastName) {
  if (row.dataset.jufoAuthor !== undefined) return row.dataset.jufoAuthor;
  if (isAuthorListTruncated(row)) {
    const authors = await fetchFullAuthors(row);
    if (authors === null && row.dataset.jufoFullAuthors === undefined) {
      // fetchFullAuthors gave up after retries without caching a result —
      // return a best-effort "other" for this call, but don't lock it in,
      // so a later resolve pass (filter change, system switch, next
      // summary update) gets a fresh chance instead of staying wrong.
      return "other";
    }
    row.dataset.jufoAuthor = authorPosition(authors, lastName);
  } else {
    const grays = row.querySelectorAll(".gsc_a_t .gs_gray");
    const authors = (grays[0]?.textContent.trim() ?? "").split(",").map((a) => a.trim());
    row.dataset.jufoAuthor = authorPosition(authors, lastName);
  }
  return row.dataset.jufoAuthor;
}

// ── Filter bar ───────────────────────────────────────────────────────────────

let filterMinLevel = -1;
let filterAuthor = "any";

// [-1,"Any"],[0,"0+"],[1,"1+"],...,[maxLevel,"maxLevel"] — adapts to however
// many real tiers the active system has (Finland: 0-3, Norway: 0-2).
function minLevelOptions() {
  const max = maxLevel();
  const opts = [[-1, "Any"]];
  for (let lvl = 0; lvl < max; lvl++) opts.push([lvl, `${lvl}+`]);
  opts.push([max, String(max)]);
  return opts;
}

function populateMinLevelSelect(select) {
  select.innerHTML = "";
  for (const [value, text] of minLevelOptions()) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = text;
    select.appendChild(opt);
  }
  // Reset to "Any" if the previous selection no longer exists in this
  // system's range (e.g. "3" selected, then switched to Norway which tops
  // out at 2).
  if (filterMinLevel > maxLevel()) filterMinLevel = -1;
  select.value = String(filterMinLevel);
}

// Rebuilds parts of the filter bar that depend on the active system
// (currently just the min-level options and its label) without touching
// the rest of the bar or its listeners.
function refreshFilterBarForSystem() {
  const minLabel = document.querySelector('label[for="jufo-min-level"]');
  if (minLabel) minLabel.textContent = `Min ${systemLabel()} level:`;
  const minSelect = document.getElementById("jufo-min-level");
  if (minSelect) populateMinLevelSelect(minSelect);
}

function injectFilterBar() {
  if (document.getElementById("jufo-filter-bar")) return;

  let anchor = null;
  if (getPageType() === "profile") {
    anchor = document.getElementById("gsc_a_b");
    if (!anchor) return;
  } else {
    anchor = document.querySelector("div.gs_ri")?.closest(".gs_r");
    if (!anchor) return;
  }

  const bar = document.createElement("div");
  bar.id = "jufo-filter-bar";

  const minLabel = document.createElement("label");
  minLabel.htmlFor = "jufo-min-level";
  minLabel.textContent = `Min ${systemLabel()} level:`;
  bar.appendChild(minLabel);

  const minSelect = document.createElement("select");
  minSelect.id = "jufo-min-level";
  populateMinLevelSelect(minSelect);
  bar.appendChild(minSelect);

  if (getPageType() === "profile") {
    const authorLabel = document.createElement("label");
    authorLabel.htmlFor = "jufo-author-pos";
    authorLabel.textContent = "Author position:";
    authorLabel.style.marginLeft = "12px";
    bar.appendChild(authorLabel);

    const authorSelect = document.createElement("select");
    authorSelect.id = "jufo-author-pos";
    for (const [value, text] of [["any", "Any"], ["first", "First"], ["last", "Last"], ["firstlast", "First or last"]]) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = text;
      authorSelect.appendChild(opt);
    }
    bar.appendChild(authorSelect);
  }

  const sortBtn = document.createElement("button");
  sortBtn.id = "jufo-sort-btn";
  sortBtn.type = "button";
  sortBtn.disabled = true;
  sortBtn.title = "Sort by JUFO level (resolving…)";
  sortBtn.textContent = "Sort by JUFO";
  bar.appendChild(sortBtn);

  const countSpan = document.createElement("span");
  countSpan.id = "jufo-count";
  bar.appendChild(countSpan);
  anchor.parentNode.insertBefore(bar, anchor);

  document.getElementById("jufo-sort-btn").addEventListener("click", sortByJufo);
  document.getElementById("jufo-min-level").addEventListener("change", (e) => {
    filterMinLevel = parseInt(e.target.value, 10);
    applyFilter();
  });
  document.getElementById("jufo-author-pos")?.addEventListener("change", (e) => {
    filterAuthor = e.target.value;
    applyFilter();
  });
}

async function applyFilter() {
  const isSearch = getPageType() === "search";
  const lastName = isSearch ? null : getProfileLastName();
  const rows = getRows();

  if (!isSearch && filterAuthor !== "any") {
    await mapWithConcurrency(rows, MAX_CONCURRENT_AUTHOR_FETCHES, (row) => resolveAuthorPosition(row, lastName));
  }

  let shown = 0;
  for (const row of rows) {
    const raw = row.dataset.jufoLevel;
    const level = raw !== undefined ? parseInt(raw, 10) : NaN;
    const passesLevel = filterMinLevel <= -1 || (!isNaN(level) && level >= filterMinLevel);

    const pos = row.dataset.jufoAuthor ?? "other";
    const passesAuthor = isSearch || filterAuthor === "any"
      || filterAuthor === "first"     && (pos === "first" || pos === "both")
      || filterAuthor === "last"      && (pos === "last"  || pos === "both")
      || filterAuthor === "firstlast" && (pos !== "other");

    // On search pages hide the whole result card (.gs_r), not just .gs_ri
    const el = isSearch ? (row.closest(".gs_r") ?? row) : row;
    el.style.display = passesLevel && passesAuthor ? "" : "none";
    if (passesLevel && passesAuthor) shown++;
  }
  const countEl = document.getElementById("jufo-count");
  if (countEl) countEl.textContent = `${shown} / ${rows.length} shown`;
}

// ── Sort ─────────────────────────────────────────────────────────────────────

function jufoSortKey(level) {
  // Real levels sort by value; "unranked" (a confirmed non-ranked channel)
  // sits just below level 0; unprocessed/"not-found" rows go to the bottom.
  if (level === "unranked") return -1;
  const n = parseInt(level, 10);
  return isNaN(n) ? -2 : n;
}

function sortByJufo() {
  if (getPageType() === "profile") {
    const tbody = document.getElementById("gsc_a_b");
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll(".gsc_a_tr"));
    rows.sort((a, b) => jufoSortKey(b.dataset.jufoLevel) - jufoSortKey(a.dataset.jufoLevel));
    rows.forEach((r) => tbody.appendChild(r));
  } else {
    const container = document.getElementById("gs_res_ccl_mid");
    if (!container) return;
    const cards = Array.from(container.querySelectorAll(".gs_r.gs_or"));
    cards.sort((a, b) => {
      const la = jufoSortKey(a.querySelector("div.gs_ri")?.dataset.jufoLevel);
      const lb = jufoSortKey(b.querySelector("div.gs_ri")?.dataset.jufoLevel);
      return lb - la;
    });
    cards.forEach((c) => container.appendChild(c));
  }
}

function enableSortButton() {
  const btn = document.getElementById("jufo-sort-btn");
  if (!btn) return;
  btn.disabled = false;
  btn.title = "Sort by JUFO level";
}

// ── Summary box (profile pages only) ─────────────────────────────────────────

// The real, countable tiers for the active system, top-first: Finland has
// 3/2/1 (level 0 isn't "good enough" to summarize), Norway has 2/1.
function summaryLevels() {
  return activeSystem === "no" ? [2, 1] : [3, 2, 1];
}

function renderSummaryBoxContents(box) {
  const rows = summaryLevels().map((lvl) => `
      <tr><td><span class="jufo-badge ${levelColorClass(lvl)}">${systemLabel()} ${lvl}</span></td><td id="jufo-s-${lvl}f">…</td><td id="jufo-s-${lvl}l">…</td></tr>`).join("");
  box.innerHTML = `
    <table>
      <tr><th></th><th>First author</th><th>Last author</th></tr>${rows}
    </table>
    <div style="margin-top:6px;color:#888;font-size:11px;">Load all articles for complete counts.</div>`;
}

function injectSummaryBox() {
  if (getPageType() !== "profile") return;
  let box = document.getElementById("jufo-summary");
  if (box) { renderSummaryBoxContents(box); return; } // rebuild for a system switch
  const sidebar = document.getElementById("gsc_rsb")
    ?? document.querySelector(".gsc_rsb");
  if (!sidebar) {
    console.warn("[JUFO Scholar] sidebar not found — summary box not injected");
    return;
  }
  box = document.createElement("div");
  box.id = "jufo-summary";
  renderSummaryBoxContents(box);
  sidebar.insertBefore(box, sidebar.firstChild);
}

// updateSummaryBox is called both explicitly (after a resolve batch fully
// completes) and from a debounce timer (scheduleSummaryUpdate, fired as
// individual badges resolve). Those can overlap and finish out of order —
// e.g. a debounce-triggered call starting on a partial snapshot can take
// longer (author-position lookups hit Scholar's own citation-detail pages,
// which can be slow/rate-limited) than a later, more-complete explicit
// call, and would otherwise overwrite the correct totals with a stale
// partial count. This generation counter makes a stale call discard its
// own results instead of writing them once a newer call has started.
let _summaryGeneration = 0;

async function updateSummaryBox() {
  if (getPageType() !== "profile") return;
  const myGeneration = ++_summaryGeneration;
  const lastName = getProfileLastName();
  const rows = getRows();
  const levels = summaryLevels();
  // Only rows with a real countable level matter for these counts anyway;
  // this also avoids resolving author position for rows still pending a
  // JUFO lookup.
  const knownRows = rows.filter(r => levels.includes(parseInt(r.dataset.jufoLevel, 10)));
  await mapWithConcurrency(knownRows, MAX_CONCURRENT_AUTHOR_FETCHES, (r) => resolveAuthorPosition(r, lastName));
  if (myGeneration !== _summaryGeneration) return; // a newer call superseded this one
  const counts = {};
  levels.forEach((lvl) => { counts[lvl] = { first: 0, last: 0 }; });
  for (const row of knownRows) {
    const level = parseInt(row.dataset.jufoLevel, 10);
    const pos = row.dataset.jufoAuthor ?? "other";
    if (pos === "first" || pos === "both") counts[level].first++;
    if (pos === "last"  || pos === "both") counts[level].last++;
  }
  for (const lvl of levels) {
    const f = document.getElementById(`jufo-s-${lvl}f`);
    const l = document.getElementById(`jufo-s-${lvl}l`);
    if (f) f.textContent = counts[lvl].first;
    if (l) l.textContent = counts[lvl].last;
  }
}

// ── Live updates from the popup (ranking-system switch) ──────────────────────

browser.runtime.onMessage.addListener(async (msg) => {
  if (msg.type !== "ACTIVE_SYSTEM_UPDATED") return;
  try {
    const status = await browser.runtime.sendMessage({ type: "GET_STATUS" });
    activeSystem = status?.activeSystem ?? "fi";
  } catch (e) { return; }

  refreshFilterBarForSystem();
  injectSummaryBox(); // rebuilds labels/rows for the new system's tiers

  const rows = getRows().filter((r) => r.dataset.jufoVenue || r.dataset.jufoIssn);
  const candidates = rows.map((row) => ({ row, name: row.dataset.jufoVenue || undefined }));
  if (candidates.length > 0) await resolveVenues(candidates);
  applyFilter();
  await updateSummaryBox();
});

// ── Main ──────────────────────────────────────────────────────────────────────

async function init() {
  try {
    const status = await browser.runtime.sendMessage({ type: "GET_STATUS" });
    if (status?.activeSystem) activeSystem = status.activeSystem;
  } catch (e) {
    // Background not ready yet — default to Finland, same as background.js's default.
  }

  injectStyles();
  injectFilterBar();
  injectSummaryBox();

  const rows = getRows();
  if (rows.length === 0) return;

  // On search pages, resolve truncated venue names via BibTeX before queuing lookups
  if (getPageType() === "search") {
    rows.forEach((row) => getSearchVenueName(row)); // populates jufoVenueTruncated flags
    const truncated = rows.filter((r) => r.dataset.jufoVenueTruncated === "1");
    if (truncated.length > 0) {
      truncated.forEach(setPending);
      for (const row of truncated) {
        await fetchFullVenueName(row);
        if (!row.dataset.jufoVenue) setBadge(row, undefined);
      }
    }
  }

  const candidates = [];
  for (const row of rows) {
    const name = getVenueNameForRow(row);
    if (!name) continue;
    setPending(row);
    candidates.push({ row, name });
  }
  if (candidates.length === 0) return;

  await resolveVenues(candidates);
  await retryWithCrossRef(candidates.map((c) => c.row));
  applyFilter();
  enableSortButton();
  await updateSummaryBox();
}


init();

// Re-scan when Scholar loads more rows (profile "Show more" / search pagination)
const observerTarget = document.getElementById("gsc_a_b") ?? document.getElementById("gs_res_ccl_mid") ?? document.body;
const observer = new MutationObserver(async () => {
  const newRows = getRows().filter((r) => r.dataset.jufoVenue === undefined && !r.dataset.jufoPending);
  if (newRows.length === 0) return;
  newRows.forEach((r) => { r.dataset.jufoPending = "1"; });

  if (getPageType() === "search") {
    newRows.forEach((row) => getSearchVenueName(row));
    const truncated = newRows.filter((r) => r.dataset.jufoVenueTruncated === "1");
    for (const row of truncated) {
      setPending(row);
      await fetchFullVenueName(row);
      if (!row.dataset.jufoVenue) setBadge(row, undefined);
    }
  }

  const candidates = [];
  for (const row of newRows) {
    const name = getVenueNameForRow(row);
    if (!name) continue;
    setPending(row);
    candidates.push({ row, name });
  }
  if (candidates.length === 0) return;

  await resolveVenues(candidates);
  await retryWithCrossRef(candidates.map((c) => c.row));
  applyFilter();
  await updateSummaryBox();
});
observer.observe(observerTarget, { childList: true, subtree: true });
