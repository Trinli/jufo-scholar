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
