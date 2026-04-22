"use strict";

let jufoData = null;
let customMappings = {};

async function loadData() {
  if (jufoData) return;
  const url = browser.runtime.getURL("jufo-data.json");
  jufoData = await fetch(url).then((r) => r.json());
  const stored = await browser.storage.local.get("customMappings");
  if (stored.customMappings === undefined) {
    const defaults = await fetch(browser.runtime.getURL("default-mappings.json")).then((r) => r.json());
    await browser.storage.local.set({ customMappings: defaults });
    customMappings = defaults;
  } else {
    customMappings = stored.customMappings;
  }
}

function normalizeKey(s) {
  return s.toLowerCase().trim()
    .replace(/\s*&\s*/g, " and ")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function lookupVenue(name) {
  const key = normalizeKey(name);
  if (customMappings[key]) return lookupVenueRaw(customMappings[key]);
  return lookupVenueRaw(name);
}

function lookupVenueRaw(name) {
  const key = name.toLowerCase().trim();
  if (key in jufoData) return jufoData[key];
  if ("conference on " + key in jufoData) return jufoData["conference on " + key];
  if ("proceedings of the " + key in jufoData) return jufoData["proceedings of the " + key];
  const norm = normalizeKey(name);
  if (norm !== key) {
    if (norm in jufoData) return jufoData[norm];
    if ("conference on " + norm in jufoData) return jufoData["conference on " + norm];
    if ("proceedings of the " + norm in jufoData) return jufoData["proceedings of the " + norm];
  }
  return null;
}

browser.runtime.onMessage.addListener(async (msg) => {
  await loadData();
  if (msg.type === "MAPPINGS_UPDATED") {
    const stored = await browser.storage.local.get("customMappings");
    customMappings = stored.customMappings ?? {};
    return;
  }
  if (msg.type === "LOOKUP") {
    const results = {};
    for (const venue of msg.venues) results[venue] = lookupVenue(venue);
    return Promise.resolve({ type: "CACHED", results });
  }
});
