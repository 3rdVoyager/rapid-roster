/**
 * dashboard.js
 *
 * Project list page (/app/):
 *   - Signed out: local/new-project flow (browser storage only)
 *   - Signed in: list/create/open cloud projects from D1
 */

import {
  PRESET_CATALOG,
  getPresetInfo,
  buildProjectFromPreset
} from "/js/presets.js";

import {
  setProject,
  saveProject,
  loadProject,
  setCloudSynced
} from "/js/state.js";

import {
  listProjects,
  createCloudProject
} from "/js/api.js";

import { wireAccountMenu } from "/js/account.js";

/** @type {{ id: string, email: string }|null} */
let currentUser = null;

async function main() {
  currentUser = await wireAccountMenu();
  wireNewProjectModal();
  wireImportButton();
  await renderProjectList();
}

async function renderProjectList() {
  const listEl = document.getElementById("project-list");
  const noteEl = document.querySelector(".dashboard-note");

  if (listEl === null) {
    return;
  }

  if (currentUser === null) {
    renderLocalList(listEl);
    if (noteEl !== null) {
      noteEl.innerHTML =
        "Projects save in this browser for now. Sign in to sync across devices.";
    }
    return;
  }

  if (noteEl !== null) {
    noteEl.textContent =
      "Signed in as " +
      currentUser.email +
      ". Projects sync to the cloud; this browser also keeps a local cache.";
  }

  listEl.innerHTML =
    '<li class="project-list-status">Loading projects…</li>';

  try {
    const projects = await listProjects();
    if (projects.length === 0) {
      listEl.innerHTML =
        '<li class="project-list-status">No cloud projects yet. Create one to get started.</li>';
      return;
    }

    let html = "";
    for (let i = 0; i < projects.length; i = i + 1) {
      const p = projects[i];
      html =
        html +
        "<li>" +
        '<a class="project-row" href="/app/project/?id=' +
        encodeURIComponent(p.id) +
        '">' +
        '<span class="project-row-icon" aria-hidden="true">' +
        '<span class="material-symbols-outlined">folder_open</span>' +
        "</span>" +
        '<span class="project-row-main">' +
        "<strong>" +
        escapeHtml(p.name) +
        "</strong>" +
        '<span class="project-row-meta">Updated ' +
        escapeHtml(formatUpdated(p.updated_at)) +
        "</span>" +
        "</span>" +
        '<span class="project-row-aside">' +
        '<span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>' +
        "</span>" +
        "</a>" +
        "</li>";
    }
    listEl.innerHTML = html;
  } catch (error) {
    console.error(error);
    listEl.innerHTML =
      '<li class="project-list-status">Could not load cloud projects. Showing local cache.</li>';
    renderLocalList(listEl, true);
  }
}

/**
 * @param {HTMLElement} listEl
 * @param {boolean} [append]
 */
function renderLocalList(listEl, append) {
  const local = loadProject();
  let name = "Open current project";
  let meta = "Loads whatever is saved in this browser";

  if (local !== null && typeof local.name === "string" && local.name !== "") {
    name = local.name;
    meta = "Saved in this browser";
    if (local.updatedAt) {
      meta = meta + " · " + formatUpdated(local.updatedAt);
    }
  }

  const row =
    "<li>" +
    '<a class="project-row" href="/app/project/">' +
    '<span class="project-row-icon" aria-hidden="true">' +
    '<span class="material-symbols-outlined">folder_open</span>' +
    "</span>" +
    '<span class="project-row-main">' +
    "<strong>" +
    escapeHtml(name) +
    "</strong>" +
    '<span class="project-row-meta">' +
    escapeHtml(meta) +
    "</span>" +
    "</span>" +
    '<span class="project-row-aside">' +
    '<span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>' +
    "</span>" +
    "</a>" +
    "</li>";

  if (append === true) {
    listEl.innerHTML = listEl.innerHTML + row;
  } else {
    listEl.innerHTML = row;
  }
}

