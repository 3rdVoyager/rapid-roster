/**
 * project.js
 *
 * Wires the project workspace page (/app/project/) to:
 *   - state.js          (current project in memory + localStorage)
 *   - project-config.js (tables → configs the generator understands)
 *   - generator/*       (search for good legal placements)
 *
 * What this file does on load:
 *   1. Load a saved project, or create the demo project
 *   2. Draw every panel from that project object
 *   3. Attach click/change listeners to buttons and inputs
 *
 * ---------------------------------------------------------------------------
 * DOM tools used here (quick glossary)
 * ---------------------------------------------------------------------------
 *
 * import { name } from "/js/file.js"
 *   ES module syntax: pull exported functions from another file.
 *   The HTML script tag must say type="module" for this to work.
 *
 * document.getElementById("foo")
 *   Find the one element whose id="foo". Returns null if missing.
 *
 * document.querySelector(".class") / querySelectorAll(...)
 *   Find elements with a CSS selector. querySelector = first match;
 *   querySelectorAll = a list you can loop with a normal for-loop.
 *
 * element.textContent = "hi"
 *   Set the visible text (safe — does not run HTML tags).
 *
 * element.innerHTML = "<b>hi</b>"
 *   Set the HTML inside an element. Only use with trusted markup,
 *   or escape user data first (see escapeHtml below).
 *
 * element.value / element.checked
 *   Read/write form controls (inputs, selects, checkboxes).
 *
 * element.classList.add("x") / .remove("x")
 *   Add or remove a CSS class on an element.
 *
 * element.getAttribute("data-rule-id")
 *   Read an HTML attribute. We store ids on buttons as data-rule-id="...".
 *
 * element.addEventListener("click", handler)
 *   Run handler when that event happens on the element.
 *
 * event.target
 *   The element that was actually clicked (might be a child inside a button).
 *   We walk up parents with findAncestor(...) to find the button we care about.
 *
 * window.location.hash
 *   The "#entries" part of the URL. We use it to remember which panel is open.
 *
 * window.setTimeout(fn, 20)
 *   Run fn after a short delay so the browser can paint "Working…" first.
 */

import {
  getProject,
  setProject,
  getDirty,
  setDirty,
  saveProject,
  persistProject,
  loadProject,
  loadLocalProjectById,
  createEmptyProject,
  serializeProjectFile,
  parseProjectFile
} from "/js/state.js";

import { buildLegalConfig, buildScoreConfig, findColumnKeyByType, findSlotsPerEntryColumnKey } from "/js/project-config.js";
import { defaultSearchOptions } from "/js/generator/search.js";
import { getEntriesInSlot, getSlotsForEntry } from "/js/generator/placement.js";
import { maxPossibleSoftScore } from "/js/generator/score.js";
import { parseCsvText, csvToTable, tableToCsv } from "/js/csv.js";
import {
  PRESET_CATALOG,
  getPresetInfo,
  buildProjectFromPreset,
  parseRulesCsv,
  serializeRulesCsv,
  ruleToCsvCells,
  ruleFromCsvCells,
  RULES_CSV_HEADERS,
  buildConflictGroupsFromSlots,
  listNamedConflictGroupsFromSlots,
  applyNamedConflictGroupsToSlots,
  findConflictGroupColumnKey
} from "/js/presets.js";

/** Valid workflow panel ids (must match section id= and nav href="#..."). */
const PANEL_IDS = ["entries", "slots", "rules", "review", "generate", "results"];

/** Results panel: "by-slot" or "by-entry". */
let resultsViewMode = "by-slot";

/** Results layout: "list" or "grid". */
let resultsLayoutMode = "list";

/** Active Generate worker (null when idle). */
let generateWorker = null;

/** Bumps when a new run starts or cancel fires, so stale worker messages are ignored. */
let generateRunId = 0;

/** Selected row ids for Entries / Slots form editors (null = none). */
let selectedEntryId = null;
let selectedSlotId = null;

/** Column types the user can pick in Setup headers. */
const ENTRIES_COLUMN_TYPES = ["id", "name", "number", "time", "text", "ignore"];
const SLOTS_COLUMN_TYPES = [
  "id",
  "name",
  "minSize",
  "maxSize",
  "text",
  "ignore"
];

/**
 * Id of a pending autosave timer from window.setTimeout.
 * null means nothing is waiting to save.
 */
let saveTimerId = null;

/** True when the preset modal was opened because this is a brand-new project. */
let presetModalForNewProject = false;

/**
 * Draft conflict groups while the Manage modal is open.
 * Shape: { name: string, slotIds: string[] }[]
 */
let conflictEditorDraft = [];

/**
 * Page startup.
 */
async function main() {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("id");
  const isNewProject = params.get("new") === "1";
  let project = null;

  if (projectId !== null && projectId !== "") {
    project = loadLocalProjectById(projectId);
  }

  if (project === null) {
    project = loadProject();
  }

  if (project === null) {
    project = createEmptyProject("Untitled project");
    setProject(project);
    setDirty(false);
  } else {
    setProject(project);
    setDirty(false);
  }

  renderAll();
  wireControls();
  wirePanelNavigation();
  wireLoadPresetModal();
  wireConflictGroupsModal();
  showPanelFromHash();

  if (isNewProject === true) {
    clearNewProjectQueryParam();
    openLoadPresetModal(true);
  }
}

/**
 * Drop ?new=1 from the URL so a refresh does not reopen the preset dialog.
 */
function clearNewProjectQueryParam() {
  const url = new URL(window.location.href);
  if (url.searchParams.has("new") === false) {
    return;
  }
  url.searchParams.delete("new");
  const next = url.pathname + url.search + url.hash;
  window.history.replaceState({}, "", next);
}

/**
 * Re-draw every panel from the current project.
 */
function renderAll() {
  const project = getProject();

  if (project === null) {
    return;
  }

  renderHeader(project);
  renderEntriesTable(project);
  renderSlotsTable(project);
  renderEntriesList(project);
  renderSlotsList(project);
  renderGlobalSetup(project);
  renderRuleList(project);
  renderRulesTable(project);
  renderReview(project);
  renderGenerateOptions(project);
  renderResults(project);
}

function renderHeader(project) {
  const nameEl = document.getElementById("project-name");
  const saveStateEl = document.getElementById("save-state");

  // Do not overwrite the input while the user is typing in it.
  // document.activeElement = whatever currently has keyboard focus.
  if (nameEl !== null && document.activeElement !== nameEl) {
    nameEl.value = project.name;
  }

  if (saveStateEl !== null) {
    if (getDirty() === true) {
      saveStateEl.textContent = "Unsaved";
      saveStateEl.setAttribute("data-state", "unsaved");
    } else {
      saveStateEl.textContent = "Saved";
      saveStateEl.setAttribute("data-state", "saved");
    }
  }
}

function renderGlobalSetup(project) {
  const select = document.getElementById("slots-per-entry");

  if (select !== null) {
    select.value = String(project.setup.defaultSlotsPerEntry);
  }

  // Keep setup.conflictGroups aligned with any conflict_group column.
  syncConflictGroupsFromSlots(project);
}

function renderEntriesTable(project) {
  const table = document.getElementById("entries-table");
  const body = document.getElementById("entries-table-body");

  if (table === null || body === null) {
    return;
  }

  renderTableHeader(table, project.entries.columns, "entries");
  renderTableBody(body, project.entries.columns, project.entries.rows, "entries");
}

function renderSlotsTable(project) {
  const table = document.getElementById("slots-table");
  const body = document.getElementById("slots-table-body");

  if (table === null || body === null) {
    return;
  }

  renderTableHeader(table, project.slots.columns, "slots");
  renderTableBody(body, project.slots.columns, project.slots.rows, "slots");
}

function renderTableHeader(table, columns, tableKind) {
  // querySelector looks inside `table` for the first <thead>.
  const thead = table.querySelector("thead");

  if (thead === null) {
    return;
  }

  let typeOptions = ENTRIES_COLUMN_TYPES;
  if (tableKind === "slots") {
    typeOptions = SLOTS_COLUMN_TYPES;
  }

  // Build an HTML string, then put it into the page in one step.
  // (Longer than createElement loops, but easy to read top-to-bottom.)
  let html = "<tr>";

  for (let i = 0; i < columns.length; i = i + 1) {
    const col = columns[i];
    html =
      html +
      "<th>" +
      '<div class="table-col-heading">' +
      '<span class="table-col-title">' +
      escapeHtml(col.label) +
      "</span>" +
      '<select class="col-type-select" data-table="' +
      escapeHtml(tableKind) +
      '" data-col-index="' +
      i +
      '" aria-label="Type for ' +
      escapeHtml(col.label) +
      '">' +
      buildTypeOptionsHtml(typeOptions, col.type) +
      "</select>" +
      '<button class="button button-ghost button-small table-col-delete" type="button" data-table="' +
      escapeHtml(tableKind) +
      '" data-col-index="' +
      i +
      '" title="Delete column" aria-label="Delete column ' +
      escapeHtml(col.label) +
      '">×</button>' +
      "</div>" +
      "</th>";
  }

  // Extra header cell above the per-row delete buttons.
  html = html + '<th class="table-actions-col"><span class="visually-hidden">Actions</span></th>';
  html = html + "</tr>";
  thead.innerHTML = html;
}

/**
 * Build <option> tags for a column-type dropdown.
 *
 * @param {string[]} typeOptions
 * @param {string} selectedType
 * @returns {string}
 */
function buildTypeOptionsHtml(typeOptions, selectedType) {
  let html = "";

  for (let i = 0; i < typeOptions.length; i = i + 1) {
    const typeName = typeOptions[i];
    let selected = "";
    if (typeName === selectedType) {
      selected = " selected";
    }
    html =
      html +
      '<option value="' +
      escapeHtml(typeName) +
      '"' +
      selected +
      ">" +
      escapeHtml(typeName) +
      "</option>";
  }

  return html;
}

function renderTableBody(tbody, columns, rows, tableKind) {
  let html = "";

  for (let r = 0; r < rows.length; r = r + 1) {
    const row = rows[r];
    html = html + '<tr data-row-index="' + r + '">';

    for (let c = 0; c < columns.length; c = c + 1) {
      const key = columns[c].key;
      let value = row.cells[key];

      if (value === undefined || value === null) {
        value = "";
      }

      // Each cell is an <input> so the user can edit without a separate form.
      // data-* attributes tell the change handler which cell this is.
      html =
        html +
        "<td>" +
        '<input class="table-cell-input" type="text" data-table="' +
        escapeHtml(tableKind) +
        '" data-row-index="' +
        r +
        '" data-col-key="' +
        escapeHtml(key) +
        '" value="' +
        escapeHtml(String(value)) +
        '" />' +
        "</td>";
    }

    html =
      html +
      '<td class="table-actions-col">' +
      '<button class="button button-ghost button-small table-row-delete" type="button" data-table="' +
      escapeHtml(tableKind) +
      '" data-row-index="' +
      r +
      '" aria-label="Delete row">×</button>' +
      "</td>";

    html = html + "</tr>";
  }

  if (rows.length === 0) {
    const colCount = columns.length + 1;
    html =
      '<tr><td colspan="' +
      colCount +
      '">No rows yet. Import a CSV or add a row.</td></tr>';
  }

  tbody.innerHTML = html;
}

/**
 * Left-hand list for the Entries form editor.
 *
 * @param {Object} project
 */
function renderEntriesList(project) {
  const list = document.getElementById("entry-list");

  if (list === null) {
    return;
  }

  if (
    selectedEntryId !== null &&
    findTableRowById(project.entries.rows, selectedEntryId) === null
  ) {
    selectedEntryId = null;
  }

  if (selectedEntryId === null && project.entries.rows.length > 0) {
    selectedEntryId = project.entries.rows[0].id;
  }

  let html = "";

  for (let i = 0; i < project.entries.rows.length; i = i + 1) {
    const row = project.entries.rows[i];
    const label = rowDisplayLabel(row, project.entries.columns);
    let selectedClass = "";

    if (row.id === selectedEntryId) {
      selectedClass = " is-selected";
    }

    html =
      html +
      "<li>" +
      '<button class="rule-list-item' +
      selectedClass +
      '" type="button" data-entry-id="' +
      escapeHtml(row.id) +
      '">' +
      "<strong>" +
      escapeHtml(label) +
      "</strong>" +
      "</button>" +
      "</li>";
  }

  if (project.entries.rows.length === 0) {
    html =
      '<li><p class="app-empty-hint">No entries yet. Click + Add entry or import a CSV.</p></li>';
  }

  list.innerHTML = html;
  fillEntryEditor(project);
}

/**
 * Left-hand list for the Slots form editor.
 *
 * @param {Object} project
 */
