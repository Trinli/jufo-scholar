"use strict";

function normalizeKey(s) {
  return s.toLowerCase().trim()
    .replace(/\s*&\s*/g, " and ")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function getMappings() {
  const stored = await browser.storage.local.get("customMappings");
  return stored.customMappings ?? {};
}

async function saveMappings(mappings) {
  await browser.storage.local.set({ customMappings: mappings });
  browser.runtime.sendMessage({ type: "MAPPINGS_UPDATED" }).catch(() => {});
}

function render(mappings) {
  const tbody = document.getElementById("mappings-body");
  tbody.innerHTML = "";
  const entries = Object.entries(mappings);
  if (entries.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 3;
    td.id = "empty-msg";
    td.textContent = "No custom mappings yet.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  for (const [src, dst] of entries) {
    const tr = document.createElement("tr");
    const tdSrc = document.createElement("td");
    tdSrc.textContent = src;
    const tdDst = document.createElement("td");
    tdDst.textContent = dst;
    const tdDel = document.createElement("td");
    const btn = document.createElement("button");
    btn.className = "del-btn";
    btn.textContent = "✕";
    btn.title = "Remove mapping";
    btn.addEventListener("click", async () => {
      const m = await getMappings();
      delete m[src];
      await saveMappings(m);
      render(m);
    });
    tdDel.appendChild(btn);
    tr.append(tdSrc, tdDst, tdDel);
    tbody.appendChild(tr);
  }
}

document.getElementById("add-btn").addEventListener("click", async () => {
  const src = normalizeKey(document.getElementById("src-input").value);
  const dst = document.getElementById("dst-input").value.toLowerCase().trim();
  if (!src || !dst) return;
  const m = await getMappings();
  m[src] = dst;
  await saveMappings(m);
  render(m);
  document.getElementById("src-input").value = "";
  document.getElementById("dst-input").value = "";
});

getMappings().then(render);

// ── Ranking system switch ─────────────────────────────────────────────────

function updateRankingNote(system) {
  document.getElementById("ranking-note").style.display = system === "no" ? "block" : "none";
}

async function initRankingSystem() {
  const stored = await browser.storage.local.get("activeRankingSystem");
  const system = stored.activeRankingSystem === "no" ? "no" : "fi";
  document.getElementById("ranking-system").value = system;
  updateRankingNote(system);
}

document.getElementById("ranking-system").addEventListener("change", async (e) => {
  const system = e.target.value === "no" ? "no" : "fi";
  updateRankingNote(system);
  await browser.storage.local.set({ activeRankingSystem: system });
  browser.runtime.sendMessage({ type: "ACTIVE_SYSTEM_UPDATED" }).catch(() => {});
});

initRankingSystem();

// ── Data status + manual refresh ──────────────────────────────────────────

function formatRelativeTime(iso) {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

async function refreshStatus() {
  let status;
  try { status = await browser.runtime.sendMessage({ type: "GET_STATUS" }); }
  catch (e) { status = null; }
  document.getElementById("data-status").textContent =
    `JUFO data last refreshed: ${formatRelativeTime(status?.generatedAt)}`;
}

document.getElementById("refresh-btn").addEventListener("click", async () => {
  const btn = document.getElementById("refresh-btn");
  btn.disabled = true;
  btn.textContent = "Refreshing…";
  try {
    const result = await browser.runtime.sendMessage({ type: "REFRESH_NOW" });
    if (!result?.ok) console.warn("[JUFO Scholar] manual refresh failed", result?.error);
  } catch (e) {
    console.warn("[JUFO Scholar] manual refresh failed", e);
  }
  await refreshStatus();
  btn.disabled = false;
  btn.textContent = "Refresh now";
});

refreshStatus();
