/**
 * project.js
 *
 * Wires the project workspace page to state + the generator.
 *
 * First slice:
 *   - load demo project (or saved localStorage project)
 *   - render Setup tables, Rules list, Review, Results
 *   - localStorage save helpers (wire autosave later)
 *   - Generate → runSearch → show ranked options
 */

import {
  getProject,
  setProject,
  getDirty,
  setDirty,
  saveProject,
  loadProject,
  createDemoProject
} from "/js/state.js";

import { buildLegalConfig, buildScoreConfig } from "/js/project-config.js";
import { runSearch, mergeOptions } from "/js/generator/search.js";
import { getPeopleInSlot } from "/js/generator/placement.js";

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
  renderPeopleTable(project);
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
  const select = document.getElementById("slots-per-person");

  if (select === null) {
    return;
  }

  select.value = String(project.setup.defaultSlotsPerPerson);
}

function renderPeopleTable(project) {
  const table = document.getElementById("people-table");
  const body = document.getElementById("people-table-body");

  if (table === null || body === null) {
    return;
  }

  renderTableHeader(table, project.people.columns);
  renderTableBody(body, project.people.columns, project.people.rows);
}

function renderSlotsTable(project) {
  const table = document.getElementById("slots-table");
  const body = document.getElementById("slots-table-body");

  if (table === null || body === null) {
    return;
  }

  renderTableHeader(table, project.slots.columns);
  renderTableBody(body, project.slots.columns, project.slots.rows);
}

function renderTableHeader(table, columns) {
  const thead = table.querySelector("thead");

  if (thead === null) {
    return;
  }

  let html = "<tr>";

  for (let i = 0; i < columns.length; i = i + 1) {
    const col = columns[i];
    html =
      html +
      "<th>" +
      escapeHtml(col.label) +
      ' <span class="col-type">' +
      escapeHtml(col.type) +
      "</span></th>";
  }

  html = html + "</tr>";
  thead.innerHTML = html;
}

