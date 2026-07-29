/**
 * slots.js
 *
 * Handles the Slots panel: list, editor, CSV table.
 */

import { getProject, setProject, setDirty, saveProject } from "/js/state.js";
import { parseCsvText, tableToCsv } from "/js/csv.js";

export function refreshSlotList() {
  const project = getProject();
  const listEl = document.getElementById("slot-list");
  if (!listEl) return;

  const slots = project.slots || [];
  if (slots.length === 0) {
    listEl.innerHTML = '<li><p class="app-empty-hint">No slots yet. Click + Add slot or import a CSV.</p></li>';
    return;
  }

  listEl.innerHTML = slots
    .map((slot, index) => {
      const name = slot.name || slot.id || `Slot ${index + 1}`;
      const size = slot.min_size !== undefined || slot.max_size !== undefined
        ? `${slot.min_size ?? "?"}–${slot.max_size ?? "?"}`
        : "";
      return `<li data-index="${index}">
        <div>
          <div class="item-primary">${escapeHtml(name)}</div>
          ${size ? `<div class="item-meta">Size ${size}</div>` : ""}
        </div>
        <button class="button button-ghost button-small" data-edit-slot="${index}">Edit</button>
      </li>`;
    })
    .join("");
}

export function editSlot(index) {
  const project = getProject();
  const slot = project.slots[index];
  if (!slot) return;

  const fieldsEl = document.getElementById("slot-editor-fields");
  const actionsEl = document.getElementById("slot-editor-actions");
  if (!fieldsEl) return;

  const fields = Object.entries(slot).map(([key, value]) => {
    return `<div class="form-field">
      <label for="slot-field-${key}">${escapeHtml(key)}</label>
      <input id="slot-field-${key}" data-field="${key}" value="${escapeHtml(String(value))}" />
    </div>`;
  }).join("");

  fieldsEl.innerHTML = fields;
  if (actionsEl) actionsEl.hidden = false;
  fieldsEl.dataset.editIndex = String(index);
}

export function saveCurrentSlot() {
  const fieldsEl = document.getElementById("slot-editor-fields");
  if (!fieldsEl || fieldsEl.dataset.editIndex === undefined) return;

  const index = parseInt(fieldsEl.dataset.editIndex, 10);
  const project = getProject();
  const slot = project.slots[index];
  if (!slot) return;

  const inputs = fieldsEl.querySelectorAll("input[data-field]");
  inputs.forEach((input) => {
    const field = input.dataset.field;
    slot[field] = input.value;
  });

  setProject(project);
  setDirty(true);
  saveProject();
  refreshSlotList();
}

export function deleteCurrentSlot() {
  const fieldsEl = document.getElementById("slot-editor-fields");
  if (!fieldsEl || fieldsEl.dataset.editIndex === undefined) return;

  const index = parseInt(fieldsEl.dataset.editIndex, 10);
  const project = getProject();
  project.slots.splice(index, 1);
  setProject(project);
  setDirty(true);
  saveProject();

  fieldsEl.innerHTML = '<p class="app-empty-hint">Select a slot to edit its fields.</p>';
  delete fieldsEl.dataset.editIndex;
  const actionsEl = document.getElementById("slot-editor-actions");
  if (actionsEl) actionsEl.hidden = true;

  refreshSlotList();
}

export function addSlot() {
  const project = getProject();
  if (!project.slots) project.slots = [];
  project.slots.push({ id: "", name: "" });
  setProject(project);
  setDirty(true);
  saveProject();
  refreshSlotList();
  editSlot(project.slots.length - 1);
}

export function importSlotsCsv(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const table = parseCsvText(text);
    const headers = table[0];
    const rows = table.slice(1);

    const project = getProject();
    project.slots = rows.map((row) => {
      const slot = {};
      headers.forEach((header, i) => {
        slot[header.trim()] = (row[i] || "").trim();
      });
      return slot;
    });

    setProject(project);
    setDirty(true);
    saveProject();
    refreshSlotList();
  };
  reader.readAsText(file);
}

export function exportSlotsCsv() {
  const project = getProject();
  const headers = Object.keys(project.slots[0] || { id: "", name: "", min_size: "", max_size: "" });
  const rows = project.slots.map((slot) => headers.map((h) => slot[h] || ""));
  const csv = tableToCsv([headers, ...rows]);
  downloadFile(csv, "slots.csv", "text/csv");
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """);
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function initSlotsPanel() {
  refreshSlotList();

  document.getElementById("add-slot-btn")?.addEventListener("click", addSlot);
  document.getElementById("save-slot-btn")?.addEventListener("click", saveCurrentSlot);
  document.getElementById("delete-slot-btn")?.addEventListener("click", deleteCurrentSlot);

  document.getElementById("slot-list")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-edit-slot]");
    if (btn) {
      const index = parseInt(btn.dataset.editSlot, 10);
      editSlot(index);
    }
  });

  document.getElementById("import-slots-btn")?.addEventListener("click", () => {
    document.getElementById("import-slots-file")?.click();
  });

  document.getElementById("import-slots-file")?.addEventListener("change", (e) => {
    if (e.target.files[0]) importSlotsCsv(e.target.files[0]);
  });

  document.getElementById("export-slots-csv-btn")?.addEventListener("click", exportSlotsCsv);
}