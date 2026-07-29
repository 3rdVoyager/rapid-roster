/**
 * results.js
 *
 * Handles the Results panel: display ranked options, layout toggles, export.
 */

import { getProject } from "/js/state.js";

let currentResults = [];
let resultsLayout = "list";
let resultsView = "by-slot";

export function refreshResults() {
  const project = getProject();
  const mainEl = document.getElementById("results-main");
  if (!mainEl) return;

  if (currentResults.length === 0) {
    mainEl.innerHTML = '<p class="app-empty-hint">Run Generate first, then pick an option here.</p>';
    return;
  }

  const selected = currentResults[0];
  if (!selected) return;

  if (resultsView === "by-slot") {
    mainEl.innerHTML = renderBySlot(selected);
  } else {
    mainEl.innerHTML = renderByEntry(selected, project);
  }
}

function renderBySlot(result) {
  if (!result.assignments) return "<p>No assignments.</p>";

  if (resultsLayout === "grid") {
    return `<div class="results-grid">` +
      result.assignments.map(a => {
        const entriesList = (a.entries || []).map(e => escapeHtml(e)).join(", ");
        return `<div class="card">
          <h3 class="card-title">${escapeHtml(a.slot)}</h3>
          <p>${entriesList || "Empty"}</p>
        </div>`;
      }).join("") +
    `</div>`;
  }

  return `<div class="results-list">` +
    result.assignments.map(a => {
      const entriesList = (a.entries || []).map(e => escapeHtml(e)).join(", ");
      return `<div class="card">
        <div class="card-header"><h3 class="card-title">${escapeHtml(a.slot)}</h3></div>
        <p>${entriesList || "Empty"}</p>
      </div>`;
    }).join("") +
  `</div>`;
}

function renderByEntry(result, project) {
  if (!result.assignments) return "<p>No assignments.</p>";

  const entries = project.entries || [];
  const entryMap = new Map();
  result.assignments.forEach(a => {
    (a.entries || []).forEach(e => {
      if (!entryMap.has(e)) entryMap.set(e, []);
      entryMap.get(e).push(a.slot);
    });
  });

  if (resultsLayout === "grid") {
    return `<div class="results-grid">` +
      entries.map((entry, i) => {
        const name = entry.name || entry.id || `Entry ${i + 1}`;
        const slots = entryMap.get(name) || [];
        return `<div class="card">
          <h3 class="card-title">${escapeHtml(name)}</h3>
          <p>${slots.map(s => escapeHtml(s)).join(", ") || "Not placed"}</p>
        </div>`;
      }).join("") +
    `</div>`;
  }

  return `<div class="results-list">` +
    entries.map((entry, i) => {
      const name = entry.name || entry.id || `Entry ${i + 1}`;
      const slots = entryMap.get(name) || [];
      return `<div class="card">
        <div class="card-header"><h3 class="card-title">${escapeHtml(name)}</h3></div>
        <p>${slots.map(s => escapeHtml(s)).join(", ") || "Not placed"}</p>
      </div>`;
    }).join("") +
  `</div>`;
}

export function setResults(data) {
  currentResults = data;
  refreshResults();
}

export function setResultsLayout(layout) {
  resultsLayout = layout;
  refreshResults();
}

export function setResultsView(view) {
  resultsView = view;
  refreshResults();
}

export function exportResultsCsv() {
  const project = getProject();
  if (currentResults.length === 0) {
    alert("No results to export yet.");
    return;
  }

  const selected = currentResults[0];
  const lines = ["slot,entry"];
  (selected.assignments || []).forEach(a => {
    (a.entries || []).forEach(e => {
      lines.push(`"${a.slot}","${e}"`);
    });
  });

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "results.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function initResultsPanel() {
  refreshResults();

  document.getElementById("export-csv-btn")?.addEventListener("click", exportResultsCsv);

  document.querySelectorAll("#results-layout-toggle button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#results-layout-toggle button").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      setResultsLayout(btn.dataset.layout || "list");
    });
  });

  document.querySelectorAll("#results-group-toggle button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#results-group-toggle button").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      setResultsView(btn.dataset.view || "by-slot");
    });
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """);
}