function renderTableBody(tbody, columns, rows) {
  let html = "";

  for (let r = 0; r < rows.length; r = r + 1) {
    const row = rows[r];
    html = html + "<tr>";

    for (let c = 0; c < columns.length; c = c + 1) {
      const key = columns[c].key;
      let value = row.cells[key];

      if (value === undefined || value === null) {
        value = "";
      }

      html = html + "<td>" + escapeHtml(String(value)) + "</td>";
    }

    html = html + "</tr>";
  }

  if (rows.length === 0) {
    html =
      '<tr><td colspan="' +
      columns.length +
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
    html = "<li><p class=\"app-empty-hint\">No rules yet. Click + Add rule.</p></li>";
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

  for (let i = 0; i < typeRadios.length; i = i + 1) {
    const radio = typeRadios[i];
    radio.checked = radio.value === rule.type;
  }
}

function renderReview(project) {
  setText("review-slots-per-person", String(project.setup.defaultSlotsPerPerson));

  let conflictText = "None";
  if (project.setup.conflictGroups.length > 0) {
    conflictText = project.setup.conflictGroups.length + " group(s)";
  }
  setText("review-conflicts", conflictText);
  setText("review-preset", "—");

  const peopleCount = document.getElementById("review-people-count");
  if (peopleCount !== null) {
    peopleCount.innerHTML =
      "<strong>" +
      project.people.rows.length +
      "</strong> people loaded";
  }

  const peoplePreview = document.getElementById("review-people-preview");
  if (peoplePreview !== null) {
    let html = "";
    const limit = Math.min(8, project.people.rows.length);

    for (let i = 0; i < limit; i = i + 1) {
      const name = project.people.rows[i].cells.name;
      html = html + "<li>" + escapeHtml(String(name)) + "</li>";
    }

    if (project.people.rows.length > limit) {
      html =
        html +
        "<li>+" +
        (project.people.rows.length - limit) +
        " more</li>";
    }

    peoplePreview.innerHTML = html;
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
    return "Keep " + rule.personAttribute + " even across slots.";
  }

  if (rule.type === "cluster" && rule.shape === "peopleTogether") {
    return (
      "People with the same " +
      rule.personAttribute +
      " prefer the same slot."
    );
  }

  if (rule.type === "cluster" && rule.shape === "personMatchesSlot") {
    return (
      "Match person " +
      rule.personAttribute +
      " to slot " +
      rule.slotAttribute +
      "."
    );
  }

  if (rule.type === "limit") {
    return "Limit filtered people per slot.";
  }

  if (rule.type === "separate") {
    return (
      "Spread people who share " + rule.personAttribute + " across slots."
    );
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

    const peopleIds = getPeopleInSlot(selected.assignments, slotId);

    html =
      html +
      '<div class="results-slot-group">' +
      "<h3>" +
      escapeHtml(String(slotName)) +
      ' <span class="app-pill">' +
      peopleIds.length +
      " people</span></h3>" +
      '<ul class="results-people" style="--attr-count: ' +
      attrColumns.length +
      '">';

    for (let p = 0; p < peopleIds.length; p = p + 1) {
      const personId = peopleIds[p];
      const personRow = findPersonRow(project, personId);
      html =
        html +
        renderPersonResultItem(project, personId, personRow, attrColumns);
    }

    if (peopleIds.length === 0) {
      html = html + '<li class="results-person-empty">(empty)</li>';
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
 * @param {string} personId
 * @param {Object|null} personRow
 * @param {Object[]} attrColumns - people columns to show as bubbles
 * @returns {string} HTML
 */
function renderPersonResultItem(project, personId, personRow, attrColumns) {
  let displayName = personId;

  if (personRow !== null && personRow.cells.name !== undefined) {
    displayName = personRow.cells.name;
  }

  let bubbles = "";

  for (let c = 0; c < attrColumns.length; c = c + 1) {
    const col = attrColumns[c];
    let value = "";

    if (personRow !== null && personRow.cells[col.key] !== undefined) {
      value = personRow.cells[col.key];
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
    '<li class="results-person">' +
    '<div class="results-person-name">' +
    escapeHtml(String(displayName)) +
    "</div>" +
    '<div class="results-person-spacer" aria-hidden="true"></div>' +
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

  for (let i = 0; i < project.people.columns.length; i = i + 1) {
    const col = project.people.columns[i];

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

function findPersonRow(project, personId) {
  for (let i = 0; i < project.people.rows.length; i = i + 1) {
    if (project.people.rows[i].id === personId) {
      return project.people.rows[i];
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
 * Attach click / change handlers once.
 */
function wireControls() {
  const nameInput = document.getElementById("project-name");
  if (nameInput !== null) {
    nameInput.addEventListener("input", onProjectNameInput);
    nameInput.addEventListener("change", onProjectNameInput);
  }

  const slotsPerPerson = document.getElementById("slots-per-person");
  if (slotsPerPerson !== null) {
    slotsPerPerson.addEventListener("change", onSlotsPerPersonChange);
  }

  const generateBtn = document.getElementById("generate-btn");
  if (generateBtn !== null) {
    generateBtn.addEventListener("click", onGenerateClick);
  }

  const retryBtn = document.getElementById("retry-generate-btn");
  if (retryBtn !== null) {
    retryBtn.addEventListener("click", onRetryClick);
  }

  const ruleList = document.getElementById("rule-list");
  if (ruleList !== null) {
    ruleList.addEventListener("click", onRuleListClick);
  }

  const resultPicker = document.getElementById("result-set-picker");
  if (resultPicker !== null) {
    resultPicker.addEventListener("click", onResultPickerClick);
  }
}

function onProjectNameInput(event) {
  const project = getProject();
  let nextName = event.target.value.trim();

  if (nextName === "") {
    nextName = "Untitled project";
  }

  project.name = nextName;
  setDirty(true);
  renderHeader(project);
}

function onSlotsPerPersonChange(event) {
  const project = getProject();
  project.setup.defaultSlotsPerPerson = Number(event.target.value);
  setDirty(true);
  renderHeader(project);
  renderReview(project);
}

function onRuleListClick(event) {
  const button = event.target.closest(".rule-list-item");

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
  const button = event.target.closest("[data-option]");

  if (button === null) {
    return;
  }

  const project = getProject();

  if (project.results === null) {
    return;
  }

  project.results.selectedRank = Number(button.getAttribute("data-option"));
  setDirty(true);
  renderResults(project);
  renderHeader(project);
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

  // Yield to the browser so the status text can paint before the heavy loop.
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

        if (info.phase === "improving" && info.personIndex === 1) {
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
      }
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
      selectedRank: options[0].rank
    };

    setDirty(true);

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
    renderHeader(project);
  }, 20);
}

function setText(id, text) {
  const el = document.getElementById(id);

  if (el !== null) {
    el.textContent = text;
  }
}

function formatScore(value) {
  return Math.round(value * 100) / 100;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

main();
