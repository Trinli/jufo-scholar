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
.jufo-0       { background: #f1f5f9; color: #94a3b8; }
.jufo-1       { background: #bfdbfe; color: #1e3a5f; }
.jufo-2       { background: #3b82f6; color: #ffffff; }
.jufo-3       { background: #3730a3; color: #ffffff; }

#jufo-filter-bar {
  display: flex;
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

.jufo-row-2 { border-left: 3px solid #3b82f6; background: rgba(59, 130, 246, 0.05); }
.jufo-row-3 { border-left: 4px solid #3730a3; background: rgba(55, 48, 163, 0.08); }
`;

function injectStyles() {
  const el = document.createElement("style");
  el.textContent = STYLE;
  document.head.appendChild(el);
}

// ── Page type ─────────────────────────────────────────────────────────────────

function getPageType() {
  return location.pathname.startsWith("/scholar") ? "search" : "profile";
}

// ── Shared venue name cleaning ────────────────────────────────────────────────

function cleanVenueName(text) {
  return text.trim()
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
    const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(title)}&rows=3&select=title,container-title,event`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(resp.status);
    const data = await resp.json();
    const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-–—]/g, " ").replace(/\s+/g, " ").trim();
    const t = norm(title);
    for (const item of data.message?.items ?? []) {
      const itemTitle = norm(item.title?.[0] ?? "");
      if (itemTitle.length < t.length * 0.6) continue;
      if (itemTitle !== t) continue;
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

async function retryWithCrossRef(venueMap) {
  const unmatched = [...venueMap.values()].flat().filter((r) => r.dataset.jufoLevel === "-1");
  if (unmatched.length === 0) return;
  const crossRefMap = new Map();
  for (const row of unmatched) {
    const name = await fetchFullVenueName(row);
    if (!name) { setBadge(row, null); continue; }
    if (!crossRefMap.has(name)) crossRefMap.set(name, []);
    crossRefMap.get(name).push(row);
  }
  if (crossRefMap.size === 0) return;
  let r2;
  try { r2 = await browser.runtime.sendMessage({ type: "LOOKUP", venues: Array.from(crossRefMap.keys()) }); }
  catch (e) { return; }
  if (r2?.results) {
    for (const [venue, level] of Object.entries(r2.results)) {
      for (const row of crossRefMap.get(venue) || []) setBadge(row, level);
    }
  }
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
  if (level === null || level === undefined) {
    badge.classList.add("jufo-none");
    badge.textContent = "JUFO ?";
    badge.title = "Not found — click to look up via CrossRef" + (venueName ? ` · matched: ${venueName}` : "");
    badge.onclick = async (e) => {
      e.stopPropagation();
      delete row.dataset.jufoVenue;
      badge.className = "jufo-badge jufo-pending";
      badge.textContent = "JUFO …";
      badge.onclick = null;
      const name = await fetchFullVenueName(row);
      if (!name) { setBadge(row, null); return; }
      let resp;
      try { resp = await browser.runtime.sendMessage({ type: "LOOKUP", venues: [name] }); }
      catch (e) { setBadge(row, null); return; }
      setBadge(row, resp?.results?.[name] ?? null);
      applyFilter();
    };
  } else {
    badge.classList.add(`jufo-${level}`);
    badge.textContent = `JUFO ${level}`;
    badge.title = `JUFO level ${level}` + (venueName ? ` · ${venueName}` : "");
  }
  row.dataset.jufoLevel = level !== null && level !== undefined ? String(level) : "-1";

  // Highlight the full row for levels 2 and 3
  const highlightEl = getPageType() === "search" ? (row.closest(".gs_r") ?? row) : row;
  highlightEl.classList.remove("jufo-row-2", "jufo-row-3");
  if (level === 2) highlightEl.classList.add("jufo-row-2");
  if (level === 3) highlightEl.classList.add("jufo-row-3");
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

function normalizeStr(s) {
  return s.normalize("NFD").replace(/\p{Mn}/gu, "").toLowerCase();
}

function getProfileLastName() {
  const name = document.querySelector("#gsc_prf_in")?.textContent.trim() ?? "";
  return normalizeStr(name.split(/\s+/).pop());
}

function isAuthorListTruncated(row) {
  const grays = row.querySelectorAll(".gsc_a_t .gs_gray");
  const text = grays[0]?.textContent ?? "";
  return text.includes("…") || text.includes("...");
}

async function fetchFullAuthors(row) {
  if (row.dataset.jufoFullAuthors !== undefined) {
    return row.dataset.jufoFullAuthors ? row.dataset.jufoFullAuthors.split("|") : null;
  }
  const link = row.querySelector(".gsc_a_t a");
  if (!link) { row.dataset.jufoFullAuthors = ""; return null; }
  try {
    const resp = await fetch(link.href);
    if (!resp.ok) throw new Error(resp.status);
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    for (const field of doc.querySelectorAll("#gsc_oci_table .gs_scl")) {
      if (field.querySelector(".gsc_oci_field")?.textContent.trim() === "Authors") {
        const value = field.querySelector(".gsc_oci_value")?.textContent.trim();
        if (value) {
          const authors = value.split(",").map((a) => a.trim());
          row.dataset.jufoFullAuthors = authors.join("|");
          return authors;
        }
      }
    }
  } catch (e) {
    console.warn("[JUFO Scholar] failed to fetch paper detail", e);
  }
  row.dataset.jufoFullAuthors = "";
  return null;
}

function authorPosition(authors, lastName) {
  if (!authors || authors.length === 0) return "other";
  const first = normalizeStr(authors[0]).includes(lastName);
  const last  = normalizeStr(authors[authors.length - 1]).includes(lastName);
  return first && last ? "both" : first ? "first" : last ? "last" : "other";
}

async function resolveAuthorPosition(row, lastName) {
  if (row.dataset.jufoAuthor !== undefined) return row.dataset.jufoAuthor;
  if (isAuthorListTruncated(row)) {
    const authors = await fetchFullAuthors(row);
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

  const authorControls = getPageType() === "profile" ? `
    <label for="jufo-author-pos" style="margin-left:12px">Author position:</label>
    <select id="jufo-author-pos">
      <option value="any">Any</option>
      <option value="first">First</option>
      <option value="last">Last</option>
      <option value="firstlast">First or last</option>
    </select>` : "";

  bar.innerHTML = `
    <label for="jufo-min-level">Min JUFO level:</label>
    <select id="jufo-min-level">
      <option value="-1">Any</option>
      <option value="0">0+</option>
      <option value="1">1+</option>
      <option value="2">2+</option>
      <option value="3">3</option>
    </select>
    ${authorControls}
    <button id="jufo-sort-btn" type="button" disabled title="Sort by JUFO level (resolving…)">Sort by JUFO</button>
    <span id="jufo-count"></span>
  `;
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
    await Promise.all(rows.map((row) => resolveAuthorPosition(row, lastName)));
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
  // -1 (not found) and NaN (unprocessed) both go to the bottom
  const n = parseInt(level, 10);
  return isNaN(n) || n < 0 ? -2 : n;
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

function injectSummaryBox() {
  if (getPageType() !== "profile") return;
  if (document.getElementById("jufo-summary")) return;
  const sidebar = document.getElementById("gsc_rsb")
    ?? document.querySelector(".gsc_rsb");
  if (!sidebar) {
    console.warn("[JUFO Scholar] sidebar not found — summary box not injected");
    return;
  }
  const box = document.createElement("div");
  box.id = "jufo-summary";
  box.innerHTML = `
    <table>
      <tr><th></th><th>First author</th><th>Last author</th></tr>
      <tr><td><span class="jufo-badge jufo-3">JUFO 3</span></td><td id="jufo-s-3f">…</td><td id="jufo-s-3l">…</td></tr>
      <tr><td><span class="jufo-badge jufo-2">JUFO 2</span></td><td id="jufo-s-2f">…</td><td id="jufo-s-2l">…</td></tr>
      <tr><td><span class="jufo-badge jufo-1">JUFO 1</span></td><td id="jufo-s-1f">…</td><td id="jufo-s-1l">…</td></tr>
    </table>
    <div style="margin-top:6px;color:#888;font-size:11px;">Load all articles for complete counts.</div>`;
  sidebar.insertBefore(box, sidebar.firstChild);
}

async function updateSummaryBox() {
  if (getPageType() !== "profile") return;
  const lastName = getProfileLastName();
  const rows = getRows();
  await Promise.all(rows.map((r) => resolveAuthorPosition(r, lastName)));
  const counts = { 1: { first: 0, last: 0 }, 2: { first: 0, last: 0 }, 3: { first: 0, last: 0 } };
  for (const row of rows) {
    const level = parseInt(row.dataset.jufoLevel, 10);
    if (![1, 2, 3].includes(level)) continue;
    const pos = row.dataset.jufoAuthor ?? "other";
    if (pos === "first" || pos === "both") counts[level].first++;
    if (pos === "last"  || pos === "both") counts[level].last++;
  }
  for (const lvl of [1, 2, 3]) {
    const f = document.getElementById(`jufo-s-${lvl}f`);
    const l = document.getElementById(`jufo-s-${lvl}l`);
    if (f) f.textContent = counts[lvl].first;
    if (l) l.textContent = counts[lvl].last;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function init() {
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
        if (!row.dataset.jufoVenue) setBadge(row, null);
      }
    }
  }

  const venueMap = new Map();
  for (const row of rows) {
    const name = getVenueNameForRow(row);
    if (!name) continue;
    setPending(row);
    if (!venueMap.has(name)) venueMap.set(name, []);
    venueMap.get(name).push(row);
  }

  if (venueMap.size === 0) return;

  const venues = Array.from(venueMap.keys());
  let response;
  try {
    response = await browser.runtime.sendMessage({ type: "LOOKUP", venues });
  } catch (e) {
    console.error("[JUFO Scholar] background not ready", e);
    return;
  }

  if (response && response.results) {
    for (const [venue, level] of Object.entries(response.results)) {
      for (const row of venueMap.get(venue) || []) {
        setBadge(row, level);
      }
    }
  }

  await retryWithCrossRef(venueMap);
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
      if (!row.dataset.jufoVenue) setBadge(row, null);
    }
  }

  const venueMap = new Map();
  for (const row of newRows) {
    const name = getVenueNameForRow(row);
    if (!name) continue;
    setPending(row);
    if (!venueMap.has(name)) venueMap.set(name, []);
    venueMap.get(name).push(row);
  }
  if (venueMap.size === 0) return;

  let response;
  try {
    response = await browser.runtime.sendMessage({ type: "LOOKUP", venues: Array.from(venueMap.keys()) });
  } catch (e) { return; }

  if (response?.results) {
    for (const [venue, level] of Object.entries(response.results)) {
      for (const row of venueMap.get(venue) || []) setBadge(row, level);
    }
  }
  await retryWithCrossRef(venueMap);
  applyFilter();
  await updateSummaryBox();
});
observer.observe(observerTarget, { childList: true, subtree: true });