function renderSlotsList(project) {
  const list = document.getElementById("slot-list");

  if (list === null) {
    return;
  }

  if (
    selectedSlotId !== null &&
    findTableRowById(project.slots.rows, selectedSlotId) === null
  ) {
    selectedSlotId = null;
  }

  if (selectedSlotId === null && project.slots.rows.length > 0) {
    selectedSlotId = project.slots.rows[0].id;
  }

  let html = "";

  for (let i = 0; i < project.slots.rows.length; i = i + 1) {
    const row = project.slots.rows[i];
    const label = rowDisplayLabel(row, project.slots.columns);
    let selectedClass = "";

    if (row.id === selectedSlotId) {
      selectedClass = " is-selected";
    }

    html =
      html +
      "<li>" +
      '<button class="rule-list-item' +
      selectedClass +
      '" type="button" data-slot-id="' +
      escapeHtml(row.id) +
      '">' +
      "<strong>" +
      escapeHtml(label) +
      "</strong>" +
      "</button>" +
      "</li>";
  }

  if (project.slots.rows.length === 0) {
    html =
      '<li><p class="app-empty-hint">No slots yet. Click + Add slot or import a CSV.</p></li>';
  }

  list.innerHTML = html;
  fillSlotEditor(project);
}

/**
 * @param {Object} row
 * @returns {string}
 */
/**
 * Label for lists/results: optional name column when set, else the row id.
 *
 * @param {Object} row
 * @param {Object[]} columns
 * @returns {string}
 */
function rowDisplayLabel(row, columns) {
  const nameKey = findColumnKeyByType(columns, "name");

  if (nameKey !== null) {
    const value = row.cells[nameKey];

    if (value !== undefined && String(value) !== "") {
      return String(value);
    }
  }

  return row.id;
}

/**
 * @param {Object[]} rows
 * @param {string} id
 * @returns {Object|null}
 */
function findTableRowById(rows, id) {
  for (let i = 0; i < rows.length; i = i + 1) {
    if (rows[i].id === id) {
      return rows[i];
    }
  }
  return null;
}

/**
 * Build dynamic form fields for the selected entry.
 *
 * @param {Object} project
 */
function fillEntryEditor(project) {
  const fieldsEl = document.getElementById("entry-editor-fields");
  const actionsEl = document.getElementById("entry-editor-actions");

  if (fieldsEl === null) {
    return;
  }

  const row = findTableRowById(project.entries.rows, selectedEntryId);

  if (row === null) {
    fieldsEl.innerHTML =
      '<p class="app-empty-hint">Select an entry to edit its fields.</p>';
    if (actionsEl !== null) {
      actionsEl.hidden = true;
    }
    return;
  }

  fieldsEl.innerHTML = buildRowEditorFieldsHtml(
    project.entries.columns,
    row,
    "entry"
  );

  if (actionsEl !== null) {
    actionsEl.hidden = false;
  }
}

/**
 * @param {Object} project
 */
function fillSlotEditor(project) {
  const fieldsEl = document.getElementById("slot-editor-fields");
  const actionsEl = document.getElementById("slot-editor-actions");

  if (fieldsEl === null) {
    return;
  }

  const row = findTableRowById(project.slots.rows, selectedSlotId);

  if (row === null) {
    fieldsEl.innerHTML =
      '<p class="app-empty-hint">Select a slot to edit its fields.</p>';
    if (actionsEl !== null) {
      actionsEl.hidden = true;
    }
    return;
  }

  fieldsEl.innerHTML = buildRowEditorFieldsHtml(
    project.slots.columns,
    row,
    "slot"
  );

  if (actionsEl !== null) {
    actionsEl.hidden = false;
  }
}

/**
 * One input per column for the Entries/Slots form editor.
 *
 * @param {Object[]} columns
 * @param {Object} row
 * @param {string} prefix - "entry" or "slot" (for input ids)
 * @returns {string}
 */
function buildRowEditorFieldsHtml(columns, row, prefix) {
  let html = "";

  for (let i = 0; i < columns.length; i = i + 1) {
    const col = columns[i];
    let value = "";

    if (row.cells[col.key] !== undefined && row.cells[col.key] !== null) {
      value = String(row.cells[col.key]);
    }

    const tableKind = prefix === "slot" ? "slots" : "entries";

    html =
      html +
      '<div class="rule-editor-row editor-field-row">' +
      "<span>" +
      escapeHtml(col.label) +
      "</span>" +
      '<input class="app-input" id="' +
      escapeHtml(prefix) +
      "-field-" +
      escapeHtml(col.key) +
      '" type="text" data-col-key="' +
      escapeHtml(col.key) +
      '" value="' +
      escapeHtml(value) +
      '" style="max-width: none" />' +
      '<button class="button button-ghost button-small editor-field-delete" type="button" data-table="' +
      escapeHtml(tableKind) +
      '" data-col-index="' +
      i +
      '" title="Delete column" aria-label="Delete column ' +
      escapeHtml(col.label) +
      '">×</button>' +
      "</div>";
  }

  if (columns.length === 0) {
    html =
      '<p class="app-empty-hint">No columns yet. Import a CSV on the CSV table tab first.</p>';
  }

  return html;
}

function renderRuleList(project) {
  const list = document.getElementById("rule-list");

  if (list === null) {
    return;
  }

  let html = "";

  for (let i = 0; i < project.rules.length; i = i + 1) {
    const rule = project.rules[i];
    let selectedClass = "";
    if (i === 0) {
      selectedClass = " is-selected";
    }

    html =
      html +
      "<li>" +
      '<button class="rule-list-item' +
      selectedClass +
      '" type="button" data-rule-id="' +
      escapeHtml(rule.id) +
      '">' +
      "<strong>" +
      escapeHtml(rule.name) +
      "</strong>" +
      "</button>" +
      "</li>";
  }

  if (project.rules.length === 0) {
    html =
      '<li><p class="app-empty-hint">No rules yet. Click + Add rule.</p></li>';
  }

  list.innerHTML = html;

  // Show the first rule in the editor if present.
  if (project.rules.length > 0) {
    fillRuleEditor(project.rules[0]);
  }
}

/**
 * CSV projection of project.rules (bulk view).
 *
 * @param {Object} project
 */
function renderRulesTable(project) {
  const body = document.getElementById("rules-table-body");

  if (body === null) {
    return;
  }

  let html = "";

  for (let r = 0; r < project.rules.length; r = r + 1) {
    const cells = ruleToCsvCells(project.rules[r]);
    html = html + '<tr data-row-index="' + r + '">';

    for (let h = 0; h < RULES_CSV_HEADERS.length; h = h + 1) {
      const key = RULES_CSV_HEADERS[h];
      let value = cells[key];

      if (value === undefined || value === null) {
        value = "";
      }

      html =
        html +
        "<td>" +
        '<input class="table-cell-input" type="text" data-table="rules" data-row-index="' +
        r +
        '" data-col-key="' +
        escapeHtml(key) +
        '" value="' +
        escapeHtml(String(value)) +
        '" />' +
        "</td>";
    }

    html =
      html +
      '<td class="table-actions-col">' +
      '<button class="button button-ghost button-small table-row-delete" type="button" data-table="rules" data-row-index="' +
      r +
      '" aria-label="Delete row">×</button>' +
      "</td>";

    html = html + "</tr>";
  }

  if (project.rules.length === 0) {
    html =
      '<tr><td colspan="' +
      (RULES_CSV_HEADERS.length + 1) +
      '">No rules yet. Import a CSV or add a row.</td></tr>';
  }

  body.innerHTML = html;
}

function fillRuleEditor(rule) {
  const nameInput = document.getElementById("rule-name");
  const priorityInput = document.getElementById("rule-priority");
  const hardInput = document.getElementById("rule-hard");

  if (nameInput !== null) {
    nameInput.value = rule.name;
  }

  if (priorityInput !== null) {
    priorityInput.value = String(rule.priority);
  }

  if (hardInput !== null) {
    hardInput.checked = rule.hard === true;
  }

  const typeRadios = document.querySelectorAll('input[name="rule-type"]');

  // querySelectorAll returns a NodeList — loop it like an array.
  for (let i = 0; i < typeRadios.length; i = i + 1) {
    const radio = typeRadios[i];
    radio.checked = radio.value === rule.type;
  }
}

function renderReview(project) {
  syncConflictGroupsFromSlots(project);

  const slotsPerKey = findSlotsPerEntryColumnKey(project.entries.columns);
  let slotsPerLabel = String(project.setup.defaultSlotsPerEntry);
  if (slotsPerKey !== null) {
    let overrideCount = 0;
    for (let i = 0; i < project.entries.rows.length; i = i + 1) {
      const raw = project.entries.rows[i].cells[slotsPerKey];
      if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
        overrideCount = overrideCount + 1;
      }
    }
    if (overrideCount > 0) {
      slotsPerLabel = slotsPerLabel + " (" + overrideCount + " per-entry override(s))";
    } else {
      slotsPerLabel = slotsPerLabel + " (slots_per_entry column present)";
    }
  }
  setText("review-slots-per-entry", slotsPerLabel);

  const namedGroups = listNamedConflictGroupsFromSlots(project.slots);
  let conflictText = "None";
  let conflictSummary = "No conflict groups yet.";

  if (project.setup.conflictGroups.length > 0) {
    conflictText = project.setup.conflictGroups.length + " group(s)";
  }

  if (namedGroups.length > 0) {
    const parts = [];
    for (let i = 0; i < namedGroups.length; i = i + 1) {
      const g = namedGroups[i];
      parts.push(g.name + " (" + g.slotIds.length + ")");
    }
    conflictSummary = parts.join(" · ");
    if (project.setup.conflictGroups.length === 0) {
      conflictSummary =
        conflictSummary +
        " — groups need at least 2 slots to apply.";
    }
  } else if (project.setup.conflictGroups.length > 0) {
    conflictSummary =
      project.setup.conflictGroups.length +
      " conflict group(s) (from saved setup; add a conflict_group column to edit names).";
  }

  setText("review-conflicts", conflictText);
  setText("conflict-groups-summary", conflictSummary);

  let presetLabel = "—";
  if (project.presetId !== undefined && project.presetId !== null) {
    const info = getPresetInfo(project.presetId);
    if (info !== null) {
      presetLabel = info.name;
    } else {
      presetLabel = String(project.presetId);
    }
  }
  setText("review-preset", presetLabel);

  const entriesCount = document.getElementById("review-entries-count");
  if (entriesCount !== null) {
    entriesCount.innerHTML =
      "<strong>" + project.entries.rows.length + "</strong> entries loaded";
  }

  const entriesPreview = document.getElementById("review-entries-preview");
  if (entriesPreview !== null) {
    let html = "";
    const limit = Math.min(8, project.entries.rows.length);

    for (let i = 0; i < limit; i = i + 1) {
      const label = rowDisplayLabel(
        project.entries.rows[i],
        project.entries.columns
      );
      html = html + "<li>" + escapeHtml(label) + "</li>";
    }

    if (project.entries.rows.length > limit) {
      html =
        html + "<li>+" + (project.entries.rows.length - limit) + " more</li>";
    }

    entriesPreview.innerHTML = html;
  }

  const slotsCount = document.getElementById("review-slots-count");
  if (slotsCount !== null) {
    slotsCount.innerHTML =
      "<strong>" + project.slots.rows.length + "</strong> slots";
  }

  const slotsPreview = document.getElementById("review-slots-preview");
  if (slotsPreview !== null) {
    let html = "";

    for (let i = 0; i < project.slots.rows.length; i = i + 1) {
      const row = project.slots.rows[i];
      const label = rowDisplayLabel(row, project.slots.columns);
      const minSize = row.cells.min_size;
      const maxSize = row.cells.max_size;
      const practice = row.cells.practice_night;

      html =
        html +
        "<li><strong>" +
        escapeHtml(label) +
        "</strong><span>min " +
        escapeHtml(String(minSize)) +
        " · max " +
        escapeHtml(String(maxSize));

      if (practice !== undefined) {
        html = html + " · " + escapeHtml(String(practice));
      }

      html = html + "</span></li>";
    }

    slotsPreview.innerHTML = html;
  }

  const rulesList = document.getElementById("review-rules-list");
  if (rulesList !== null) {
    let html = "";

    for (let i = 0; i < project.rules.length; i = i + 1) {
      const rule = project.rules[i];
      let badgeClass = "app-pill";
      let badgeText = "Soft · P" + rule.priority;

      if (rule.hard === true) {
        badgeClass = "app-pill is-active";
        badgeText = "Hard · P" + rule.priority;
      }

      html =
        html +
        "<li>" +
        '<div class="review-rule-top">' +
        "<strong>" +
        escapeHtml(rule.name) +
        "</strong>" +
        '<span class="' +
        badgeClass +
        '">' +
        escapeHtml(badgeText) +
        "</span>" +
        "</div>" +
        "<p>" +
        escapeHtml(describeRule(rule)) +
        "</p>" +
        "</li>";
    }

    if (project.rules.length === 0) {
      html = "<li><p>No rules configured.</p></li>";
    }

    rulesList.innerHTML = html;
  }
}

