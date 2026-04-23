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
    .replace(/\s*:\s*/g, " : ")
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
  // Some DB entries use & instead of 'and' — try the ampersand form of the normalized key
  const ampKey = norm.replace(/ and /g, " & ");
  if (ampKey !== norm) {
    if (ampKey in jufoData) return jufoData[ampKey];
    if ("conference on " + ampKey in jufoData) return jufoData["conference on " + ampKey];
    if ("proceedings of the " + ampKey in jufoData) return jufoData["proceedings of the " + ampKey];
  }
  // CrossRef event names often include "Annual" which JUFO entries omit — try without it
  const withoutAnnual = norm.replace(/^annual\s+/, "");
  if (withoutAnnual !== norm) {
    if (withoutAnnual in jufoData) return jufoData[withoutAnnual];
    if ("conference on " + withoutAnnual in jufoData) return jufoData["conference on " + withoutAnnual];
    if ("proceedings of the " + withoutAnnual in jufoData) return jufoData["proceedings of the " + withoutAnnual];
  }
  // Some JUFO entries include a leading "The" that Scholar omits — try with it prepended
  const withThe = "the " + norm;
  if (withThe in jufoData) return jufoData[withThe];
  // Some JUFO entries omit a leading "The" that Scholar includes — try without it
  if (norm.startsWith("the ")) {
    const withoutThe = norm.slice(4);
    if (withoutThe in jufoData) return jufoData[withoutThe];
  }
  // Some JUFO entries use " : " as a sub-journal separator that Scholar omits entirely
  // e.g. "The Lancet Digital Health" → "the lancet : digital health"
  const words = norm.split(" ");
  for (let i = 1; i < words.length; i++) {
    const candidate = words.slice(0, i).join(" ") + " : " + words.slice(i).join(" ");
    if (candidate in jufoData) return jufoData[candidate];
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
