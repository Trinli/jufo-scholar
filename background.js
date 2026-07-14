"use strict";

let jufoNames = null;
let jufoIssn = null;
let customMappings = {};
let activeSystem = "fi"; // "fi" (Finland) or "no" (Norway) — see popup.js

async function reloadJufoData() {
  const stored = await browser.storage.local.get(["jufoNames", "jufoIssn"]);
  if (stored.jufoNames && stored.jufoIssn) {
    jufoNames = stored.jufoNames;
    jufoIssn = stored.jufoIssn;
    return;
  }
  // No live refresh has completed yet (fresh install, or the background
  // refresh in jufo-refresh.js hasn't run/succeeded): fall back to the
  // bundled snapshot shipped with the extension.
  const url = browser.runtime.getURL("jufo-data.json");
  const bundled = await fetch(url).then((r) => r.json());
  jufoNames = bundled.names;
  jufoIssn = bundled.issn;
}
// jufo-refresh.js calls this after a successful live refresh so lookups
// pick up fresh data immediately, without waiting for a restart.
reloadJufoDataFromStorage = reloadJufoData;

async function loadData() {
  if (jufoNames) return;
  await reloadJufoData();

  const storedMappings = await browser.storage.local.get("customMappings");
  if (storedMappings.customMappings === undefined) {
    const defaults = await fetch(browser.runtime.getURL("default-mappings.json")).then((r) => r.json());
    await browser.storage.local.set({ customMappings: defaults });
    customMappings = defaults;
  } else {
    customMappings = storedMappings.customMappings;
  }

  const storedSystem = await browser.storage.local.get("activeRankingSystem");
  activeSystem = storedSystem.activeRankingSystem === "no" ? "no" : "fi";
}

function normalizeKey(s) {
  return s.toLowerCase().trim()
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s*:\s*/g, " : ")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// entry is {id, fi, no} or undefined (no match at all). Returns:
//   undefined -> not found, null -> non-ranked, number -> a real level.
function resolveLevel(entry) {
  if (!entry) return undefined;
  return entry[activeSystem];
}

function candidateKeys(name) {
  const key = name.toLowerCase().trim();
  const norm = normalizeKey(name);
  const candidates = [key, "conference on " + key, "proceedings of the " + key];

  if (norm !== key) {
    candidates.push(norm, "conference on " + norm, "proceedings of the " + norm);
  }
  // Some DB entries use & instead of 'and' — try the ampersand form of the normalized key
  const ampKey = norm.replace(/ and /g, " & ");
  if (ampKey !== norm) {
    candidates.push(ampKey, "conference on " + ampKey, "proceedings of the " + ampKey);
  }
  // CrossRef event names often include "Annual" which JUFO entries omit — try without it
  const withoutAnnual = norm.replace(/^annual\s+/, "");
  if (withoutAnnual !== norm) {
    candidates.push(withoutAnnual, "conference on " + withoutAnnual, "proceedings of the " + withoutAnnual);
  }
  // Some JUFO entries include a leading "The" that Scholar omits — try with it prepended
  candidates.push("the " + norm);
  // Some JUFO entries omit a leading "The" that Scholar includes — try without it
  if (norm.startsWith("the ")) candidates.push(norm.slice(4));
  // Some JUFO entries use " : " as a sub-journal separator that Scholar omits entirely
  // e.g. "The Lancet Digital Health" → "the lancet : digital health"
  const words = norm.split(" ");
  for (let i = 1; i < words.length; i++) {
    candidates.push(words.slice(0, i).join(" ") + " : " + words.slice(i).join(" "));
  }
  return candidates;
}

function lookupVenueRaw(name) {
  for (const key of candidateKeys(name)) {
    const level = resolveLevel(jufoNames[key]);
    if (level !== undefined) return level;
  }
  return undefined;
}

function lookupVenue(name) {
  const key = normalizeKey(name);
  if (customMappings[key]) return lookupVenueRaw(customMappings[key]);
  return lookupVenueRaw(name);
}

function lookupIssn(issn) {
  return resolveLevel(jufoIssn[(issn || "").trim()]);
}

browser.runtime.onMessage.addListener(async (msg) => {
  await loadData();

  if (msg.type === "MAPPINGS_UPDATED") {
    const stored = await browser.storage.local.get("customMappings");
    customMappings = stored.customMappings ?? {};
    return;
  }

  if (msg.type === "ACTIVE_SYSTEM_UPDATED") {
    const stored = await browser.storage.local.get("activeRankingSystem");
    activeSystem = stored.activeRankingSystem === "no" ? "no" : "fi";
    return;
  }

  if (msg.type === "GET_STATUS") {
    const stored = await browser.storage.local.get("jufoDataGeneratedAt");
    return { generatedAt: stored.jufoDataGeneratedAt ?? null, activeSystem };
  }

  if (msg.type === "REFRESH_NOW") {
    return JufoRefresh.maybeRefresh(true);
  }

  if (msg.type === "CROSSREF_LOOKUP") {
    // Fetched here rather than directly in content.js: Chrome doesn't grant
    // content scripts the extension's cross-origin fetch privileges (even
    // with host_permissions declared) the way Firefox does — only
    // extension pages like this background script get that. See README's
    // Firefox/Chrome support section.
    try {
      const resp = await fetch(msg.url);
      if (!resp.ok) return { ok: false, status: resp.status };
      return { ok: true, data: await resp.json() };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  if (msg.type === "LOOKUP") {
    const results = {};
    for (const venue of msg.venues) {
      const level = lookupVenue(venue);
      if (level !== undefined) results[venue] = level;
    }
    return Promise.resolve({ type: "CACHED", results });
  }

  if (msg.type === "LOOKUP_ISSN") {
    const results = {};
    for (const issn of msg.issns) {
      const level = lookupIssn(issn);
      if (level !== undefined) results[issn] = level;
    }
    return Promise.resolve({ type: "CACHED", results });
  }
});