function describeRule(rule) {
  if (rule.type === "balance") {
    return "Keep " + rule.entryAttribute + " even across slots.";
  }

  if (rule.type === "cluster" && rule.shape === "entriesTogether") {
    return (
      "Entries with the same " + rule.entryAttribute + " prefer the same slot."
    );
  }

  if (rule.type === "cluster" && rule.shape === "entryMatchesSlot") {
    return (
      "Match entry " +
      rule.entryAttribute +
      " to slot " +
      rule.slotAttribute +
      "."
    );
  }

  if (rule.type === "limit") {
    return "Limit filtered entries per slot.";
  }

  if (rule.type === "separate") {
    return "Spread entries who share " + rule.entryAttribute + " across slots.";
  }

  return "Type: " + rule.type;
}

function renderGenerateOptions(project) {
  const list = document.getElementById("generate-options-list");

  if (list === null) {
    return;
  }

  if (project.results === null || project.results.options === undefined) {
    list.innerHTML =
      '<p class="app-empty-hint">No options yet. Click Generate to search.</p>';
    return;
  }

  const options = project.results.options;
  let html = "";

  for (let i = 0; i < options.length; i = i + 1) {
    const option = options[i];
    html =
      html +
      '<div class="option-card">' +
      '<div class="option-card-main">' +
      "<strong>Option #" +
      option.rank +
      "</strong>" +
      '<span class="option-score-pill">Score ' +
      formatScore(option.totalScore) +
      "</span>" +
      "</div>" +
      '<div class="option-card-actions">' +
      '<a class="button button-ghost button-small" href="#results">View</a>' +
      "</div>" +
      "</div>";
  }

  list.innerHTML = html;
}

function renderResults(project) {
  const main = document.getElementById("results-main");
  const picker = document.getElementById("result-set-picker");
  const statsEl = document.getElementById("results-score-stats");

  if (main === null) {
    return;
  }

  syncResultsToggles();

  if (project.results === null || project.results.options === undefined) {
    main.innerHTML =
      '<p class="app-empty-hint">Run Generate first, then pick an option here.</p>';

    if (picker !== null) {
      picker.innerHTML = "";
    }

    if (statsEl !== null) {
      statsEl.hidden = true;
      statsEl.innerHTML = "";
    }

    return;
  }

  const options = project.results.options;
  let selectedRank = project.results.selectedRank;

  if (selectedRank === undefined) {
    selectedRank = 1;
  }

  renderResultsScoreStats(project, options, statsEl);

  if (picker !== null) {
    let pickerHtml = "";

    for (let i = 0; i < options.length; i = i + 1) {
      const option = options[i];
      let active = "";

      if (option.rank === selectedRank) {
        active = " is-active";
      }

      pickerHtml =
        pickerHtml +
        '<button class="results-option-btn' +
        active +
        '" type="button" data-option="' +
        option.rank +
        '">' +
        '<span class="results-option-label">Option ' +
        option.rank +
        "</span>" +
        '<span class="results-option-score">' +
        formatScore(option.totalScore) +
        "</span>" +
        "</button>";
    }

    picker.innerHTML = pickerHtml;
  }

  let selected = options[0];

  for (let i = 0; i < options.length; i = i + 1) {
    if (options[i].rank === selectedRank) {
      selected = options[i];
    }
  }

  let html = "";

  if (resultsViewMode === "by-entry") {
    html = renderResultsByEntry(project, selected);
  } else {
    html = renderResultsBySlot(project, selected);
  }

  html =
    html +
    '<p class="app-empty-hint">Selected option score: ' +
    formatScore(selected.totalScore) +
    "</p>";

  main.innerHTML = html;
}

/**
 * Best possible soft score (all soft rules fully met) vs best generated option.
 *
 * @param {Object} project
 * @param {Object[]} options
 * @param {HTMLElement|null} statsEl
 */
function renderResultsScoreStats(project, options, statsEl) {
  if (statsEl === null) {
    return;
  }

  const maxScore = maxPossibleSoftScore(project.rules);
  let bestScore = 0;

  for (let i = 0; i < options.length; i = i + 1) {
    if (i === 0 || options[i].totalScore > bestScore) {
      bestScore = options[i].totalScore;
    }
  }

  let pctText = "";
  if (maxScore > 0) {
    const pct = Math.round((bestScore / maxScore) * 100);
    pctText =
      '<span class="results-stat-note">' + String(pct) + "% of ideal</span>";
  }

  statsEl.hidden = false;
  statsEl.innerHTML =
    '<div class="results-stat">' +
    '<span class="results-stat-label">Best possible</span>' +
    '<span class="results-stat-value">' +
    formatScore(maxScore) +
    "</span>" +
    '<span class="results-stat-note">All soft rules fully met</span>' +
    "</div>" +
    '<div class="results-stat">' +
    '<span class="results-stat-label">Best option</span>' +
    '<span class="results-stat-value">' +
    formatScore(bestScore) +
    "</span>" +
    pctText +
    "</div>";
}

/**
 * Sync List/Grid and By slot/By entry toggle active states.
 */
function syncResultsToggles() {
  syncToggleGroup("results-layout-toggle", "data-layout", resultsLayoutMode);
  syncToggleGroup("results-group-toggle", "data-view", resultsViewMode);
}

/**
 * @param {string} groupId
 * @param {string} attrName
 * @param {string} activeValue
 */
function syncToggleGroup(groupId, attrName, activeValue) {
  const group = document.getElementById(groupId);

  if (group === null) {
    return;
  }

  const buttons = group.querySelectorAll("[" + attrName + "]");

  for (let i = 0; i < buttons.length; i = i + 1) {
    const button = buttons[i];

    if (button.getAttribute(attrName) === activeValue) {
      button.classList.add("is-active");
    } else {
      button.classList.remove("is-active");
    }
  }
}

/**
 * By slot: names only, grouped under each slot.
 *
 * @param {Object} project
 * @param {Object} selected
 * @returns {string}
 */
function renderResultsBySlot(project, selected) {
  const layoutClass =
    resultsLayoutMode === "grid" ? " results-layout-grid" : " results-layout-list";

  let html = '<div class="results-board' + layoutClass + '">';

  for (let s = 0; s < project.slots.rows.length; s = s + 1) {
    const slotRow = project.slots.rows[s];
    const slotId = slotRow.id;
    const slotName = rowDisplayLabel(slotRow, project.slots.columns);

    const entryIds = getEntriesInSlot(selected.assignments, slotId);

    html =
      html +
      '<section class="results-group">' +
      '<header class="results-group-head">' +
      "<strong>" +
      escapeHtml(slotName) +
      "</strong>" +
      '<span class="results-slot-count">' +
      entryIds.length +
      "</span>" +
      "</header>" +
      '<ul class="results-name-list">';

    for (let p = 0; p < entryIds.length; p = p + 1) {
      const entryRow = findEntryRow(project, entryIds[p]);
      let label = entryIds[p];

      if (entryRow !== null) {
        label = rowDisplayLabel(entryRow, project.entries.columns);
      }

      html = html + "<li>" + escapeHtml(label) + "</li>";
    }

    if (entryIds.length === 0) {
      html = html + '<li class="results-name-empty">No entries</li>';
    }

    html = html + "</ul></section>";
  }

  html = html + "</div>";
  return html;
}

/**
 * By entry: each name with assigned slot(s).
 *
 * @param {Object} project
 * @param {Object} selected
 * @returns {string}
 */
function renderResultsByEntry(project, selected) {
  const layoutClass =
    resultsLayoutMode === "grid" ? " results-layout-grid" : " results-layout-list";

  let html = '<div class="results-board' + layoutClass + '">';

  for (let i = 0; i < project.entries.rows.length; i = i + 1) {
    const entryRow = project.entries.rows[i];
    const entryId = entryRow.id;
    const displayName = rowDisplayLabel(entryRow, project.entries.columns);
    const slotIds = getSlotsForEntry(selected.assignments, entryId);

    let slotHtml = "";

    for (let s = 0; s < slotIds.length; s = s + 1) {
      const slotRow = findSlotRow(project, slotIds[s]);
      let slotName = slotIds[s];

      if (slotRow !== null) {
        slotName = rowDisplayLabel(slotRow, project.slots.columns);
      }

      slotHtml =
        slotHtml +
        '<span class="results-assign-pill">' +
        escapeHtml(slotName) +
        "</span>";
    }

    if (slotIds.length === 0) {
      slotHtml = '<span class="results-assign-empty">Unassigned</span>';
    }

    html =
      html +
      '<div class="results-entry-card">' +
      '<span class="results-entry-name">' +
      escapeHtml(displayName) +
      "</span>" +
      '<div class="results-assign-pills">' +
      slotHtml +
      "</div>" +
      "</div>";
  }

  if (project.entries.rows.length === 0) {
    html = html + '<p class="app-empty-hint">No entries in this project.</p>';
  }

  html = html + "</div>";
  return html;
}

function findEntryRow(project, entryId) {
  for (let i = 0; i < project.entries.rows.length; i = i + 1) {
    if (project.entries.rows[i].id === entryId) {
      return project.entries.rows[i];
    }
  }

  return null;
}

function findSlotRow(project, slotId) {
  for (let i = 0; i < project.slots.rows.length; i = i + 1) {
    if (project.slots.rows[i].id === slotId) {
      return project.slots.rows[i];
    }
  }

  return null;
}

/**
 * Attach click / change handlers once (at page load).
 */
