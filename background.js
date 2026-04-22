"use strict";

const DB_NAME = "jufo_scholar";
const DB_VERSION = 1;
const STORE_NAME = "venues";
const LOOKUP_INTERVAL_MS = 10000; // 10 seconds between JUFO requests
const CACHE_TTL_DAYS = 365;

let db = null;
let queue = []; // [{ venue, tabId }]
let processing = false;

// ── IndexedDB ────────────────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const store = e.target.result.createObjectStore(STORE_NAME, { keyPath: "key" });
      store.createIndex("lastChecked", "lastChecked");
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function getVenue(key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function putVenue(entry) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).put(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── JUFO API ─────────────────────────────────────────────────────────────────

async function fetchJufoLevel(venueName) {
  const url = "https://jfp.csc.fi/jufoportal_base/api/search";
  const body = JSON.stringify([{
    indexName: "publications2",
    params: {
      query: venueName,
      hitsPerPage: 100,
      page: 0,
      facetFilters: [["isActive:true"]],
      highlightPreTag: "__ais-highlight__",
      highlightPostTag: "__/ais-highlight__",
    },
  }]);

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body,
  });
  if (!resp.ok) return null;

  const data = await resp.json();
  const hits = (Array.isArray(data) ? data[0] : data?.results?.[0])?.hits;
  if (!hits || hits.length === 0) return null;

  const target = venueName.toLowerCase().trim();
  const hit = hits.find((h) => h.Name?.toLowerCase().trim() === target)
           ?? hits.find((h) => h.Name?.toLowerCase().trim() === "conference on " + target);
  if (!hit) return null;

  const level = hit.Level;
  return typeof level === "number" ? level : null;
}

// ── Queue processor ──────────────────────────────────────────────────────────

function isCacheStale(entry) {
  if (!entry || !entry.lastChecked) return true;
  const age = (Date.now() - new Date(entry.lastChecked).getTime()) / 86400000;
  return age > CACHE_TTL_DAYS;
}

async function processNext() {
  if (queue.length === 0) { processing = false; return; }
  processing = true;

  const { venue, tabId } = queue.shift();
  const key = venue.toLowerCase().trim();

  try {
    const cached = await getVenue(key);
    if (cached && !isCacheStale(cached)) {
      notifyTab(tabId, venue, cached.level);
    } else {
      const level = await fetchJufoLevel(venue);
      const entry = { key, name: venue, level, lastChecked: new Date().toISOString() };
      await putVenue(entry);
      notifyTab(tabId, venue, level);
    }
  } catch (err) {
    console.warn("[JUFO Scholar] lookup failed for", venue, err);
    notifyTab(tabId, venue, null);
  }

  setTimeout(processNext, LOOKUP_INTERVAL_MS);
}

function notifyTab(tabId, venue, level) {
  browser.tabs.sendMessage(tabId, { type: "JUFO_RESULT", venue, level }).catch(() => {});
}

// ── Message handler ──────────────────────────────────────────────────────────

browser.runtime.onMessage.addListener(async (msg, sender) => {
  if (!db) db = await openDB();
  const tabId = sender.tab ? sender.tab.id : null;

  if (msg.type === "LOOKUP") {
    const results = {};
    for (const venue of msg.venues) {
      const key = venue.toLowerCase().trim();
      const cached = await getVenue(key);
      if (cached && !isCacheStale(cached)) {
        results[venue] = cached.level;
      } else {
        if (!queue.some((q) => q.venue === venue)) {
          queue.push({ venue, tabId });
        }
      }
    }
    if (!processing && queue.length > 0) processNext();
    return Promise.resolve({ type: "CACHED", results });
  }

  if (msg.type === "GET_CACHED") {
    const cached = await getVenue(msg.venue.toLowerCase().trim());
    return Promise.resolve(cached && !isCacheStale(cached) ? cached.level : null);
  }
});

// Initialise DB on startup
openDB().then((d) => { db = d; }).catch(console.error);
