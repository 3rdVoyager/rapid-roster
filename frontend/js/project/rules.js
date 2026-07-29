/**
 * rules.js
 *
 * Handles the Rules panel: rule list, editor, CSV table, global setup.
 */

import { getProject, setProject, setDirty, saveProject } from "/js/state.js";
import { parseCsvText, ruleToCsvCells, ruleFromCsvCells, RULES_CSV_HEADERS } from "/js/presets.js";

export function refreshRuleList() {
  const project = getProject();
  const listEl = document.getElementById("rule-list");
  if (!listEl) return;

  const rules = project.rules || [];
  if (rules.length === 0) {
    listEl.innerHTML = '<li><p class="app-empty-hint">No rules yet. Click + Add rule or import a CSV.</p></li>';
    return;
  }

  listEl.innerHTML = rules
    .map((rule, index) => {
      const priority = rule.priority === "hard" ? "Hard" : `P${rule.priority}`;
      const badgeClass = rule.priority === "hard" ? "badge-hard" : "badge-soft";
      return `<li data-index="${index}">
        <div>
          <div class="item-primary">${escapeHtml(rule.label || `Rule ${index + 1}`)}</div>
          <div class="item-meta">${escapeHtml(rule.action)} · <span class="badge ${badgeClass}">${priority}</span></div>
        </div>
        <button class="button button-ghost button-small" data-edit-rule="${index}">Edit</button>
      </li>`;
    })
    .join("");
}

export function editRule(index) {
  const project = getProject();
  const rule = project.rules[index];
  if (!rule) return;

  document.getElementById("rule-name").value = rule.label || "";
  document.getElementById("rule-data").value = rule.action || "balance";

  const priorityInput = document.getElementById("rule-priority");
  if (rule.priority === "hard") {
    priorityInput.value = 10;
  } else {
    priorityInput.value = rule.priority || 5;
  }

  document.getElementById("rule-hard").checked = rule.priority === "hard";

  const editorEl = document.getElementById("rule-editor");
  if (editorEl) editorEl.dataset.editIndex = String(index);
}

export function saveCurrentRule() {
  const editorEl = document.getElementById("rule-editor");
  if (!editorEl || editorEl.dataset.editIndex === undefined) return;

  const index = parseInt(editorEl.dataset.editIndex, 10);
  const project = getProject();
  if (!project.rules[index]) return;

  const label = document.getElementById("rule-name").value.trim();
  const action = document.getElementById("rule-data").value;
  const priorityVal = parseInt(document.getElementById("rule-priority").value, 10);
  const isHard = document.getElementById("rule-hard").checked;

  project.rules[index] = {
    ...project.rules[index],
    label: label || `Rule ${index + 1}`,
    action,
    priority: isHard ? "hard" : Math.max(1, Math.min(10, priorityVal)),
  };

  setProject(project);
  setDirty(true);
  saveProject();
  refreshRuleList();
}

export function deleteCurrentRule() {
  const editorEl = document.getElementById("rule-editor");
  if (!editorEl || editorEl.dataset.editIndex === undefined) return;

  const index = parseInt(editorEl.dataset.editIndex, 10);
  const project = getProject();
  project.rules.splice(index, 1);
  setProject(project);
  setDirty(true);
  saveProject();

  document.getElementById("rule-name").value = "";
  document.getElementById("rule-data").value = "balance";
  document.getElementById("rule-priority").value = "5";
  document.getElementById("rule-hard").checked = false;
  delete editorEl.dataset.editIndex;

  refreshRuleList();
}

export function addRule() {
  const project = getProject();
  if (!project.rules) project.rules = [];
  project.rules.push({
    label: "New rule",
    action: "balance",
    priority: 5,
    config: {},
  });
  setProject(project);
  setDirty(true);
  saveProject();
  refreshRuleList();
  editRule(project.rules.length - 1);
}

export function importRulesCsv(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const rules = parseCsvText(text).slice(1).map((row) => ruleFromCsvCells(row));
    const project = getProject();
    project.rules = rules.filter((r) => r !== null);
    setProject(project);
    setDirty(true);
    saveProject();
    refreshRuleList();
  };
  reader.readAsText(file);
}

export function exportRulesCsv() {
  const project = getProject();
  const rows = (project.rules || []).map((rule) => ruleToCsvCells(rule));
  const csv = tableToCsv([RULES_CSV_HEADERS, ...rows]);
  downloadFile(csv, "rules.csv", "text/csv");
}