function wireControls() {
  const nameInput = document.getElementById("project-name");
  if (nameInput !== null) {
    // "input" fires on every keystroke; "change" fires when the field blurs
    // after a change (or Enter in some browsers).
    nameInput.addEventListener("input", onProjectNameInput);
    nameInput.addEventListener("change", onProjectNameBlur);
  }

  const exportProjectBtn = document.getElementById("export-project-btn");
  if (exportProjectBtn !== null) {
    exportProjectBtn.addEventListener("click", onExportProjectClick);
  }

  const importProjectFile = document.getElementById("import-project-file");
  if (importProjectFile !== null) {
    importProjectFile.addEventListener("change", onImportProjectFileChange);
  }

  const importEntriesFile = document.getElementById("import-entries-file");
  if (importEntriesFile !== null) {
    importEntriesFile.addEventListener("change", onImportEntriesFileChange);
  }

  const importSlotsFile = document.getElementById("import-slots-file");
  if (importSlotsFile !== null) {
    importSlotsFile.addEventListener("change", onImportSlotsFileChange);
  }

  const clearEntriesBtn = document.getElementById("clear-entries-btn");
  if (clearEntriesBtn !== null) {
    clearEntriesBtn.addEventListener("click", onClearEntriesClick);
  }

  const clearSlotsBtn = document.getElementById("clear-slots-btn");
  if (clearSlotsBtn !== null) {
    clearSlotsBtn.addEventListener("click", onClearSlotsClick);
  }

  const addEntryRowBtn = document.getElementById("add-entry-row-btn");
  if (addEntryRowBtn !== null) {
    addEntryRowBtn.addEventListener("click", onAddEntryRowClick);
  }

  const addSlotRowBtn = document.getElementById("add-slot-row-btn");
  if (addSlotRowBtn !== null) {
    addSlotRowBtn.addEventListener("click", onAddSlotRowClick);
  }

  const addEntryBtn = document.getElementById("add-entry-btn");
  if (addEntryBtn !== null) {
    addEntryBtn.addEventListener("click", onAddEntryClick);
  }

  const addSlotBtn = document.getElementById("add-slot-btn");
  if (addSlotBtn !== null) {
    addSlotBtn.addEventListener("click", onAddSlotClick);
  }

  const saveEntryBtn = document.getElementById("save-entry-btn");
  if (saveEntryBtn !== null) {
    saveEntryBtn.addEventListener("click", onSaveEntryClick);
  }

  const deleteEntryBtn = document.getElementById("delete-entry-btn");
  if (deleteEntryBtn !== null) {
    deleteEntryBtn.addEventListener("click", onDeleteEntryClick);
  }

  const saveSlotBtn = document.getElementById("save-slot-btn");
  if (saveSlotBtn !== null) {
    saveSlotBtn.addEventListener("click", onSaveSlotClick);
  }

  const deleteSlotBtn = document.getElementById("delete-slot-btn");
  if (deleteSlotBtn !== null) {
    deleteSlotBtn.addEventListener("click", onDeleteSlotClick);
  }

  const entryList = document.getElementById("entry-list");
  if (entryList !== null) {
    entryList.addEventListener("click", onEntryListClick);
  }

  const slotList = document.getElementById("slot-list");
  if (slotList !== null) {
    slotList.addEventListener("click", onSlotListClick);
  }

  const entryEditorFields = document.getElementById("entry-editor-fields");
  if (entryEditorFields !== null) {
    entryEditorFields.addEventListener("click", onEditorFieldsClick);
  }

  const slotEditorFields = document.getElementById("slot-editor-fields");
  if (slotEditorFields !== null) {
    slotEditorFields.addEventListener("click", onEditorFieldsClick);
  }

  const exportEntriesCsvBtn = document.getElementById("export-entries-csv-btn");
  if (exportEntriesCsvBtn !== null) {
    exportEntriesCsvBtn.addEventListener("click", onExportEntriesCsvClick);
  }

  const exportSlotsCsvBtn = document.getElementById("export-slots-csv-btn");
  if (exportSlotsCsvBtn !== null) {
    exportSlotsCsvBtn.addEventListener("click", onExportSlotsCsvClick);
  }

  // One listener for all editable cells / type dropdowns / row deletes.
  const entriesTable = document.getElementById("entries-table");
  if (entriesTable !== null) {
    entriesTable.addEventListener("input", onSetupTableInput);
    entriesTable.addEventListener("change", onSetupTableChange);
    entriesTable.addEventListener("click", onSetupTableClick);
  }

  const slotsTable = document.getElementById("slots-table");
  if (slotsTable !== null) {
    slotsTable.addEventListener("input", onSetupTableInput);
    slotsTable.addEventListener("change", onSetupTableChange);
    slotsTable.addEventListener("click", onSetupTableClick);
  }

  const importRulesFile = document.getElementById("import-rules-file");
  if (importRulesFile !== null) {
    importRulesFile.addEventListener("change", onImportRulesFileChange);
  }

  const clearRulesBtn = document.getElementById("clear-rules-btn");
  if (clearRulesBtn !== null) {
    clearRulesBtn.addEventListener("click", onClearRulesClick);
  }

  const addRuleRowBtn = document.getElementById("add-rule-row-btn");
  if (addRuleRowBtn !== null) {
    addRuleRowBtn.addEventListener("click", onAddRuleRowClick);
  }

  const exportRulesCsvBtn = document.getElementById("export-rules-csv-btn");
  if (exportRulesCsvBtn !== null) {
    exportRulesCsvBtn.addEventListener("click", onExportRulesCsvClick);
  }

  const addRuleBtn = document.getElementById("add-rule-btn");
  if (addRuleBtn !== null) {
    addRuleBtn.addEventListener("click", onAddRuleClick);
  }

  const rulesTable = document.getElementById("rules-table");
  if (rulesTable !== null) {
    rulesTable.addEventListener("input", onRulesTableInput);
    rulesTable.addEventListener("change", onRulesTableBlurSync);
    rulesTable.addEventListener("click", onRulesTableClick);
  }

  const slotsPerEntry = document.getElementById("slots-per-entry");
  if (slotsPerEntry !== null) {
    slotsPerEntry.addEventListener("change", onSlotsPerEntryChange);
  }

  const addSlotsPerEntryColBtn = document.getElementById(
    "add-slots-per-entry-col-btn",
  );
  if (addSlotsPerEntryColBtn !== null) {
    addSlotsPerEntryColBtn.addEventListener("click", onAddSlotsPerEntryColClick);
  }

  const manageConflictsBtn = document.getElementById("manage-conflicts-btn");
  if (manageConflictsBtn !== null) {
    manageConflictsBtn.addEventListener("click", openConflictGroupsModal);
  }

  const generateBtn = document.getElementById("generate-btn");
  if (generateBtn !== null) {
    generateBtn.addEventListener("click", onGenerateClick);
  }

  const cancelGenerateBtn = document.getElementById("cancel-generate-btn");
  if (cancelGenerateBtn !== null) {
    cancelGenerateBtn.addEventListener("click", onCancelGenerateClick);
  }

  // One listener on the whole list (event delegation):
  // clicks on child buttons bubble up to #rule-list.
  const ruleList = document.getElementById("rule-list");
  if (ruleList !== null) {
    ruleList.addEventListener("click", onRuleListClick);
  }

  const resultPicker = document.getElementById("result-set-picker");
  if (resultPicker !== null) {
    resultPicker.addEventListener("click", onResultPickerClick);
  }

  const resultsGroupToggle = document.getElementById("results-group-toggle");
  if (resultsGroupToggle !== null) {
    resultsGroupToggle.addEventListener("click", onResultsViewClick);
  }

  const resultsLayoutToggle = document.getElementById("results-layout-toggle");
  if (resultsLayoutToggle !== null) {
    resultsLayoutToggle.addEventListener("click", onResultsLayoutClick);
  }
}

/**
 * Sidebar tabs + in-page "Continue" links:
 * keep the URL hash and the visible panel in sync,
 * without letting the browser scroll to the section id.
 */
function wirePanelNavigation() {
  // Capture clicks on any link whose href is #entries, #rules, …
  document.addEventListener("click", onPanelLinkClick);
  window.addEventListener("hashchange", showPanelFromHash);
}

/**
 * @param {MouseEvent} event
 */
function onPanelLinkClick(event) {
  const link = findAncestor(event.target, "a[href]");

  if (link === null) {
    return;
  }

  const href = link.getAttribute("href");

  if (href === null || href.charAt(0) !== "#") {
    return;
  }

  const panelId = href.slice(1);
  let known = false;

  for (let i = 0; i < PANEL_IDS.length; i = i + 1) {
    if (PANEL_IDS[i] === panelId) {
      known = true;
    }
  }

  // Legacy Setup bookmark → Entries.
  if (panelId === "setup") {
    known = true;
  }

  if (known === false) {
    return;
  }

  // Stop the browser from scrolling to the element with that id.
  event.preventDefault();

  let targetId = panelId;
  if (targetId === "setup") {
    targetId = "entries";
  }

  if (window.location.hash === "#" + targetId) {
    // Clicking the already-active tab: still refresh the active classes.
    showPanel(targetId);
  } else {
    // Changing the hash fires "hashchange", which calls showPanelFromHash.
    window.location.hash = "#" + targetId;
  }
}

/**
 * Read window.location.hash (example: "#rules") and show that panel.
 */
function showPanelFromHash() {
  let panelId = "entries";
  const hash = window.location.hash;

  // hash looks like "#rules". slice(1) drops the leading "#".
  if (hash !== "" && hash !== "#") {
    panelId = hash.slice(1);
  }

  // Old bookmark: Setup was split into Entries + Slots.
  if (panelId === "setup") {
    panelId = "entries";
  }

  showPanel(panelId);
}

/**
 * Show one workflow panel and highlight its sidebar link.
 *
 * @param {string} panelId - "entries" | "slots" | "rules" | …
 */
function showPanel(panelId) {
  let safeId = panelId;

  if (safeId === "setup") {
    safeId = "entries";
  }

  let known = false;

  for (let i = 0; i < PANEL_IDS.length; i = i + 1) {
    if (PANEL_IDS[i] === safeId) {
      known = true;
    }
  }

  if (known === false) {
    safeId = "entries";
  }

  const panels = document.querySelectorAll(".app-panel");

  for (let i = 0; i < panels.length; i = i + 1) {
    const panel = panels[i];

    if (panel.id === safeId) {
      panel.classList.add("is-active");
    } else {
      panel.classList.remove("is-active");
    }
  }

  const navItems = document.querySelectorAll(".app-nav-item");

  for (let i = 0; i < navItems.length; i = i + 1) {
    const item = navItems[i];
    const href = item.getAttribute("href");

    if (href === "#" + safeId) {
      item.classList.add("is-active");
    } else {
      item.classList.remove("is-active");
    }
  }

  // Keep the main scroll area at the top when switching tabs.
  const main = document.querySelector(".app-main");

  if (main !== null) {
    main.scrollTop = 0;
  }
}

async function onImportEntriesFileChange(event) {
  await importCsvIntoTable(event, "entries");
}

async function onImportSlotsFileChange(event) {
  await importCsvIntoTable(event, "slots");
}

/**
 * Import a rules.csv into project.rules (replaces all rules).
 *
 * @param {Event} event
 */
async function onImportRulesFileChange(event) {
  const file = event.target.files[0];

  if (file === undefined || file === null) {
    return;
  }

  try {
    const text = await file.text();
    const rules = parseRulesCsv(text);
    const project = getProject();

    project.rules = rules;
    project.results = null;
    markProjectChanged();
    renderRuleList(project);
    renderRulesTable(project);
    renderReview(project);
    renderGenerateOptions(project);
    renderResults(project);
  } catch (error) {
    console.error("Could not read rules CSV:", error);
    window.alert("Could not read that CSV file.");
  } finally {
    event.target.value = "";
  }
}

function onClearRulesClick() {
  const project = getProject();

  if (project.rules.length === 0) {
    return;
  }

  const ok = window.confirm("Clear all rules?");
  if (ok === false) {
    return;
  }

  project.rules = [];
  project.results = null;
  markProjectChanged();
  renderRuleList(project);
  renderRulesTable(project);
  renderReview(project);
  renderGenerateOptions(project);
  renderResults(project);
}

/**
 * Blank rule row for the CSV table (and editor list).
 *
 * @returns {Object}
 */
function makeBlankRule() {
  return {
    id: "R-" + Date.now().toString(36),
    name: "Untitled rule",
    type: "balance",
    hard: false,
    priority: 5,
    entryAttribute: ""
  };
}

function onAddRuleRowClick() {
  const project = getProject();
  project.rules.push(makeBlankRule());
  project.results = null;
  markProjectChanged();
  renderRuleList(project);
  renderRulesTable(project);
  renderReview(project);
}

/**
 * Header "+ Add rule" — create a rule and show the Editor tab.
 */
function onAddRuleClick() {
  const project = getProject();
  const rule = makeBlankRule();
  project.rules.push(rule);
  project.results = null;
  markProjectChanged();

  const editorTab = document.getElementById("rules-tab-editor");
  if (editorTab !== null) {
    editorTab.checked = true;
  }

  renderRuleList(project);
  renderRulesTable(project);
  selectRuleInList(rule.id);
  fillRuleEditor(rule);
  renderReview(project);
}

function onExportRulesCsvClick() {
  const project = getProject();
  const text = serializeRulesCsv(project.rules);
  downloadTextFile("rules.csv", text);
}

/**
 * @param {string} filename
 * @param {string} text
 * @param {string} [mimeType]
 */
