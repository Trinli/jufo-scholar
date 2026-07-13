"use strict";

// Keeps the extension's JUFO dataset current without requiring users to
// reinstall: fetches the JUFO API's nightly bulk export directly from the
// browser, on a schedule, and stores the transformed result in
// browser.storage.local. background.js reads from there, falling back to
// the bundled jufo-data.json only until the first live refresh completes
// (see reloadJufoData in background.js).
//
// background.js assigns this after it defines its own reload function, so
// a completed refresh here can update background.js's in-memory cache
// immediately rather than waiting for the next lookup or restart.
var reloadJufoDataFromStorage = null;

const BULK_URL = "https://jufo-rest.csc.fi/v1.1/massa.json.zip";
const ALARM_NAME = "jufo-data-refresh";
const CHECK_INTERVAL_MINUTES = 360; // 6h; actual refresh is gated by STALE_MS below
const STALE_MS = 24 * 60 * 60 * 1000; // matches the API's own nightly cadence

function parseLevel(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

function entryPriority(entry) {
  const activeRank = entry._active === "Active" ? 1 : 0;
  const fiRank = entry.fi !== null ? entry.fi : -1;
  return activeRank * 10 + fiRank;
}

function putPreferringHigherPriority(index, key, entry) {
  const existing = index[key];
  if (!existing || entryPriority(entry) > entryPriority(existing)) {
    index[key] = entry;
  }
}

// Mirrors build-data.py's build_indexes() — keep the two in sync (see
// REQUIREMENTS.md FR-8) if this logic ever changes.
function transform(records) {
  const names = {};
  const issnIndex = {};

  for (const row of records) {
    const name = (row.Name || "").trim().toLowerCase();
    if (!name) continue;

    const jufoId = parseInt(row.Jufo_ID, 10);
    if (Number.isNaN(jufoId)) continue;

    const entry = {
      id: jufoId,
      fi: parseLevel(row.Level),
      no: parseLevel(row.Norway_Level),
      _active: row.Active,
    };

    putPreferringHigherPriority(names, name, entry);

    for (const issnField of ["ISSN1", "ISSN2", "ISSNL"]) {
      const issn = (row[issnField] || "").trim();
      if (issn) putPreferringHigherPriority(issnIndex, issn, entry);
    }
  }

  const strip = (entry) => ({ id: entry.id, fi: entry.fi, no: entry.no });
  const publicNames = {};
  for (const k in names) publicNames[k] = strip(names[k]);
  const publicIssn = {};
  for (const k in issnIndex) publicIssn[k] = strip(issnIndex[k]);

  return { names: publicNames, issn: publicIssn };
}

async function fetchAndTransform() {
  const resp = await fetch(BULK_URL);
  if (!resp.ok) throw new Error(`massa.json.zip fetch failed: HTTP ${resp.status}`);
  const zipBytes = new Uint8Array(await resp.arrayBuffer());
  const unzipped = fflate.unzipSync(zipBytes);
  const jsonEntryName = Object.keys(unzipped).find((n) => n.endsWith(".json"));
  if (!jsonEntryName) throw new Error("massa.json.zip contained no .json entry");
  const records = JSON.parse(fflate.strFromU8(unzipped[jsonEntryName]));
  return transform(records);
}

async function refreshJufoData() {
  const { names, issn } = await fetchAndTransform();
  const generatedAt = new Date().toISOString();
  await browser.storage.local.set({ jufoNames: names, jufoIssn: issn, jufoDataGeneratedAt: generatedAt });
  console.log(`[JUFO Scholar] refreshed JUFO data: ${Object.keys(names).length} names, ${Object.keys(issn).length} ISSNs`);
  if (typeof reloadJufoDataFromStorage === "function") await reloadJufoDataFromStorage();
  return { ok: true, generatedAt };
}

async function maybeRefresh(force) {
  try {
    if (!force) {
      const stored = await browser.storage.local.get("jufoDataGeneratedAt");
      if (stored.jufoDataGeneratedAt) {
        const age = Date.now() - new Date(stored.jufoDataGeneratedAt).getTime();
        if (age < STALE_MS) return { ok: true, skipped: true };
      }
    }
    return await refreshJufoData();
  } catch (e) {
    // Network error, API downtime, unexpected shape, etc: leave whatever
    // data is already cached (bundled snapshot or a previous successful
    // refresh) in place rather than clearing it.
    console.warn("[JUFO Scholar] background data refresh failed, keeping last-known-good data", e);
    return { ok: false, error: String(e) };
  }
}

var JufoRefresh = { maybeRefresh };

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) maybeRefresh(false);
});
browser.runtime.onStartup.addListener(() => {
  browser.alarms.create(ALARM_NAME, { periodInMinutes: CHECK_INTERVAL_MINUTES });
  maybeRefresh(false);
});
browser.runtime.onInstalled.addListener(() => {
  browser.alarms.create(ALARM_NAME, { periodInMinutes: CHECK_INTERVAL_MINUTES });
  maybeRefresh(false);
});
