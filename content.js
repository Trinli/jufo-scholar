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
.jufo-pending { background: #eee; color: #888; }
.jufo-none    { background: #f0f0f0; color: #999; }   /* not found */
.jufo-0       { background: #e0e0e0; color: #555; }
.jufo-1       { background: #fff3cd; color: #856404; }
.jufo-2       { background: #d4edda; color: #155724; }
.jufo-3       { background: #cce5ff; color: #004085; }

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
`;

function injectStyles() {
  const el = document.createElement("style");
  el.textContent = STYLE;
  document.head.appendChild(el);
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function getPublicationRows() {
  return Array.from(document.querySelectorAll("#gsc_a_b .gsc_a_tr"));
}

function getVenueEl(row) {
  const grays = row.querySelectorAll(".gsc_a_t .gs_gray");
  return grays.length >= 2 ? grays[1] : null;
}

function getVenueName(row) {
  if (row.dataset.jufoVenue !== undefined) return row.dataset.jufoVenue || null;
  const el = getVenueEl(row);
  if (!el) return null;
  const name = el.textContent.trim()
    .replace(/,.*$/, "")       // strip comma and everything after
    .replace(/\s+\d.*$/, "")   // strip trailing number and everything after
    .trim() || null;
  row.dataset.jufoVenue = name ?? "";
  return name;
}

// ── Badge management ─────────────────────────────────────────────────────────

function setBadge(row, level) {
  let badge = row.querySelector(".jufo-badge");
  if (!badge) {
    badge = document.createElement("span");
    const venueEl = getVenueEl(row);
    if (!venueEl) return;
    venueEl.insertAdjacentElement("afterend", badge);
  }

  badge.className = "jufo-badge";
  if (level === null || level === undefined) {
    badge.classList.add("jufo-none");
    badge.textContent = "JUFO ?";
    badge.title = "Not found in JUFO portal";
  } else {
    badge.classList.add(`jufo-${level}`);
    badge.textContent = `JUFO ${level}`;
    badge.title = `JUFO level ${level}`;
  }
  row.dataset.jufoLevel = level !== null && level !== undefined ? String(level) : "-1";
}

function setPending(row) {
  let badge = row.querySelector(".jufo-badge");
  if (!badge) {
    badge = document.createElement("span");
    const venueEl = getVenueEl(row);
    if (!venueEl) return;
    venueEl.insertAdjacentElement("afterend", badge);
  }
  badge.className = "jufo-badge jufo-pending";
  badge.textContent = "JUFO …";
  badge.title = "Looking up JUFO level…";
}

// ── Author position ───────────────────────────────────────────────────────────

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

// Fetches the paper detail page and returns the full author list as an array.
// Result is cached in row.dataset.jufoFullAuthors (comma-joined) or "" on failure.
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

// Resolves author position for a row, fetching detail page if list is truncated.
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
  const table = document.getElementById("gsc_a_b");
  if (!table) return;

  const bar = document.createElement("div");
  bar.id = "jufo-filter-bar";
  bar.innerHTML = `
    <label for="jufo-min-level">Min JUFO level:</label>
    <select id="jufo-min-level">
      <option value="-1">Any</option>
      <option value="0">0+</option>
      <option value="1">1+</option>
      <option value="2">2+</option>
      <option value="3">3</option>
    </select>
    <label for="jufo-author-pos" style="margin-left:12px">Author position:</label>
    <select id="jufo-author-pos">
      <option value="any">Any</option>
      <option value="first">First</option>
      <option value="last">Last</option>
      <option value="firstlast">First or last</option>
    </select>
    <span id="jufo-count"></span>
  `;
  table.parentNode.insertBefore(bar, table);

  document.getElementById("jufo-min-level").addEventListener("change", (e) => {
    filterMinLevel = parseInt(e.target.value, 10);
    applyFilter();
  });
  document.getElementById("jufo-author-pos").addEventListener("change", (e) => {
    filterAuthor = e.target.value;
    applyFilter();
  });
}

async function applyFilter() {
  const lastName = getProfileLastName();
  const rows = getPublicationRows();

  // Resolve author positions (fetches detail pages for truncated rows as needed)
  if (filterAuthor !== "any") {
    await Promise.all(rows.map((row) => resolveAuthorPosition(row, lastName)));
  }

  let shown = 0;
  for (const row of rows) {
    const raw = row.dataset.jufoLevel;
    const level = raw !== undefined ? parseInt(raw, 10) : NaN;
    const passesLevel = filterMinLevel <= -1 || (!isNaN(level) && level >= filterMinLevel);

    const pos = row.dataset.jufoAuthor ?? "other";
    const passesAuthor = filterAuthor === "any"
      || filterAuthor === "first"     && (pos === "first" || pos === "both")
      || filterAuthor === "last"      && (pos === "last"  || pos === "both")
      || filterAuthor === "firstlast" && (pos !== "other");

    row.style.display = passesLevel && passesAuthor ? "" : "none";
    if (passesLevel && passesAuthor) shown++;
  }
  const countEl = document.getElementById("jufo-count");
  if (countEl) countEl.textContent = `${shown} / ${rows.length} shown`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function init() {
  injectStyles();
  injectFilterBar();

  const rows = getPublicationRows();
  if (rows.length === 0) return;

  const venueMap = new Map();
  for (const row of rows) {
    const name = getVenueName(row);
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

  applyFilter();
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "JUFO_RESULT") return;
  const rows = document.querySelectorAll("#gsc_a_b .gsc_a_tr");
  for (const row of rows) {
    if (getVenueName(row) === msg.venue) {
      setBadge(row, msg.level);
    }
  }
  applyFilter();
});

init();

const observer = new MutationObserver(() => {
  const newRows = document.querySelectorAll("#gsc_a_b .gsc_a_tr:not([data-jufo-level]):not([data-jufo-pending])");
  if (newRows.length === 0) return;

  const venues = [];
  for (const row of newRows) {
    row.dataset.jufoPending = "1";
    const name = getVenueName(row);
    if (name) { setPending(row); venues.push(name); }
  }
  if (venues.length > 0) {
    browser.runtime.sendMessage({ type: "LOOKUP", venues }).catch(() => {});
  }
});

observer.observe(document.getElementById("gsc_a_b") || document.body, {
  childList: true,
  subtree: true,
});