function downloadTextFile(filename, text, mimeType) {
  let type = "text/csv;charset=utf-8";

  if (mimeType !== undefined && mimeType !== "") {
    type = mimeType;
  }

  const blob = new Blob([text], { type: type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download the whole project as a .rapidroster.json file.
 */
function onExportProjectClick() {
  const project = getProject();

  if (project === null) {
    return;
  }

  const text = serializeProjectFile(project);
  const filename = safeProjectFilename(project.name) + ".rapidroster.json";
  downloadTextFile(filename, text, "application/json;charset=utf-8");
}

/**
 * Replace the current project from an exported JSON file.
 *
 * @param {Event} event
 */
async function onImportProjectFileChange(event) {
  const file = event.target.files[0];

  if (file === undefined || file === null) {
    return;
  }

  const ok = window.confirm(
    "Import this project file? It will replace the current entries, slots, rules, setup, and results."
  );

  if (ok === false) {
    event.target.value = "";
    return;
  }

  try {
    const text = await file.text();
    const parsed = parseProjectFile(text);

    if (parsed.ok === false) {
      window.alert(parsed.error);
      return;
    }

    selectedEntryId = null;
    selectedSlotId = null;
    setProject(parsed.project);
    const saved = saveProject();
    if (saved === false) {
      window.alert(
        "Could not save this import in this browser. Check storage space, or delete a project under Projects."
      );
    }
    setDirty(saved === false);
    renderAll();
  } catch (error) {
    console.error("Could not import project:", error);
    window.alert("Could not read that project file.");
  } finally {
    event.target.value = "";
  }
}

/**
 * Turn a project name into a safe download filename stem.
 *
 * @param {string} name
 * @returns {string}
 */
function safeProjectFilename(name) {
  let stem = String(name || "project");
  stem = stem.trim().toLowerCase();
  stem = stem.replace(/[^a-z0-9]+/g, "-");
  stem = stem.replace(/^-+|-+$/g, "");

  if (stem === "") {
    stem = "project";
  }

  return stem;
}

/**
 * Highlight a rule in the list (after Add rule, etc.).
 *
 * @param {string} ruleId
 */
function selectRuleInList(ruleId) {
  const list = document.getElementById("rule-list");

  if (list === null) {
    return;
  }

  const buttons = list.querySelectorAll(".rule-list-item");

  for (let i = 0; i < buttons.length; i = i + 1) {
    const button = buttons[i];

    if (button.getAttribute("data-rule-id") === ruleId) {
      button.classList.add("is-selected");
    } else {
      button.classList.remove("is-selected");
    }
  }
}

/**
 * Typing in the rules CSV table — update project.rules without re-render.
 *
 * @param {Event} event
 */
function onRulesTableInput(event) {
  const input = event.target;

  if (input.classList.contains("table-cell-input") === false) {
    return;
  }

  if (input.getAttribute("data-table") !== "rules") {
    return;
  }

  const rowIndex = Number(input.getAttribute("data-row-index"));
  const colKey = input.getAttribute("data-col-key");
  const project = getProject();

  if (rowIndex < 0 || rowIndex >= project.rules.length) {
    return;
  }

  const cells = ruleToCsvCells(project.rules[rowIndex]);
  cells[colKey] = input.value;

  const parsed = ruleFromCsvCells(cells);

  if (parsed !== null) {
    project.rules[rowIndex] = parsed;
  } else {
    // Type not recognized yet (mid-edit) — keep structure, update scalars.
    const rule = project.rules[rowIndex];

    if (colKey === "id") {
      rule.id = input.value;
    } else if (colKey === "name") {
      rule.name = input.value;
    } else if (colKey === "priority") {
      const priority = Number(input.value);
      if (Number.isNaN(priority) === false) {
        rule.priority = priority;
      }
    } else if (colKey === "hard") {
      const hardRaw = String(input.value).trim().toLowerCase();
      rule.hard =
        hardRaw === "yes" || hardRaw === "true" || hardRaw === "1";
    }
  }

  project.results = null;
  markProjectChanged();
}

/**
 * After a cell blurs, refresh the form list / review from memory.
 */
function onRulesTableBlurSync(event) {
  const input = event.target;

  if (input.classList.contains("table-cell-input") === false) {
    return;
  }

  if (input.getAttribute("data-table") !== "rules") {
    return;
  }

  const project = getProject();
  renderRuleList(project);
  renderReview(project);
  renderGenerateOptions(project);
  renderResults(project);
}

/**
 * Delete a rules CSV row.
 *
 * @param {MouseEvent} event
 */
function onRulesTableClick(event) {
  const button = findAncestor(event.target, ".table-row-delete");

  if (button === null) {
    return;
  }

  if (button.getAttribute("data-table") !== "rules") {
    return;
  }

  const rowIndex = Number(button.getAttribute("data-row-index"));
  const project = getProject();

  if (rowIndex < 0 || rowIndex >= project.rules.length) {
    return;
  }

  project.rules.splice(rowIndex, 1);
  project.results = null;
  markProjectChanged();
  renderRuleList(project);
  renderRulesTable(project);
  renderReview(project);
  renderGenerateOptions(project);
  renderResults(project);
}

/**
 * Shared CSV import for people or slots.
 *
 * @param {Event} event - change event from <input type="file">
 * @param {string} tableKind - "entries" or "slots"
 */
async function importCsvIntoTable(event, tableKind) {
  const file = event.target.files[0];

  if (file === undefined || file === null) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = parseCsvText(text);

    if (parsed === null) {
      window.alert("That CSV looks empty.");
      return;
    }

    const table = csvToTable(parsed, tableKind);
    const project = getProject();

    if (tableKind === "entries") {
      project.entries.columns = table.columns;
      project.entries.rows = table.rows;
    } else {
      project.slots.columns = table.columns;
      project.slots.rows = table.rows;
      syncConflictGroupsFromSlots(project);
    }

    // Old results used previous ids — they are no longer valid.
    project.results = null;
    markProjectChanged();

    if (tableKind === "entries") {
      selectedEntryId = null;
      renderEntriesTable(project);
      renderEntriesList(project);
    } else {
      selectedSlotId = null;
      renderSlotsTable(project);
      renderSlotsList(project);
    }

    renderReview(project);
    renderGenerateOptions(project);
    renderResults(project);
  } catch (error) {
    console.error("Could not read CSV:", error);
    window.alert("Could not read that CSV file.");
  } finally {
    // Clear the input so choosing the same file again still fires "change".
    event.target.value = "";
  }
}

function onClearEntriesClick() {
  const project = getProject();

  if (project.entries.rows.length === 0) {
    return;
  }

  const ok = window.confirm("Clear all entry rows? Column headers stay.");
  if (ok === false) {
    return;
  }

  project.entries.rows = [];
  selectedEntryId = null;
  project.results = null;
  markProjectChanged();
  renderEntriesTable(project);
  renderEntriesList(project);
  renderReview(project);
  renderGenerateOptions(project);
  renderResults(project);
}

function onClearSlotsClick() {
  const project = getProject();

  if (project.slots.rows.length === 0) {
    return;
  }

  const ok = window.confirm("Clear all slot rows? Column headers stay.");
  if (ok === false) {
    return;
  }

  project.slots.rows = [];
  selectedSlotId = null;
  syncConflictGroupsFromSlots(project);
  project.results = null;
  markProjectChanged();
  renderSlotsTable(project);
  renderSlotsList(project);
  renderReview(project);
  renderGenerateOptions(project);
  renderResults(project);
}

function onAddEntryRowClick() {
  const project = getProject();
  ensureDefaultEntriesColumns(project);
  const row = makeEmptyRow(project.entries.columns, "entry");
  project.entries.rows.push(row);
  selectedEntryId = row.id;
  project.results = null;
  markProjectChanged();
  renderEntriesTable(project);
  renderEntriesList(project);
  renderReview(project);
}

function onAddSlotRowClick() {
  const project = getProject();
  ensureDefaultSlotsColumns(project);
  const row = makeEmptyRow(project.slots.columns, "slot");
  project.slots.rows.push(row);
  selectedSlotId = row.id;
  project.results = null;
  markProjectChanged();
  renderSlotsTable(project);
  renderSlotsList(project);
  renderReview(project);
}

/**
 * Header "+ Add entry" — create a row and show the Editor tab.
 */
function onAddEntryClick() {
  const project = getProject();
  ensureDefaultEntriesColumns(project);
  const row = makeEmptyRow(project.entries.columns, "entry");
  project.entries.rows.push(row);
  selectedEntryId = row.id;
  project.results = null;
  markProjectChanged();

  const editorTab = document.getElementById("entries-tab-editor");
  if (editorTab !== null) {
    editorTab.checked = true;
  }

  renderEntriesTable(project);
  renderEntriesList(project);
  renderReview(project);
}

function onAddSlotClick() {
  const project = getProject();
  ensureDefaultSlotsColumns(project);
  const row = makeEmptyRow(project.slots.columns, "slot");
  project.slots.rows.push(row);
  selectedSlotId = row.id;
  project.results = null;
  markProjectChanged();

  const editorTab = document.getElementById("slots-tab-editor");
  if (editorTab !== null) {
    editorTab.checked = true;
  }

  renderSlotsTable(project);
  renderSlotsList(project);
  renderReview(project);
}

function onExportEntriesCsvClick() {
  const project = getProject();
  downloadTextFile("entries.csv", tableToCsv(project.entries));
}

function onExportSlotsCsvClick() {
  const project = getProject();
  downloadTextFile("slots.csv", tableToCsv(project.slots));
}

/**
 * @param {MouseEvent} event
 */
function onEntryListClick(event) {
  const button = findAncestor(event.target, "[data-entry-id]");

  if (button === null) {
    return;
  }

  selectedEntryId = button.getAttribute("data-entry-id");
  renderEntriesList(getProject());
}

/**
 * @param {MouseEvent} event
 */
function onSlotListClick(event) {
  const button = findAncestor(event.target, "[data-slot-id]");

  if (button === null) {
    return;
  }

  selectedSlotId = button.getAttribute("data-slot-id");
  renderSlotsList(getProject());
}

function onSaveEntryClick() {
  const project = getProject();
  const row = findTableRowById(project.entries.rows, selectedEntryId);

  if (row === null) {
    return;
  }

  applyEditorFieldsToRow(project.entries.columns, row, "entry");
  project.results = null;
  markProjectChanged();
  renderEntriesTable(project);
  renderEntriesList(project);
  renderReview(project);
  renderGenerateOptions(project);
  renderResults(project);
}

function onSaveSlotClick() {
  const project = getProject();
  const row = findTableRowById(project.slots.rows, selectedSlotId);

  if (row === null) {
    return;
  }

  applyEditorFieldsToRow(project.slots.columns, row, "slot");
  project.results = null;
  markProjectChanged();
  renderSlotsTable(project);
  renderSlotsList(project);
  renderReview(project);
  renderGenerateOptions(project);
  renderResults(project);
}

/**
 * Read form inputs into a table row (and sync row.id from the id column).
 *
 * @param {Object[]} columns
 * @param {Object} row
 * @param {string} prefix - "entry" or "slot"
 */
function applyEditorFieldsToRow(columns, row, prefix) {
  for (let i = 0; i < columns.length; i = i + 1) {
    const col = columns[i];
    const input = document.getElementById(prefix + "-field-" + col.key);

    if (input === null) {
      continue;
    }

    let value = input.value;

    if (
      (col.type === "number" || col.type === "minSize" || col.type === "maxSize") &&
      value !== "" &&
      Number.isNaN(Number(value)) === false
    ) {
      value = Number(value);
    }

    row.cells[col.key] = value;

    if (col.type === "id") {
      const oldId = row.id;

      if (String(value).trim() === "") {
        row.id = prefix + "-row";
      } else {
        row.id = String(value);
      }

      if (prefix === "entry" && selectedEntryId === oldId) {
        selectedEntryId = row.id;
      }

      if (prefix === "slot" && selectedSlotId === oldId) {
        selectedSlotId = row.id;
      }
    }
  }
}

function onDeleteEntryClick() {
  const project = getProject();

  if (selectedEntryId === null) {
    return;
  }

  const ok = window.confirm("Delete this entry?");
  if (ok === false) {
    return;
  }

  const nextRows = [];

  for (let i = 0; i < project.entries.rows.length; i = i + 1) {
    if (project.entries.rows[i].id !== selectedEntryId) {
      nextRows.push(project.entries.rows[i]);
    }
  }

  project.entries.rows = nextRows;
  selectedEntryId = null;
  project.results = null;
  markProjectChanged();
  renderEntriesTable(project);
  renderEntriesList(project);
  renderReview(project);
  renderGenerateOptions(project);
  renderResults(project);
}

function onDeleteSlotClick() {
  const project = getProject();

  if (selectedSlotId === null) {
    return;
  }

  const ok = window.confirm("Delete this slot?");
  if (ok === false) {
    return;
  }

  const nextRows = [];

  for (let i = 0; i < project.slots.rows.length; i = i + 1) {
    if (project.slots.rows[i].id !== selectedSlotId) {
      nextRows.push(project.slots.rows[i]);
    }
  }

  project.slots.rows = nextRows;
  selectedSlotId = null;
  project.results = null;
  markProjectChanged();
  renderSlotsTable(project);
  renderSlotsList(project);
  renderReview(project);
  renderGenerateOptions(project);
  renderResults(project);
}

/**
 * If people columns were wiped, restore a minimal set so Add row works.
 */
function ensureDefaultEntriesColumns(project) {
  if (project.entries.columns.length > 0) {
    return;
  }

  project.entries.columns = [
    { key: "id", label: "id", type: "id" },
    { key: "name", label: "name", type: "name" }
  ];
}

function ensureDefaultSlotsColumns(project) {
  if (project.slots.columns.length > 0) {
    return;
  }

  project.slots.columns = [
    { key: "id", label: "id", type: "id" },
    { key: "name", label: "name", type: "name" },
    { key: "min_size", label: "min_size", type: "minSize" },
    { key: "max_size", label: "max_size", type: "maxSize" }
  ];
}

/**
 * New blank row with empty cells for every column.
 *
 * @param {Object[]} columns
 * @param {string} idPrefix
 * @returns {Object}
 */
function makeEmptyRow(columns, idPrefix) {
  const rowId = idPrefix + "-" + Date.now().toString(36);
  const cells = {};

  for (let i = 0; i < columns.length; i = i + 1) {
    const key = columns[i].key;
    cells[key] = "";

    // Prefill the id cell so the row has a visible id immediately.
    if (columns[i].type === "id") {
      cells[key] = rowId;
    }
  }

  return {
    id: rowId,
    cells: cells
  };
}

/**
 * Typing in a cell input — update memory, do NOT re-render (keeps focus).
 */
function onSetupTableInput(event) {
  const input = event.target;

  if (input.classList.contains("table-cell-input") === false) {
    return;
  }

  const tableKind = input.getAttribute("data-table");
  const rowIndex = Number(input.getAttribute("data-row-index"));
  const colKey = input.getAttribute("data-col-key");
  const project = getProject();
  const table = getSetupTable(project, tableKind);

  if (table === null) {
    return;
  }

  if (rowIndex < 0 || rowIndex >= table.rows.length) {
    return;
  }

  const row = table.rows[rowIndex];
  let value = input.value;

  // Store numbers as real numbers when the column type says so.
  const colType = findColumnType(table.columns, colKey);
  if (
    (colType === "number" || colType === "minSize" || colType === "maxSize") &&
    value !== "" &&
    Number.isNaN(Number(value)) === false
  ) {
    value = Number(value);
  }

  row.cells[colKey] = value;

  // Keep row.id in sync with the id column cell.
  if (colType === "id") {
    const oldId = row.id;

    if (String(value).trim() === "") {
      row.id = tableKind + "-row-" + rowIndex;
    } else {
      row.id = String(value);
    }

    if (tableKind === "entries" && selectedEntryId === oldId) {
      selectedEntryId = row.id;
    }

    if (tableKind === "slots" && selectedSlotId === oldId) {
      selectedSlotId = row.id;
    }
  }

  project.results = null;
  markProjectChanged();
}

/**
 * Change on a column-type <select>, or blur sync after a cell edit.
 */
function onSetupTableChange(event) {
  const target = event.target;
  const project = getProject();

  if (target.classList.contains("table-cell-input") === true) {
    const tableKind = target.getAttribute("data-table");

    if (tableKind === "entries") {
      renderEntriesList(project);
    } else if (tableKind === "slots") {
      syncConflictGroupsFromSlots(project);
      renderSlotsList(project);
    }

    renderReview(project);
    return;
  }

  if (target.classList.contains("col-type-select") === false) {
    return;
  }

  const tableKind = target.getAttribute("data-table");
  const colIndex = Number(target.getAttribute("data-col-index"));
  const table = getSetupTable(project, tableKind);

  if (table === null) {
    return;
  }

  if (colIndex < 0 || colIndex >= table.columns.length) {
    return;
  }

  table.columns[colIndex].type = target.value;
  project.results = null;
  markProjectChanged();

  // Name (and other typed columns) affect list/results labels.
  if (tableKind === "entries") {
    renderEntriesList(project);
  } else if (tableKind === "slots") {
    renderSlotsList(project);
  }

  renderReview(project);
  renderResults(project);
}

/**
 * Click on a row delete or column delete button in the CSV table.
 */
function onSetupTableClick(event) {
  const colDeleteBtn = findAncestor(event.target, ".table-col-delete");
  if (colDeleteBtn !== null) {
    const tableKind = colDeleteBtn.getAttribute("data-table");
    const colIndex = Number(colDeleteBtn.getAttribute("data-col-index"));
    deleteSetupColumn(tableKind, colIndex);
    return;
  }

  const button = findAncestor(event.target, ".table-row-delete");

  if (button === null) {
    return;
  }

  const tableKind = button.getAttribute("data-table");
  const rowIndex = Number(button.getAttribute("data-row-index"));
  const project = getProject();
  const table = getSetupTable(project, tableKind);

  if (table === null) {
    return;
  }

  if (rowIndex < 0 || rowIndex >= table.rows.length) {
    return;
  }

  // splice(index, 1) removes 1 item at that index.
  table.rows.splice(rowIndex, 1);
  project.results = null;
  markProjectChanged();

  if (tableKind === "entries") {
    renderEntriesTable(project);
    renderEntriesList(project);
  } else {
    syncConflictGroupsFromSlots(project);
    renderSlotsTable(project);
    renderSlotsList(project);
  }

  renderReview(project);
  renderGenerateOptions(project);
  renderResults(project);
}

/**
 * Remove a column from entries or slots (CSV + editor share this).
 *
 * @param {string} tableKind - "entries" or "slots"
 * @param {number} colIndex
 */
function deleteSetupColumn(tableKind, colIndex) {
  const project = getProject();
  const table = getSetupTable(project, tableKind);

  if (table === null) {
    return;
  }

  if (colIndex < 0 || colIndex >= table.columns.length) {
    return;
  }

  if (table.columns.length <= 1) {
    window.alert("Keep at least one column.");
    return;
  }

  const col = table.columns[colIndex];
  let message = 'Delete column "' + col.label + '" from all rows?';

  if (col.type === "id") {
    message =
      'This is the id column ("' +
      col.label +
      '"). Delete it anyway? Row ids will stay as they are.';
  }

  if (window.confirm(message) === false) {
    return;
  }

  const key = col.key;
  table.columns.splice(colIndex, 1);

  for (let r = 0; r < table.rows.length; r = r + 1) {
    delete table.rows[r].cells[key];
  }

  project.results = null;
  markProjectChanged();

  if (tableKind === "entries") {
    renderEntriesTable(project);
    renderEntriesList(project);
    fillEntryEditor(project);
  } else {
    syncConflictGroupsFromSlots(project);
    renderSlotsTable(project);
    renderSlotsList(project);
    fillSlotEditor(project);
  }

  renderReview(project);
  renderGenerateOptions(project);
  renderResults(project);
}

/**
 * Column delete (×) inside the Entries/Slots form editor.
 *
 * @param {MouseEvent} event
 */
function onEditorFieldsClick(event) {
  const button = findAncestor(event.target, ".editor-field-delete");
  if (button === null) {
    return;
  }

  const tableKind = button.getAttribute("data-table");
  const colIndex = Number(button.getAttribute("data-col-index"));
  deleteSetupColumn(tableKind, colIndex);
}

/**
 * @param {Object} project
 * @param {string} tableKind
 * @returns {Object|null}
 */
function getSetupTable(project, tableKind) {
  if (tableKind === "entries") {
    return project.entries;
  }

  if (tableKind === "slots") {
    return project.slots;
  }

  return null;
}

/**
 * @param {Object[]} columns
 * @param {string} key
 * @returns {string|null}
 */
function findColumnType(columns, key) {
  for (let i = 0; i < columns.length; i = i + 1) {
    if (columns[i].key === key) {
      return columns[i].type;
    }
  }

  return null;
}

/**
 * Mark unsaved, update the header pill, and schedule a localStorage write.
 *
 * Debounce: if the user keeps typing, we reset the timer so we only save
 * once they pause (~400ms). That avoids writing on every single keystroke.
 */
function markProjectChanged() {
  setDirty(true);
  renderHeader(getProject());

  if (saveTimerId !== null) {
    window.clearTimeout(saveTimerId);
  }

  saveTimerId = window.setTimeout(async function () {
    saveTimerId = null;
    const result = await persistProject();
    if (result.local === true) {
      renderHeader(getProject());
    }
  }, 400);
}

/**
 * Write the current project to localStorage without showing Unsaved.
 * Cancels any pending debounced save so we do not double-write.
 */
function persistProjectQuietly() {
  if (saveTimerId !== null) {
    window.clearTimeout(saveTimerId);
    saveTimerId = null;
  }

  persistProject().then(function (result) {
    if (result.local === true) {
      renderHeader(getProject());
    }
  });
}

function onProjectNameInput(event) {
  const project = getProject();

  // While typing, keep the raw value (including spaces).
  // Empty string is allowed temporarily; blur will fix it.
  project.name = event.target.value;
  markProjectChanged();
}

function onProjectNameBlur(event) {
  const project = getProject();
  let nextName = event.target.value.trim();

  if (nextName === "") {
    nextName = "Untitled project";
  }

  project.name = nextName;
  event.target.value = nextName;
  markProjectChanged();
}

function onSlotsPerEntryChange(event) {
  const project = getProject();
  // Number(...) turns the select's string value into a real number.
  project.setup.defaultSlotsPerEntry = Number(event.target.value);
  markProjectChanged();
  renderReview(project);
}

/**
 * Add an optional slots_per_entry number column on Entries.
 * Blank cells keep using the global default.
 */
function onAddSlotsPerEntryColClick() {
  const project = getProject();
  ensureDefaultEntriesColumns(project);

  const existing = findSlotsPerEntryColumnKey(project.entries.columns);
  if (existing !== null) {
    window.alert(
      "Entries already has a \"" +
        existing +
        "\" column. Fill a number per person to override the global default; leave blank to use the default.",
    );
    window.location.hash = "#entries";
    return;
  }

  const key = "slots_per_entry";
  project.entries.columns.push({
    key: key,
    label: "slots_per_entry",
    type: "number",
  });

  for (let i = 0; i < project.entries.rows.length; i = i + 1) {
    project.entries.rows[i].cells[key] = "";
  }

  project.results = null;
  markProjectChanged();
  renderEntriesTable(project);
  renderEntriesList(project);
  renderReview(project);
  window.location.hash = "#entries";
}

function onRuleListClick(event) {
  // event.target might be the <strong> inside the button — walk up.
  const button = findAncestor(event.target, ".rule-list-item");

  if (button === null) {
    return;
  }

  const ruleId = button.getAttribute("data-rule-id");
  const project = getProject();

  for (let i = 0; i < project.rules.length; i = i + 1) {
    if (project.rules[i].id === ruleId) {
      fillRuleEditor(project.rules[i]);
    }
  }

  const items = document.querySelectorAll(".rule-list-item");

  for (let i = 0; i < items.length; i = i + 1) {
    items[i].classList.remove("is-selected");
  }

  button.classList.add("is-selected");
}

function onResultPickerClick(event) {
  const button = findAncestor(event.target, "[data-option]");

  if (button === null) {
    return;
  }

  const project = getProject();

  if (project.results === null) {
    return;
  }

  project.results.selectedRank = Number(button.getAttribute("data-option"));
  // Persist which option is selected, but do not flash Unsaved — this is
  // browsing generated results, not editing people/slots/rules.
  persistProjectQuietly();
  renderResults(project);
}

function onResultsViewClick(event) {
  const button = findAncestor(event.target, "[data-view]");

  if (button === null) {
    return;
  }

  const view = button.getAttribute("data-view");

  if (view !== "by-slot" && view !== "by-entry") {
    return;
  }

  resultsViewMode = view;
  renderResults(getProject());
}

function onResultsLayoutClick(event) {
  const button = findAncestor(event.target, "[data-layout]");

  if (button === null) {
    return;
  }

  const layout = button.getAttribute("data-layout");

  if (layout !== "list" && layout !== "grid") {
    return;
  }

  resultsLayoutMode = layout;
  renderResults(getProject());
}

function onGenerateClick() {
  runGeneration();
}

function onCancelGenerateClick() {
  cancelGeneration();
}

/**
 * Ask the worker to stop. Keeps best-so-far if the search already found options.
 * Hard-terminates if the worker does not answer quickly.
 */
function cancelGeneration() {
  const statusTitle = document.getElementById("generate-status-title");
  const statusDetail = document.getElementById("generate-status-detail");

  if (generateWorker === null) {
    setGenerateBusy(false);
    setGenerateProgress(null);
    return;
  }

  if (statusTitle !== null) {
    statusTitle.textContent = "Cancelling…";
  }

  if (statusDetail !== null) {
    statusDetail.textContent = "Stopping after the current step…";
  }

  try {
    generateWorker.postMessage({ type: "cancel" });
  } catch (error) {
    // Worker may already be gone.
  }

  const runIdAtCancel = generateRunId;
  const workerToStop = generateWorker;

  window.setTimeout(function () {
    if (generateRunId !== runIdAtCancel) {
      return;
    }

    if (generateWorker !== workerToStop) {
      return;
    }

    // Worker did not finish after soft cancel — force stop.
    generateRunId = generateRunId + 1;
    try {
      workerToStop.terminate();
    } catch (error) {
      // Ignore.
    }
    generateWorker = null;
    setGenerateBusy(false);
    setGenerateProgress(null);

    if (statusTitle !== null) {
      statusTitle.textContent = "Cancelled";
    }
    if (statusDetail !== null) {
      statusDetail.textContent =
        "Search stopped. Start again when you are ready.";
    }
  }, 2500);
}

/**
 * @param {boolean} busy
 */
function setGenerateBusy(busy) {
  const generateBtn = document.getElementById("generate-btn");
  const cancelBtn = document.getElementById("cancel-generate-btn");

  if (generateBtn !== null) {
    generateBtn.disabled = busy === true;
  }

  if (cancelBtn !== null) {
    cancelBtn.disabled = busy !== true;
  }
}

/**
 * @param {{ percent: number, label: string }|null} state
 */
function setGenerateProgress(state) {
  const wrap = document.getElementById("generate-progress");
  const fill = document.getElementById("generate-progress-fill");
  const label = document.getElementById("generate-progress-label");

  if (wrap === null) {
    return;
  }

  if (state === null || state === undefined) {
    wrap.hidden = true;
    if (fill !== null) {
      fill.style.width = "0%";
    }
    if (label !== null) {
      label.textContent = "";
    }
    return;
  }

  wrap.hidden = false;

  let percent = state.percent;
  if (percent < 0) {
    percent = 0;
  }
  if (percent > 100) {
    percent = 100;
  }

  if (fill !== null) {
    fill.style.width = String(percent) + "%";
  }

  if (label !== null) {
    label.textContent = state.label || "";
  }
}

/**
 * Run search in a Web Worker so the page stays usable, with a progress bar.
 */
function runGeneration() {
  const project = getProject();
  const legalConfig = buildLegalConfig(project);
  const scoreConfig = buildScoreConfig(project);
  const entryCount =
    project.entries && project.entries.rows ? project.entries.rows.length : 0;
  const searchOptions = defaultSearchOptions(entryCount);

  const statusTitle = document.getElementById("generate-status-title");
  const statusDetail = document.getElementById("generate-status-detail");

  if (generateWorker !== null) {
    try {
      generateWorker.terminate();
    } catch (error) {
      // Ignore.
    }
    generateWorker = null;
  }

  generateRunId = generateRunId + 1;
  const runId = generateRunId;

  setGenerateBusy(true);
  setGenerateProgress({
    percent: 2,
    label: "Starting search…"
  });

  // Clear previous results so the UI shows "searching" until the first option lands.
  project.results = null;
  renderGenerateOptions(project);
  renderResults(project);

  if (statusTitle !== null) {
    statusTitle.textContent = "Working…";
  }

  if (statusDetail !== null) {
    let detail =
      "Searching in the background · up to " +
      String(searchOptions.maxAttempts) +
      " attempts · top " +
      String(searchOptions.optionCount) +
      " options";
    if (searchOptions.timeBudgetMs !== null) {
      detail =
        detail +
        " · time budget " +
        String(Math.round(searchOptions.timeBudgetMs / 1000)) +
        "s";
    }
    statusDetail.textContent = detail;
  }

  let worker = null;

  try {
    worker = new Worker("/js/generator/search-worker.js", {
      type: "module"
    });
  } catch (error) {
    console.error(error);
    setGenerateBusy(false);
    setGenerateProgress(null);
    if (statusTitle !== null) {
      statusTitle.textContent = "Failed";
    }
    if (statusDetail !== null) {
      statusDetail.textContent =
        "Could not start the background search worker in this browser.";
    }
    return;
  }

  generateWorker = worker;

  worker.onmessage = function (event) {
    if (runId !== generateRunId) {
      return;
    }

    const message = event.data;

    if (message.type === "progress") {
      applyGenerateProgress(message.info, searchOptions);
      return;
    }

    if (message.type === "options") {
      applyStreamingOptions(project, message.options, runId, searchOptions);
      return;
    }

    if (message.type === "result") {
      finishGeneration(message.result, project, runId);
    }
  };

  worker.onerror = function (error) {
    console.error(error);
    if (runId !== generateRunId) {
      return;
    }

    generateWorker = null;
    setGenerateBusy(false);
    setGenerateProgress(null);

    if (statusTitle !== null) {
      statusTitle.textContent = "Failed";
    }
    if (statusDetail !== null) {
      statusDetail.textContent =
        "Search worker error. Check the browser console for details.";
    }
  };

  worker.postMessage({
    type: "run",
    legalConfig: legalConfig,
    scoreConfig: scoreConfig,
    options: searchOptions
  });
}

/**
 * Update status text + progress bar from worker progress events.
 *
 * @param {Object} info
 * @param {Object} searchOptions
 */
function applyGenerateProgress(info, searchOptions) {
  const statusDetail = document.getElementById("generate-status-detail");
  const maxAttempts = searchOptions.maxAttempts || 1;
  const budgetMs = searchOptions.timeBudgetMs;

  let percent = 0;
  let label = "";

  if (info.phase === "attempt") {
    percent = Math.round((info.attempt / maxAttempts) * 100);
    label =
      "Attempt " +
      String(info.attempt) +
      " of " +
      String(maxAttempts);

    if (statusDetail !== null) {
      let detail =
        "Attempt " +
        info.attempt +
        " of up to " +
        info.maxAttempts +
        " · keeping top " +
        String(info.kept);
      if (info.bestScore !== null && info.bestScore !== undefined) {
        detail = detail + " · best " + formatScore(info.bestScore);
      }
      if (info.stagnantAttempts > 0) {
        detail =
          detail +
          " · no improvement ×" +
          String(info.stagnantAttempts);
      }
      if (info.elapsedMs !== undefined && budgetMs !== null) {
        detail =
          detail +
          " · " +
          String(Math.round(info.elapsedMs / 1000)) +
          "s / " +
          String(Math.round(budgetMs / 1000)) +
          "s";
      }
      statusDetail.textContent = detail;
    }
  } else if (info.phase === "improving") {
    percent = Math.min(
      99,
      Math.round(((info.entryIndex || 0) / Math.max(info.entryCount || 1, 1)) * 100)
    );
    // Prefer attempt progress when we know it from a prior attempt event —
    // improving events do not always include attempt number.
    label =
      "Improve pass " +
      String(info.pass) +
      " · person " +
      String(info.entryIndex) +
      "/" +
      String(info.entryCount);

    if (statusDetail !== null) {
      statusDetail.textContent =
        "Attempt improve pass " +
        info.pass +
        " · best " +
        formatScore(info.bestScore);
    }
  } else if (info.phase === "shake") {
    percent = Math.round(((info.attempt || 1) / maxAttempts) * 100);
    label = "Shaking layout…";
  } else if (info.phase === "done") {
    percent = 100;
    label = "Finishing…";
  }

  if (budgetMs !== null && info.elapsedMs !== undefined) {
    const timePercent = Math.round((info.elapsedMs / budgetMs) * 100);
    if (timePercent > percent) {
      percent = timePercent;
    }
  }

  setGenerateProgress({
    percent: percent,
    label: label
  });
}

/**
 * Apply a mid-search options list so the user can browse while search continues.
 *
 * @param {Object} project
 * @param {Object[]} options
 * @param {number} runId
 * @param {Object} searchOptions
 */
function applyStreamingOptions(project, options, runId, searchOptions) {
  if (runId !== generateRunId) {
    return;
  }

  if (options === undefined || options.length === 0) {
    return;
  }

  let selectedRank = 1;
  if (
    project.results !== null &&
    project.results.selectedRank !== undefined
  ) {
    selectedRank = project.results.selectedRank;
  }

  // Keep the same option number if it still exists; otherwise fall back to #1.
  if (selectedRank > options.length) {
    selectedRank = 1;
  }

  project.results = {
    options: options,
    selectedRank: selectedRank
  };

  persistProjectQuietly();
  renderGenerateOptions(project);
  renderResults(project);

  const statusTitle = document.getElementById("generate-status-title");
  const statusDetail = document.getElementById("generate-status-detail");
  const targetCount = searchOptions.optionCount || 5;

  if (statusTitle !== null) {
    statusTitle.textContent = "Working…";
  }

  if (statusDetail !== null) {
    statusDetail.textContent =
      String(options.length) +
      " of up to " +
      String(targetCount) +
      " option(s) ready · best " +
      formatScore(options[0].totalScore) +
      " · still searching…";
  }
}

/**
 * Apply a finished search result to the project + UI.
 *
 * @param {Object} result
 * @param {Object} project
 * @param {number} runId
 */
function finishGeneration(result, project, runId) {
  if (runId !== generateRunId) {
    return;
  }

  if (generateWorker !== null) {
    try {
      generateWorker.terminate();
    } catch (error) {
      // Ignore.
    }
    generateWorker = null;
  }

  setGenerateBusy(false);

  const statusTitle = document.getElementById("generate-status-title");
  const statusDetail = document.getElementById("generate-status-detail");

  if (result.ok === false) {
    setGenerateProgress(null);

    if (statusTitle !== null) {
      statusTitle.textContent =
        result.stopReason === "cancelled" ? "Cancelled" : "Failed";
    }

    if (statusDetail !== null) {
      statusDetail.textContent = result.reasons.join(" ");
    }

    // Keep any options already streamed if cancel/fail happened after the first hit.
    if (
      project.results !== null &&
      project.results.options !== undefined &&
      project.results.options.length > 0 &&
      result.stopReason === "cancelled"
    ) {
      if (statusDetail !== null) {
        statusDetail.textContent =
          "Stopped early · " +
          String(project.results.options.length) +
          " option(s) kept · best " +
          formatScore(project.results.options[0].totalScore);
      }
    }

    return;
  }

  const options = result.options;

  let selectedRank = 1;
  if (
    project.results !== null &&
    project.results.selectedRank !== undefined &&
    project.results.selectedRank <= options.length
  ) {
    selectedRank = project.results.selectedRank;
  }

  project.results = {
    options: options,
    selectedRank: selectedRank
  };

  markProjectChanged();
  setGenerateProgress({ percent: 100, label: "Done" });

  if (statusTitle !== null) {
    if (result.stopReason === "cancelled") {
      statusTitle.textContent = "Cancelled";
    } else {
      statusTitle.textContent = "Done";
    }
  }

  if (statusDetail !== null) {
    let detail =
      options.length +
      " option(s) ready · best score " +
      formatScore(options[0].totalScore);
    if (result.stopReason === "stagnation") {
      detail = detail + " · search plateaued";
    } else if (result.stopReason === "time-budget") {
      detail = detail + " · time budget reached";
    } else if (result.stopReason === "cancelled") {
      detail = detail + " · stopped early";
    }
    statusDetail.textContent = detail;
  }

  renderGenerateOptions(project);
  renderResults(project);

  window.setTimeout(function () {
    if (runId === generateRunId) {
      setGenerateProgress(null);
    }
  }, 1200);
}

function setText(id, text) {
  const el = document.getElementById(id);

  if (el !== null) {
    el.textContent = text;
  }
}

function formatScore(value) {
  // Round to 2 decimal places: 12.3456 → 12.35
  return Math.round(value * 100) / 100;
}

/**
 * Escape text before putting it into innerHTML.
 *
 * If a person is named `<script>...`, we must not inject real HTML.
 * Replacing special characters with entities makes them display as text.
 *
 * The /g on each regex means "replace every match, not just the first".
 */
function escapeHtml(text) {
  let safe = String(text);
  safe = safe.replace(/&/g, "&amp;");
  safe = safe.replace(/</g, "&lt;");
  safe = safe.replace(/>/g, "&gt;");
  safe = safe.replace(/"/g, "&quot;");
  return safe;
}

/**
 * Walk up from startEl until we find an element that matches a CSS selector.
 *
 * Why: clicks bubble. Clicking the word inside a button still fires the
 * list's click handler, but event.target may be the inner <strong>, not
 * the <button>. This finds the button (or returns null).
 *
 * Same idea as the built-in element.closest(selector), written out.
 *
 * element.matches(selector) → true if THIS element would be found by
 * that CSS selector (example: ".rule-list-item" or "[data-option]").
 *
 * @param {Element|null} startEl
 * @param {string} selector
 * @returns {Element|null}
 */
function findAncestor(startEl, selector) {
  let el = startEl;

  while (el !== null) {
    if (typeof el.matches === "function" && el.matches(selector) === true) {
      return el;
    }

    // parentElement = the element one level up (or null at the top).
    el = el.parentElement;
  }

  return null;
}

/**
 * Prefer conflict_group column when present; leave setup alone otherwise.
 *
 * @param {Object} project
 */
function syncConflictGroupsFromSlots(project) {
  if (project === null || project.setup === undefined) {
    return;
  }

  if (findConflictGroupColumnKey(project.slots) === null) {
    return;
  }

  project.setup.conflictGroups = buildConflictGroupsFromSlots(project.slots);
}

/**
 * Conflict groups Manage modal (Rules → Global).
 */
function wireConflictGroupsModal() {
  const modal = document.getElementById("conflict-groups-modal");
  if (modal === null) {
    return;
  }

  const closeEls = modal.querySelectorAll("[data-close-conflict-modal]");
  for (let i = 0; i < closeEls.length; i = i + 1) {
    closeEls[i].addEventListener("click", closeConflictGroupsModal);
  }

  const addBtn = document.getElementById("conflict-add-group-btn");
  if (addBtn !== null) {
    addBtn.addEventListener("click", onConflictAddGroupClick);
  }

  const saveBtn = document.getElementById("conflict-groups-save");
  if (saveBtn !== null) {
    saveBtn.addEventListener("click", onConflictGroupsSave);
  }

  const editor = document.getElementById("conflict-groups-editor");
  if (editor !== null) {
    editor.addEventListener("input", onConflictEditorInput);
    editor.addEventListener("change", onConflictEditorChange);
    editor.addEventListener("click", onConflictEditorClick);
  }
}

function openConflictGroupsModal() {
  const modal = document.getElementById("conflict-groups-modal");
  const project = getProject();

  if (modal === null || project === null) {
    return;
  }

  conflictEditorDraft = buildConflictEditorDraft(project);
  renderConflictGroupsEditor(project);
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}

function closeConflictGroupsModal() {
  const modal = document.getElementById("conflict-groups-modal");
  if (modal === null) {
    return;
  }

  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  conflictEditorDraft = [];
}

/**
 * @param {Object} project
 * @returns {{ name: string, slotIds: string[] }[]}
 */
function buildConflictEditorDraft(project) {
  const named = listNamedConflictGroupsFromSlots(project.slots);
  const draft = [];

  if (named.length > 0) {
    for (let i = 0; i < named.length; i = i + 1) {
      draft.push({
        name: named[i].name,
        slotIds: named[i].slotIds.slice()
      });
    }
    return draft;
  }

  for (let i = 0; i < project.setup.conflictGroups.length; i = i + 1) {
    draft.push({
      name: "group_" + String(i + 1),
      slotIds: project.setup.conflictGroups[i].slice()
    });
  }

  if (draft.length === 0) {
    draft.push({
      name: "group_1",
      slotIds: []
    });
  }

  return draft;
}

/**
 * @param {Object} project
 */
function renderConflictGroupsEditor(project) {
  const editor = document.getElementById("conflict-groups-editor");
  if (editor === null) {
    return;
  }

  if (project.slots.rows.length === 0) {
    editor.innerHTML =
      '<p class="app-empty-hint">Add slots first, then assign them to conflict groups.</p>';
    return;
  }

  let html = "";

  for (let g = 0; g < conflictEditorDraft.length; g = g + 1) {
    const group = conflictEditorDraft[g];
    html = html + '<div class="conflict-editor-group" data-group-index="' + g + '">';
    html = html + '<div class="conflict-editor-group-head">';
    html =
      html +
      '<label class="app-field" style="flex: 1; margin: 0">' +
      "<span>Group name</span>" +
      '<input class="app-input conflict-group-name" type="text" data-group-index="' +
      g +
      '" value="' +
      escapeHtml(group.name) +
      '" />' +
      "</label>";
    html =
      html +
      '<button class="button button-ghost button-small" type="button" data-remove-group="' +
      g +
      '">Remove</button>';
    html = html + "</div>";
    html = html + '<div class="conflict-editor-slots">';

    for (let s = 0; s < project.slots.rows.length; s = s + 1) {
      const row = project.slots.rows[s];
      const label = rowDisplayLabel(row, project.slots.columns);
      let checked = "";
      for (let i = 0; i < group.slotIds.length; i = i + 1) {
        if (group.slotIds[i] === row.id) {
          checked = " checked";
        }
      }

      html =
        html +
        '<label class="conflict-slot-check">' +
        '<input type="checkbox" data-group-index="' +
        g +
        '" data-slot-id="' +
        escapeHtml(row.id) +
        '"' +
        checked +
        " />" +
        "<span>" +
        escapeHtml(label) +
        (label === row.id
          ? ""
          : ' <code class="conflict-slot-id">' + escapeHtml(row.id) + "</code>") +
        "</span>" +
        "</label>";
    }

    html = html + "</div></div>";
  }

  editor.innerHTML = html;
}

function onConflictAddGroupClick() {
  const project = getProject();
  const nextIndex = conflictEditorDraft.length + 1;
  conflictEditorDraft.push({
    name: "group_" + String(nextIndex),
    slotIds: []
  });
  renderConflictGroupsEditor(project);
}

/**
 * @param {Event} event
 */
function onConflictEditorInput(event) {
  const target = event.target;
  if (target.classList.contains("conflict-group-name") === false) {
    return;
  }

  const index = Number(target.getAttribute("data-group-index"));
  if (index < 0 || index >= conflictEditorDraft.length) {
    return;
  }

  conflictEditorDraft[index].name = target.value;
}

/**
 * @param {Event} event
 */
function onConflictEditorChange(event) {
  const target = event.target;
  if (target.type !== "checkbox") {
    return;
  }

  const index = Number(target.getAttribute("data-group-index"));
  const slotId = target.getAttribute("data-slot-id");

  if (index < 0 || index >= conflictEditorDraft.length || slotId === null) {
    return;
  }

  const group = conflictEditorDraft[index];
  const nextIds = [];

  for (let i = 0; i < group.slotIds.length; i = i + 1) {
    if (group.slotIds[i] !== slotId) {
      nextIds.push(group.slotIds[i]);
    }
  }

  if (target.checked === true) {
    // A slot can only be in one group — remove from others.
    for (let g = 0; g < conflictEditorDraft.length; g = g + 1) {
      if (g === index) {
        continue;
      }
      const other = conflictEditorDraft[g];
      const cleaned = [];
      for (let i = 0; i < other.slotIds.length; i = i + 1) {
        if (other.slotIds[i] !== slotId) {
          cleaned.push(other.slotIds[i]);
        }
      }
      other.slotIds = cleaned;
    }
    nextIds.push(slotId);
  }

  group.slotIds = nextIds;
  renderConflictGroupsEditor(getProject());
}

/**
 * @param {MouseEvent} event
 */
function onConflictEditorClick(event) {
  const button = findAncestor(event.target, "[data-remove-group]");
  if (button === null) {
    return;
  }

  const index = Number(button.getAttribute("data-remove-group"));
  if (index < 0 || index >= conflictEditorDraft.length) {
    return;
  }

  conflictEditorDraft.splice(index, 1);
  if (conflictEditorDraft.length === 0) {
    conflictEditorDraft.push({
      name: "group_1",
      slotIds: []
    });
  }

  renderConflictGroupsEditor(getProject());
}

function onConflictGroupsSave() {
  const project = getProject();
  if (project === null) {
    return;
  }

  // Drop empty name-only drafts that have no slots selected.
  const toApply = [];
  for (let i = 0; i < conflictEditorDraft.length; i = i + 1) {
    const g = conflictEditorDraft[i];
    if (g.slotIds.length === 0) {
      continue;
    }
    toApply.push({
      name: String(g.name || "").trim() || "group_" + String(i + 1),
      slotIds: g.slotIds.slice()
    });
  }

  project.setup.conflictGroups = applyNamedConflictGroupsToSlots(
    project.slots,
    toApply,
  );
  project.results = null;
  markProjectChanged();
  renderSlotsTable(project);
  renderSlotsList(project);
  renderReview(project);
  closeConflictGroupsModal();
}

/**
 * Load preset modal on the workspace (replaces current project data).
 * Also auto-opens when arriving with ?new=1 after create / try-out.
 */
function wireLoadPresetModal() {
  const openBtn = document.getElementById("load-preset-btn");
  const modal = document.getElementById("load-preset-modal");
  const backdrop = document.getElementById("load-preset-backdrop");
  const cancelBtn = document.getElementById("load-preset-cancel");
  const applyBtn = document.getElementById("load-preset-apply");
  const listEl = document.getElementById("load-preset-list");

  if (modal === null) {
    return;
  }

  fillLoadPresetList(listEl, "sports");
  updateLoadPresetDetails("sports");

  if (openBtn !== null) {
    openBtn.addEventListener("click", function () {
      openLoadPresetModal(false);
    });
  }

  if (cancelBtn !== null) {
    cancelBtn.addEventListener("click", function () {
      closeLoadPresetModal(modal);
    });
  }

  if (backdrop !== null) {
    backdrop.addEventListener("click", function () {
      closeLoadPresetModal(modal);
    });
  }

  if (listEl !== null) {
    listEl.addEventListener("change", function (event) {
      if (event.target.name !== "load-preset-choice") {
        return;
      }
      highlightLoadPresetSelection(listEl);
      updateLoadPresetDetails(event.target.value);
    });
  }

  if (applyBtn !== null) {
    applyBtn.addEventListener("click", onLoadPresetApply);
  }
}

/**
 * @param {boolean} forNewProject
 */
function openLoadPresetModal(forNewProject) {
  const modal = document.getElementById("load-preset-modal");
  if (modal === null) {
    return;
  }

  presetModalForNewProject = forNewProject === true;
  applyLoadPresetModalCopy(presetModalForNewProject);

  const listEl = document.getElementById("load-preset-list");
  fillLoadPresetList(listEl, "sports");
  updateLoadPresetDetails("sports");

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}

/**
 * @param {boolean} forNewProject
 */
function applyLoadPresetModalCopy(forNewProject) {
  const titleEl = document.getElementById("load-preset-title");
  const leadEl = document.querySelector("#load-preset-modal .app-modal-lead");
  const applyBtn = document.getElementById("load-preset-apply");
  const cancelBtn = document.getElementById("load-preset-cancel");

  if (forNewProject === true) {
    if (titleEl !== null) {
      titleEl.textContent = "Start from a preset";
    }
    if (leadEl !== null) {
      leadEl.innerHTML =
        "Choose a blank project or a sample pack (entries, slots, and rules). " +
        "You can change this later with <strong>Load preset…</strong>.";
    }
    if (applyBtn !== null) {
      applyBtn.textContent = "Start with this";
    }
    if (cancelBtn !== null) {
      cancelBtn.textContent = "Keep blank";
    }
  } else {
    if (titleEl !== null) {
      titleEl.textContent = "Load preset";
    }
    if (leadEl !== null) {
      leadEl.innerHTML =
        "This <strong>replaces</strong> the current entries, slots, rules, and global setup " +
        "with the chosen pack.";
    }
    if (applyBtn !== null) {
      applyBtn.textContent = "Replace project data";
    }
    if (cancelBtn !== null) {
      cancelBtn.textContent = "Cancel";
    }
  }
}

function closeLoadPresetModal(modal) {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  presetModalForNewProject = false;
}

/**
 * @param {HTMLElement|null} listEl
 * @param {string} selectedId
 */
function fillLoadPresetList(listEl, selectedId) {
  if (listEl === null) {
    return;
  }

  let html = "";

  for (let i = 0; i < PRESET_CATALOG.length; i = i + 1) {
    const preset = PRESET_CATALOG[i];

    // Blank is for New project; loading blank here would wipe to empty — still allow it.
    let checked = "";
    let selectedClass = "";
    if (preset.id === selectedId) {
      checked = " checked";
      selectedClass = " is-selected";
    }

    html =
      html +
      '<label class="preset-choice' +
      selectedClass +
      '">' +
      '<input type="radio" name="load-preset-choice" value="' +
      escapeHtml(preset.id) +
      '"' +
      checked +
      " />" +
      '<span class="preset-choice-body">' +
      "<strong>" +
      escapeHtml(preset.name) +
      "</strong>" +
      "<span>" +
      escapeHtml(preset.summary) +
      "</span>" +
      "</span>" +
      "</label>";
  }

  listEl.innerHTML = html;
}

function highlightLoadPresetSelection(listEl) {
  const labels = listEl.querySelectorAll(".preset-choice");

  for (let i = 0; i < labels.length; i = i + 1) {
    const input = labels[i].querySelector('input[type="radio"]');
    if (input !== null && input.checked === true) {
      labels[i].classList.add("is-selected");
    } else {
      labels[i].classList.remove("is-selected");
    }
  }
}

/**
 * @param {string} presetId
 */
function updateLoadPresetDetails(presetId) {
  const info = getPresetInfo(presetId);
  const summaryEl = document.getElementById("load-preset-summary");

  if (summaryEl !== null && info !== null) {
    summaryEl.textContent = info.summary;
  }
}

async function onLoadPresetApply() {
  const selected = document.querySelector(
    'input[name="load-preset-choice"]:checked'
  );
  const statusEl = document.getElementById("load-preset-status");
  const applyBtn = document.getElementById("load-preset-apply");
  const modal = document.getElementById("load-preset-modal");
  const applyingForNew = presetModalForNewProject === true;

  let presetId = "blank";
  if (selected !== null) {
    presetId = selected.value;
  }

  const current = getProject();
  let keepName = "Untitled project";
  if (current !== null && current.name !== undefined) {
    keepName = current.name;
  }

  // Brand-new empty projects skip the replace warning.
  if (applyingForNew === false) {
    const confirmed = window.confirm(
      "Replace entries, slots, rules, and setup with the \"" +
        presetId +
        "\" preset? This cannot be undone."
    );

    if (confirmed === false) {
      return;
    }
  }

  if (applyBtn !== null) {
    applyBtn.disabled = true;
  }

  if (statusEl !== null) {
    statusEl.textContent = "Loading preset…";
  }

  try {
    const keepId = current !== null ? current.id : null;

    const project = await buildProjectFromPreset(presetId, keepName);

    if (keepId !== null) {
      project.id = keepId;
    }

    setProject(project);
    markProjectChanged();
    renderAll();
    if (statusEl !== null) {
      statusEl.textContent = "Preset loaded.";
    }
    if (modal !== null) {
      closeLoadPresetModal(modal);
    }
  } catch (error) {
    console.error(error);
    if (statusEl !== null) {
      statusEl.textContent = "Could not load preset.";
    }
  }

  if (applyBtn !== null) {
    applyBtn.disabled = false;
  }
}

main();
