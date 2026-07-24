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
 *   The "#setup" part of the URL. We use it to remember which panel is open.
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
  loadProject,
  createDemoProject,
} from "/js/state.js";

import { buildLegalConfig, buildScoreConfig } from "/js/project-config.js";
import { runSearch, mergeOptions } from "/js/generator/search.js";
import { getEntriesInSlot } from "/js/generator/placement.js";
import { parseCsvText, csvToTable } from "/js/csv.js";

/** Valid workflow panel ids (must match section id= and nav href="#..."). */
const PANEL_IDS = ["setup", "rules", "review", "generate", "results"];

/** Column types the user can pick in Setup headers. */
const ENTRIES_COLUMN_TYPES = ["id", "number", "time", "text", "ignore"];
const SLOTS_COLUMN_TYPES = ["id", "minSize", "maxSize", "text", "ignore"];

/**
 * Id of a pending autosave timer from window.setTimeout.
 * null means nothing is waiting to save.
 */
let saveTimerId = null;

/**
 * Page startup.
 */
function main() {
  let project = loadProject();

  if (project === null) {
    project = createDemoProject();
    setProject(project);
    // First visit: persist the demo so refresh keeps it.
    saveProject();
  } else {
    setProject(project);
    setDirty(false);
  }

  renderAll();
  wireControls();
  wirePanelNavigation();
  showPanelFromHash();
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
  renderGlobalSetup(project);
  renderRuleList(project);
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
      // data-state is read by CSS ([data-state="unsaved"]) for colors.
      saveStateEl.setAttribute("data-state", "unsaved");
    } else {
      saveStateEl.textContent = "Saved";
      saveStateEl.setAttribute("data-state", "saved");
    }
  }
}

