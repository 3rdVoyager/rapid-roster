/**
 * entries.js
 *
 * Handles the Entries panel: list, editor, CSV table, import/export.
 */

import { getProject, setProject, setDirty, saveProject } from "/js/state.js";
import { parseCsvText, csvToTable, tableToCsv } from "/js/csv.js";

/**
 * Refresh the entry list UI from the current project state.
 */
export function refreshEntryList() {
  const project = getProject();
  const listEl = document.getElementById("entry-list");
  if (!listEl) return;

  const entries = project.entries || [];
  if (entries.length === 0) {
    listEl.innerHTML = '<li><p class="app-empty-hint">No entries yet. Click + Add entry or import a CSV.</p></li>';
    return;
  }

  listEl.innerHTML = entries
    .map((entry, index) => {
      const name = entry.name || `Entry ${index + 1}`;
      const meta = [];
      if (entry.role) meta.push(entry.role);
      if (entry.skill) meta.push(`skill ${entry.skill}`);
      if (entry.school) meta.push(entry.school);
      const metaText = meta.length > 0 ? meta.join(" · ") : "";
      return `<li data-index="${index}">
        <div>
          <div class="item-primary">${escapeHtml(name)}</div>
          ${metaText ? `<div class="item-meta">${escapeHtml(metaText)}</div>` : ""}
        </div>
        <button class="button button-ghost button-small" data-edit-entry="${index}">Edit</button>
      </li>`;
    })
    .join("");
}

/**
 * Load entry fields into the editor form.
 */
export function editEntry(index) {
  const project = getProject();
  const entry = project.entries[index];
  if (!entry) return;

  const fieldsEl = document.getElementById("entry-editor-fields");
  const actionsEl = document.getElementById("entry-editor-actions");
  if (!fieldsEl) return;

  const fields = Object.entries(entry).map(([key, value]) => {
    return `<div class="form-field">
      <label for="entry-field-${key}">${escapeHtml(key)}</label>
      <input id="entry-field-${key}" data-field="${key}" value="${escapeHtml(String(value))}" />
    </div>`;
  }).join("");

  fieldsEl.innerHTML = fields;
  if (actionsEl) actionsEl.hidden = false;
  fieldsEl.dataset.editIndex = String(index);
}

/**
 * Save the currently edited entry back to the project.
 */
export function saveCurrentEntry() {
  const fieldsEl = document.getElementById("entry-editor-fields");
  if (!fieldsEl || fieldsEl.dataset.editIndex === undefined) return;

  const index = parseInt(fieldsEl.dataset.editIndex, 10);
  const project = getProject();
  const entry = project.entries[index];
  if (!entry) return;

  const inputs = fieldsEl.querySelectorAll("input[data-field]");
  inputs.forEach((input) => {
    const field = input.dataset.field;
    entry[field] = input.value;
  });

  setProject(project);
  setDirty(true);
  saveProject();
  refreshEntryList();
}

/**
 * Delete the currently selected entry.
 */
export function deleteCurrentEntry() {
  const fieldsEl = document.getElementById("entry-editor-fields");
  if (!fieldsEl || fieldsEl.dataset.editIndex === undefined) return;

  const index = parseInt(fieldsEl.dataset.editIndex, 10);
  const project = getProject();
  project.entries.splice(index, 1);
  setProject(project);
  setDirty(true);
  saveProject();

  fieldsEl.innerHTML = '<p class="app-empty-hint">Select an entry to edit its fields.</p>';
  delete fieldsEl.dataset.editIndex;
  const actionsEl = document.getElementById("entry-editor-actions");
  if (actionsEl) actionsEl.hidden = true;

  refreshEntryList();
}

/**
 * Add a blank entry and open it for editing.
 */
export function addEntry() {
  const project = getProject();
  if (!project.entries) project.entries = [];
  project.entries.push({ id: "", name: "" });
  setProject(project);
  setDirty(true);
  saveProject();
  refreshEntryList();
  editEntry(project.entries.length - 1);
}

/**
 * Import entries from a CSV file.
 */
export function importEntriesCsv(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const table = parseCsvText(text);
    const headers = table[0];
    const rows = table.slice(1);

    const project = getProject();
    project.entries = rows.map((row) => {
      const entry = {};
      headers.forEach((header, i) => {
        entry[header.trim()] = (row[i] || "").trim();
      });
      return entry;
    });

    setProject(project);
    setDirty(true);
    saveProject();
    refreshEntryList();
  };
  reader.readAsText(file);
}

/**
 * Export entries as CSV.
 */
export function exportEntriesCsv() {
  const project = getProject();
  const headers = Object.keys(project.entries[0] || { id: "", name: "" });
  const rows = project.entries.map((entry) => headers.map((h) => entry[h] || ""));
  const csv = tableToCsv([headers, ...rows]);
  downloadFile(csv, "entries.csv", "text/csv");
}

/**
 * Simple HTML escape helper.
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """);
}

/**
 * Trigger a browser download of a string.
 */
function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Attach event listeners to the entries panel UI.
 */
export function initEntriesPanel() {
  refreshEntryList();

  document.getElementById("add-entry-btn")?.addEventListener("click", addEntry);
  document.getElementById("save-entry-btn")?.addEventListener("click", saveCurrentEntry);
  document.getElementById("delete-entry-btn")?.addEventListener("click", deleteCurrentEntry);

  document.getElementById("entry-list")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-edit-entry]");
    if (btn) {
      const index = parseInt(btn.dataset.editEntry, 10);
      editEntry(index);
    }
  });

  document.getElementById("import-entries-btn")?.addEventListener("click", () => {
    document.getElementById("import-entries-file")?.click();
  });

  document.getElementById("import-entries-file")?.addEventListener("change", (e) => {
    if (e.target.files[0]) importEntriesCsv(e.target.files[0]);
  });

  document.getElementById("export-entries-csv-btn")?.addEventListener("click", exportEntriesCsv);
}