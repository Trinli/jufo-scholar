"use strict";

// Manifest V3 (Chrome) needs a single service-worker entry point, unlike
// Firefox's MV2 "background.scripts" array which loads several files
// directly. This just loads the same shared files, in the same order, via
// importScripts — background.js, jufo-refresh.js etc. are otherwise
// identical between both targets (see manifest.chrome.json vs
// manifest.firefox.json).
importScripts(
  "lib/browser-polyfill.min.js",
  "lib/fflate.min.js",
  "jufo-refresh.js",
  "background.js"
);