export function refreshSlotsPerEntryOverrides() {
  const project = getProject();
  const select = document.getElementById("slots-override-entry");
  const list = document.getElementById("slots-override-list");
  if (!select || !list) return;

  const entries = project.entries || [];
  select.innerHTML = '<option value="">Select an entry…</option>' +
    entries.map((entry, i) => `<option value="${i}">${escapeHtml(entry.name || entry.id || `Entry ${i + 1}`)}</option>`).join("");

  const overrides = project.slotsPerEntryOverrides || [];
  if (overrides.length === 0) {
    list.innerHTML = '<li><p class="app-empty-hint">No overrides yet.</p></li>';
    return;
  }

  list.innerHTML = overrides
    .map((override, i) => {
      const entry = entries[override.entryIndex];
      const name = entry ? (entry.name || entry.id || `Entry ${override.entryIndex + 1}`) : `Entry ${override.entryIndex + 1}`;
      return `<li>
        <div>
          <div class="item-primary">${escapeHtml(name)}</div>
          <div class="item-meta">Max ${override.max} slots</div>
        </div>
        <button class="button button-ghost button-small" data-remove-override="${i}">Remove</button>
      </li>`;
    })
    .join("");
}

export function addSlotsPerEntryOverride() {
  const project = getProject();
  const entryIndex = parseInt(document.getElementById("slots-override-entry").value, 10);
  const max = parseInt(document.getElementById("slots-override-max").value, 10);

  if (isNaN(entryIndex)) return;

  if (!project.slotsPerEntryOverrides) project.slotsPerEntryOverrides = [];
  project.slotsPerEntryOverrides.push({ entryIndex, max });
  setProject(project);
  setDirty(true);
  saveProject();
  refreshSlotsPerEntryOverrides();
}

export function removeSlotsPerEntryOverride(index) {
  const project = getProject();
  if (!project.slotsPerEntryOverrides) return;
  project.slotsPerEntryOverrides.splice(index, 1);
  setProject(project);
  setDirty(true);
  saveProject();
  refreshSlotsPerEntryOverrides();
}

export function refreshConflictGroupsSummary() {
  const project = getProject();
  const summaryEl = document.getElementById("conflict-groups-summary");
  if (!summaryEl) return;

  const groups = project.conflictGroups || [];
  if (groups.length === 0) {
    summaryEl.textContent = "No conflict groups yet.";
    return;
  }

  const slots = project.slots || [];
  summaryEl.textContent = groups
    .map((group) => {
      const names = (group.slotIndices || [])
        .map((i) => slots[i]?.name || slots[i]?.id || `Slot ${i + 1}`)
        .filter(Boolean);
      return `${group.name}: ${names.join(", ")}`;
    })
    .join("; ");
}

export function initRulesPanel() {
  refreshRuleList();
  refreshSlotsPerEntryOverrides();
  refreshConflictGroupsSummary();

  document.getElementById("add-rule-btn")?.addEventListener("click", addRule);
  document.getElementById("save-rule-btn")?.addEventListener("click", saveCurrentRule);
  document.getElementById("delete-rule-btn")?.addEventListener("click", deleteCurrentRule);

  document.getElementById("rule-list")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-edit-rule]");
    if (btn) {
      const index = parseInt(btn.dataset.editRule, 10);
      editRule(index);
    }
  });

  document.getElementById("import-rules-btn")?.addEventListener("click", () => {
    document.getElementById("import-rules-file")?.click();
  });

  document.getElementById("import-rules-file")?.addEventListener("change", (e) => {
    if (e.target.files[0]) importRulesCsv(e.target.files[0]);
  });

  document.getElementById("export-rules-csv-btn")?.addEventListener("click", exportRulesCsv);

  document.getElementById("slots-override-add-btn")?.addEventListener("click", addSlotsPerEntryOverride);

  document.getElementById("slots-override-list")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-remove-override]");
    if (btn) {
      const index = parseInt(btn.dataset.removeOverride, 10);
      removeSlotsPerEntryOverride(index);
    }
  });

  document.getElementById("manage-conflicts-btn")?.addEventListener("click", () => {
    document.getElementById("conflict-groups-modal")?.showModal();
  });

  document.querySelectorAll("[data-close-conflict-modal]").forEach((el) => {
    el.addEventListener("click", () => {
      document.getElementById("conflict-groups-modal")?.close();
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

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}