function wireNewProjectModal() {
  const openBtn = document.getElementById("new-project-btn");
  const modal = document.getElementById("new-project-modal");
  const backdrop = document.getElementById("new-project-backdrop");
  const cancelBtn = document.getElementById("new-project-cancel");
  const createBtn = document.getElementById("new-project-create");
  const presetList = document.getElementById("new-project-preset-list");

  if (openBtn === null || modal === null) {
    return;
  }

  renderPresetChoices(presetList, "blank");
  updatePresetDetails("blank");

  openBtn.addEventListener("click", function (event) {
    event.preventDefault();
    openModal(modal);
  });

  if (cancelBtn !== null) {
    cancelBtn.addEventListener("click", function () {
      closeModal(modal);
    });
  }

  if (backdrop !== null) {
    backdrop.addEventListener("click", function () {
      closeModal(modal);
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal(modal);
    }
  });

  if (presetList !== null) {
    presetList.addEventListener("change", function (event) {
      const input = event.target;
      if (input.name !== "new-project-preset") {
        return;
      }
      highlightSelectedPreset(presetList);
      updatePresetDetails(input.value);
    });
  }

  if (createBtn !== null) {
    createBtn.addEventListener("click", onCreateProjectClick);
  }
}

function wireImportButton() {
  const importBtn = document.getElementById("import-project-btn");
  if (importBtn === null) {
    return;
  }

  // Dashboard import is wired on the project page for now; keep button as a
  // shortcut into the workspace import flow when unsigned/local.
  importBtn.addEventListener("click", function () {
    window.location.href = "/app/project/#entries";
  });
}

/**
 * @param {HTMLElement|null} listEl
 * @param {string} selectedId
 */
function renderPresetChoices(listEl, selectedId) {
  if (listEl === null) {
    return;
  }

  let html = "";

  for (let i = 0; i < PRESET_CATALOG.length; i = i + 1) {
    const preset = PRESET_CATALOG[i];
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
      '<input type="radio" name="new-project-preset" value="' +
      preset.id +
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

function highlightSelectedPreset(listEl) {
  if (listEl === null) {
    return;
  }

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
function updatePresetDetails(presetId) {
  const info = getPresetInfo(presetId);
  const summaryEl = document.getElementById("new-project-summary");
  const warnEl = document.getElementById("new-project-overwrite-note");

  if (summaryEl !== null && info !== null) {
    summaryEl.textContent = info.summary;
  }

  if (warnEl !== null) {
    if (presetId === "blank") {
      warnEl.textContent = "Starts empty. Import CSVs or add rows in the project workspace.";
    } else {
      warnEl.textContent =
        "Loads sample entries, slots, and rules for this pack. You can edit or re-import afterward.";
    }
  }
}

async function onCreateProjectClick() {
  const nameInput = document.getElementById("new-project-name");
  const createBtn = document.getElementById("new-project-create");
  const statusEl = document.getElementById("new-project-status");

  let name = "Untitled project";
  if (nameInput !== null && nameInput.value.trim() !== "") {
    name = nameInput.value.trim();
  }

  const selected = document.querySelector(
    'input[name="new-project-preset"]:checked'
  );
  let presetId = "blank";
  if (selected !== null) {
    presetId = selected.value;
  }

  if (createBtn !== null) {
    createBtn.disabled = true;
  }

  if (statusEl !== null) {
    statusEl.textContent = "Creating project…";
  }

  try {
    const project = await buildProjectFromPreset(presetId, name);

    if (currentUser !== null) {
      const created = await createCloudProject({
        name: name,
        project: project
      });
      const cloudProject = created.project || project;
      cloudProject.id = created.id;
      cloudProject.name = created.name || name;
      cloudProject.cloudSynced = true;
      setProject(cloudProject);
      setCloudSynced(true);
      saveProject();
      window.location.href =
        "/app/project/?id=" + encodeURIComponent(created.id);
      return;
    }

    setProject(project);
    setCloudSynced(false);
    saveProject();
    window.location.href = "/app/project/";
  } catch (error) {
    console.error(error);
    if (statusEl !== null) {
      statusEl.textContent =
        error && error.message
          ? error.message
          : "Could not create project. Check the console for details.";
    }
    if (createBtn !== null) {
      createBtn.disabled = false;
    }
  }
}

/**
 * @param {HTMLElement} modal
 */
function openModal(modal) {
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  const nameInput = document.getElementById("new-project-name");
  if (nameInput !== null) {
    nameInput.focus();
  }
}

/**
 * @param {HTMLElement} modal
 */
function closeModal(modal) {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

/**
 * @param {string} iso
 * @returns {string}
 */
function formatUpdated(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return String(iso);
    }
    return d.toLocaleString();
  } catch (error) {
    return String(iso);
  }
}

function escapeHtml(text) {
  let safe = String(text);
  safe = safe.replace(/&/g, "&amp;");
  safe = safe.replace(/</g, "&lt;");
  safe = safe.replace(/>/g, "&gt;");
  safe = safe.replace(/"/g, "&quot;");
  return safe;
}

main();