function renderGlobalSetup(project) {
  const select = document.getElementById("slots-per-entry");

  if (select === null) {
    return;
  }

  select.value = String(project.setup.defaultSlotsPerEntry);
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

function renderRuleList(project) {
  const list = document.getElementById("rule-list");

  if (list === null) {
    return;
  }

  let html = "";

  for (let i = 0; i < project.rules.length; i = i + 1) {
    const rule = project.rules[i];
    let hardLabel = "Soft";

    if (rule.hard === true) {
      hardLabel = '<span class="rule-hard-badge">Hard</span>';
    }

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
      '<span class="rule-list-meta">Priority ' +
      escapeHtml(String(rule.priority)) +
      " · " +
      hardLabel +
      "</span>" +
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
  setText(
    "review-slots-per-entry",
    String(project.setup.defaultSlotsPerEntry),
  );

  let conflictText = "None";
  let conflictSummary = "No conflict groups yet.";

  if (project.setup.conflictGroups.length > 0) {
    conflictText = project.setup.conflictGroups.length + " group(s)";
    conflictSummary =
      project.setup.conflictGroups.length +
      " conflict group(s) configured.";
  }

  setText("review-conflicts", conflictText);
  setText("conflict-groups-summary", conflictSummary);
  setText("review-preset", "—");

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
      const name = project.entries.rows[i].cells.name;
      html = html + "<li>" + escapeHtml(String(name)) + "</li>";
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
      const name = row.cells.name;
      const minSize = row.cells.min_size;
      const maxSize = row.cells.max_size;
      const practice = row.cells.practice_night;

      html =
        html +
        "<li><strong>" +
        escapeHtml(String(name)) +
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
      '<p class="app-empty-hint">No options yet. Click Generate options.</p>';
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

  if (main === null) {
    return;
  }

  if (project.results === null || project.results.options === undefined) {
    main.innerHTML =
      '<p class="app-empty-hint">Run Generate first, then pick an option here.</p>';

    if (picker !== null) {
      picker.innerHTML = "";
    }

    return;
  }

  const options = project.results.options;
  let selectedRank = project.results.selectedRank;

  if (selectedRank === undefined) {
    selectedRank = 1;
  }

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
        '<button class="app-pill' +
        active +
        '" type="button" data-option="' +
        option.rank +
        '">Option ' +
        option.rank +
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

  const slotIds = [];
  for (let i = 0; i < project.slots.rows.length; i = i + 1) {
    slotIds.push(project.slots.rows[i].id);
  }

  let html = '<div class="results-block" id="results-by-slot">';
  const attrColumns = getResultAttrColumns(project);

  for (let s = 0; s < slotIds.length; s = s + 1) {
    const slotId = slotIds[s];
    const slotRow = findSlotRow(project, slotId);
    let slotName = slotId;

    if (slotRow !== null && slotRow.cells.name !== undefined) {
      slotName = slotRow.cells.name;
    }

    const entryIds = getEntriesInSlot(selected.assignments, slotId);

    html =
      html +
      '<div class="results-slot-group">' +
      "<h3>" +
      escapeHtml(String(slotName)) +
      ' <span class="app-pill">' +
      entryIds.length +
      " entries</span></h3>" +
      '<ul class="results-entries" style="--attr-count: ' +
      attrColumns.length +
      '">';

    for (let p = 0; p < entryIds.length; p = p + 1) {
      const entryId = entryIds[p];
      const entryRow = findEntryRow(project, entryId);
      html =
        html +
        renderEntryResultItem(project, entryId, entryRow, attrColumns);
    }

    if (entryIds.length === 0) {
      html = html + '<li class="results-entry-empty">(empty)</li>';
    }

    html = html + "</ul></div>";
  }

  html =
    html +
    '</div><p class="app-empty-hint">Total score: ' +
    formatScore(selected.totalScore) +
    "</p>";

  main.innerHTML = html;
}

/**
 * One person row in Results: name on the left, attribute bubbles
 * on the right (same column order for every person so widths line up).
 *
 * @param {Object} project
 * @param {string} entryId
 * @param {Object|null} entryRow
 * @param {Object[]} attrColumns - people columns to show as bubbles
 * @returns {string} HTML
 */
function renderEntryResultItem(project, entryId, entryRow, attrColumns) {
  let displayName = entryId;

  if (entryRow !== null && entryRow.cells.name !== undefined) {
    displayName = entryRow.cells.name;
  }

  let bubbles = "";

  for (let c = 0; c < attrColumns.length; c = c + 1) {
    const col = attrColumns[c];
    let value = "";

    if (entryRow !== null && entryRow.cells[col.key] !== undefined) {
      value = entryRow.cells[col.key];
    }

    const hasValue =
      value !== null && value !== undefined && String(value) !== "";

    if (hasValue === true) {
      bubbles =
        bubbles +
        '<span class="results-attr-pill">' +
        '<span class="results-attr-label">' +
        escapeHtml(col.label) +
        "</span>" +
        '<span class="results-attr-value">' +
        escapeHtml(String(value)) +
        "</span>" +
        "</span>";
    } else {
      // Empty cell keeps the grid column so neighbors stay aligned.
      bubbles = bubbles + '<span class="results-attr-pill is-empty"></span>';
    }
  }

  return (
    '<li class="results-entry">' +
    '<div class="results-entry-name">' +
    escapeHtml(String(displayName)) +
    "</div>" +
    '<div class="results-entry-spacer" aria-hidden="true"></div>' +
    bubbles +
    "</li>"
  );
}

/**
 * Columns that appear as attribute bubbles (skip name heading + ignore).
 *
 * @param {Object} project
 * @returns {Object[]}
 */
function getResultAttrColumns(project) {
  const columns = [];

  for (let i = 0; i < project.entries.columns.length; i = i + 1) {
    const col = project.entries.columns[i];

    if (col.key === "name") {
      continue;
    }

    if (col.type === "ignore") {
      continue;
    }

    columns.push(col);
  }

  return columns;
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

  const addEntryBtn = document.getElementById("add-entry-row-btn");
  if (addEntryBtn !== null) {
    addEntryBtn.addEventListener("click", onAddEntryRowClick);
  }

  const addSlotBtn = document.getElementById("add-slot-row-btn");
  if (addSlotBtn !== null) {
    addSlotBtn.addEventListener("click", onAddSlotRowClick);
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

  const slotsPerEntry = document.getElementById("slots-per-entry");
  if (slotsPerEntry !== null) {
    slotsPerEntry.addEventListener("change", onSlotsPerEntryChange);
  }

  const generateBtn = document.getElementById("generate-btn");
  if (generateBtn !== null) {
    generateBtn.addEventListener("click", onGenerateClick);
  }

  const retryBtn = document.getElementById("retry-generate-btn");
  if (retryBtn !== null) {
    retryBtn.addEventListener("click", onRetryClick);
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
}

/**
 * Sidebar tabs + in-page "Continue" links:
 * keep the URL hash and the visible panel in sync,
 * without letting the browser scroll to the section id.
 */
function wirePanelNavigation() {
  // Capture clicks on any link whose href is #setup, #rules, …
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

  if (known === false) {
    return;
  }

  // Stop the browser from scrolling to the element with that id.
  event.preventDefault();

  if (window.location.hash === href) {
    // Clicking the already-active tab: still refresh the active classes.
    showPanel(panelId);
  } else {
    // Changing the hash fires "hashchange", which calls showPanelFromHash.
    window.location.hash = href;
  }
}

/**
 * Read window.location.hash (example: "#rules") and show that panel.
 */
function showPanelFromHash() {
  let panelId = "setup";
  const hash = window.location.hash;

  // hash looks like "#rules". slice(1) drops the leading "#".
  if (hash !== "" && hash !== "#") {
    panelId = hash.slice(1);
  }

  showPanel(panelId);
}

/**
 * Show one workflow panel and highlight its sidebar link.
 *
 * @param {string} panelId - "setup" | "rules" | "review" | "generate" | "results"
 */
function showPanel(panelId) {
  let safeId = panelId;
  let known = false;

  for (let i = 0; i < PANEL_IDS.length; i = i + 1) {
    if (PANEL_IDS[i] === safeId) {
      known = true;
    }
  }

  if (known === false) {
    safeId = "setup";
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
    }

    // Old results used previous ids — they are no longer valid.
    project.results = null;
    markProjectChanged();

    if (tableKind === "entries") {
      renderEntriesTable(project);
    } else {
      renderSlotsTable(project);
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
  project.results = null;
  markProjectChanged();
  renderEntriesTable(project);
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
  project.results = null;
  markProjectChanged();
  renderSlotsTable(project);
  renderReview(project);
  renderGenerateOptions(project);
  renderResults(project);
}

function onAddEntryRowClick() {
  const project = getProject();
  ensureDefaultEntriesColumns(project);
  project.entries.rows.push(makeEmptyRow(project.entries.columns, "entry"));
  project.results = null;
  markProjectChanged();
  renderEntriesTable(project);
  renderReview(project);
}

function onAddSlotRowClick() {
  const project = getProject();
  ensureDefaultSlotsColumns(project);
  project.slots.rows.push(makeEmptyRow(project.slots.columns, "slot"));
  project.results = null;
  markProjectChanged();
  renderSlotsTable(project);
  renderReview(project);
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
    { key: "name", label: "name", type: "text" }
  ];
}

function ensureDefaultSlotsColumns(project) {
  if (project.slots.columns.length > 0) {
    return;
  }

  project.slots.columns = [
    { key: "id", label: "id", type: "id" },
    { key: "name", label: "name", type: "text" },
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
    if (String(value).trim() === "") {
      row.id = tableKind + "-row-" + rowIndex;
    } else {
      row.id = String(value);
    }
  }

  project.results = null;
  markProjectChanged();
}

/**
 * Change on a column-type <select>.
 */
function onSetupTableChange(event) {
  const select = event.target;

  if (select.classList.contains("col-type-select") === false) {
    return;
  }

  const tableKind = select.getAttribute("data-table");
  const colIndex = Number(select.getAttribute("data-col-index"));
  const project = getProject();
  const table = getSetupTable(project, tableKind);

  if (table === null) {
    return;
  }

  if (colIndex < 0 || colIndex >= table.columns.length) {
    return;
  }

  table.columns[colIndex].type = select.value;
  project.results = null;
  markProjectChanged();
}

/**
 * Click on a row delete button.
 */
function onSetupTableClick(event) {
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
  } else {
    renderSlotsTable(project);
  }

  renderReview(project);
  renderGenerateOptions(project);
  renderResults(project);
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

  saveTimerId = window.setTimeout(function () {
    saveTimerId = null;
    const ok = saveProject();
    if (ok === true) {
      renderHeader(getProject());
    }
  }, 400);
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
  markProjectChanged();
  renderResults(project);
}

function onGenerateClick() {
  runGeneration(false);
}

function onRetryClick() {
  runGeneration(true);
}

/**
 * @param {boolean} mergeWithExisting - Retry: keep old options and merge
 */
function runGeneration(mergeWithExisting) {
  const project = getProject();
  const legalConfig = buildLegalConfig(project);
  const scoreConfig = buildScoreConfig(project);

  const statusTitle = document.getElementById("generate-status-title");
  const statusDetail = document.getElementById("generate-status-detail");

  if (statusTitle !== null) {
    statusTitle.textContent = "Working…";
  }

  if (statusDetail !== null) {
    statusDetail.textContent = "Searching for legal, high-scoring placements.";
  }

  // Let the browser paint "Working…" before the heavy search loop runs.
  // setTimeout(fn, 20) means: run fn about 20 milliseconds from now.
  window.setTimeout(function () {
    const result = runSearch(legalConfig, scoreConfig, {
      optionCount: 3,
      attempts: 3,
      maxShakes: 2,
      maxImprovePasses: 20,
      onProgress: function (info) {
        if (statusDetail === null) {
          return;
        }

        if (info.phase === "attempt") {
          statusDetail.textContent =
            "Attempt " + info.attempt + " of " + info.attempts;
        }

        if (info.phase === "improving" && info.entryIndex === 1) {
          statusDetail.textContent =
            "Attempt improve pass " +
            info.pass +
            " · best " +
            formatScore(info.bestScore);
        }

        if (info.phase === "done") {
          statusDetail.textContent =
            "Finished. Best score " + formatScore(info.bestScore);
        }
      },
    });

    if (result.ok === false) {
      if (statusTitle !== null) {
        statusTitle.textContent = "Failed";
      }

      if (statusDetail !== null) {
        statusDetail.textContent = result.reasons.join(" ");
      }

      return;
    }

    let options = result.options;

    if (mergeWithExisting === true && project.results !== null) {
      options = mergeOptions(project.results.options, result.options, 6);
    }

    project.results = {
      options: options,
      selectedRank: options[0].rank,
    };

    markProjectChanged();

    if (statusTitle !== null) {
      statusTitle.textContent = "Done";
    }

    if (statusDetail !== null) {
      statusDetail.textContent =
        options.length +
        " option(s) ready · best score " +
        formatScore(options[0].totalScore);
    }

    renderGenerateOptions(project);
    renderResults(project);
  }, 20);
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

main();
