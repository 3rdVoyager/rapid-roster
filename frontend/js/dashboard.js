/**
 * dashboard.js
 *
 * Local app hub (/app/):
 *   - Projects view (empty state + rich list)
 *   - Presets view
 *   - Create from blank or preset
 *   - Export all / import backup
 */

import {
  setProject,
  saveProject,
  listLocalProjects,
  deleteLocalProject,
  duplicateLocalProject,
  peekLocalProjectById,
  saveProjectIntoLibrary,
  downloadProjectFile,
  downloadLibraryBackup,
  parseImportFile
} from "/js/state.js";

import {
  PRESET_CATALOG,
  getPresetInfo,
  buildProjectFromPreset
} from "/js/presets.js";

/** @type {"projects"|"presets"} */
let currentView = "projects";

/** Preset id selected in the create modal. */
let selectedCreatePresetId = "blank";

async function main() {
  wireHeaderNav();
  wireHubActions();
  wireNewProjectModal();
  wireProjectListClicks();
  fillPresetGrid();
  applyHashView();
  window.addEventListener("hashchange", applyHashView);
  await refreshProjectsView();
}

function wireHeaderNav() {
  const projects = document.getElementById("nav-projects");
  const presets = document.getElementById("nav-presets");

  if (projects !== null) {
    projects.addEventListener("click", function (event) {
      event.preventDefault();
      setView("projects");
    });
  }

  if (presets !== null) {
    presets.addEventListener("click", function (event) {
      event.preventDefault();
      setView("presets");
    });
  }
}

/**
 * @param {"projects"|"presets"} view
 */
function setView(view) {
  currentView = view === "presets" ? "presets" : "projects";
  const nextHash = currentView === "presets" ? "#presets" : "#projects";
  if (window.location.hash !== nextHash) {
    window.history.replaceState({}, "", nextHash);
  }
  renderViewShell();
}

function applyHashView() {
  const hash = String(window.location.hash || "").toLowerCase();
  if (hash === "#presets") {
    currentView = "presets";
  } else {
    currentView = "projects";
  }
  renderViewShell();
}

function renderViewShell() {
  const projectsView = document.getElementById("view-projects");
  const presetsView = document.getElementById("view-presets");
  const navProjects = document.getElementById("nav-projects");
  const navPresets = document.getElementById("nav-presets");

  if (projectsView !== null) {
    projectsView.hidden = currentView !== "projects";
  }
  if (presetsView !== null) {
    presetsView.hidden = currentView !== "presets";
  }
  if (navProjects !== null) {
    if (currentView === "projects") {
      navProjects.setAttribute("aria-current", "page");
    } else {
      navProjects.removeAttribute("aria-current");
    }
  }
  if (navPresets !== null) {
    if (currentView === "presets") {
      navPresets.setAttribute("aria-current", "page");
    } else {
      navPresets.removeAttribute("aria-current");
    }
  }
}

function wireHubActions() {
  const exportAllBtn = document.getElementById("export-all-btn");
  if (exportAllBtn !== null) {
    exportAllBtn.addEventListener("click", function () {
      const ok = downloadLibraryBackup();
      if (ok === false) {
        setHubStatus("No projects to export yet.", true);
      } else {
        setHubStatus("Backup downloaded.", false);
      }
    });
  }

  const importFile = document.getElementById("import-hub-file");
  if (importFile !== null) {
    importFile.addEventListener("change", onImportHubFileChange);
  }
}

/**
 * @param {string|null} message
 * @param {boolean} [isError]
 */
function setHubStatus(message, isError) {
  const el = document.getElementById("hub-status");
  if (el === null) {
    return;
  }
  if (message === null || message === "") {
    el.hidden = true;
    el.textContent = "";
    el.classList.remove("is-error");
    return;
  }
  el.hidden = false;
  el.textContent = message;
  if (isError === true) {
    el.classList.add("is-error");
  } else {
    el.classList.remove("is-error");
  }
}

async function refreshProjectsView() {
  const listEl = document.getElementById("project-list");
  const emptyEl = document.getElementById("hub-empty");
  const noteEl = document.getElementById("projects-note");

  if (listEl === null || emptyEl === null) {
    return;
  }

  const projects = listLocalProjects();

  if (projects.length === 0) {
    emptyEl.hidden = false;
    listEl.hidden = true;
    listEl.innerHTML = "";
    if (noteEl !== null) {
      noteEl.hidden = true;
    }
    return;
  }

  emptyEl.hidden = true;
  listEl.hidden = false;
  if (noteEl !== null) {
    noteEl.hidden = false;
  }
  renderLocalList(listEl, projects);
}

/**
 * @param {HTMLElement} listEl
 * @param {Object[]} projects
 */
function renderLocalList(listEl, projects) {
  let html = "";
  for (let i = 0; i < projects.length; i = i + 1) {
    html = html + buildProjectListItem(projects[i]);
  }
  listEl.innerHTML = html;
}

/**
 * @param {Object} p
 * @returns {string}
 */
function buildProjectListItem(p) {
  const name = p.name || "Untitled project";
  const href = "/app/project/?id=" + encodeURIComponent(p.id);
  const meta =
    formatUpdated(p.updatedAt) +
    " · " +
    String(p.entryCount || 0) +
    " entries · " +
    String(p.slotCount || 0) +
    " slots · " +
    String(p.ruleCount || 0) +
    " rules";

  return (
    '<li class="project-list-item">' +
    '<div class="project-row">' +
    '<a class="project-row-link" href="' +
    escapeHtml(href) +
    '">' +
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
    "</a>" +
    '<div class="project-row-actions">' +
    '<button class="button button-ghost button-small project-action-btn" type="button" data-action="duplicate" data-id="' +
    escapeHtml(p.id) +
    '" data-name="' +
    escapeHtml(name) +
    '" title="Make a copy of this project under a new name.">Duplicate</button>' +
    '<button class="button button-ghost button-small project-action-btn" type="button" data-action="export" data-id="' +
    escapeHtml(p.id) +
    '" data-name="' +
    escapeHtml(name) +
    '" title="Download this project as a JSON file you can back up or share.">Export</button>' +
    '<button class="button button-secondary button-small project-action-btn project-delete-btn" type="button" data-action="delete" data-id="' +
    escapeHtml(p.id) +
    '" data-name="' +
    escapeHtml(name) +
    '" title="Permanently delete this project from this browser." aria-label="Delete ' +
    escapeHtml(name) +
    '">' +
    '<span class="material-symbols-outlined" aria-hidden="true">delete</span>' +
    "</button>" +
    "</div>" +
    "</div>" +
    "</li>"
  );
}

function wireProjectListClicks() {
  const listEl = document.getElementById("project-list");
  if (listEl === null) {
    return;
  }

  listEl.addEventListener("click", async function (event) {
    const btn = event.target.closest(".project-action-btn");
    if (btn === null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    const name = btn.getAttribute("data-name") || "this project";

    if (id === null || id === "") {
      return;
    }

    btn.disabled = true;

    try {
      if (action === "delete") {
        const confirmed = window.confirm(
          'Delete "' + name + '"? This cannot be undone.'
        );
        if (confirmed === false) {
          btn.disabled = false;
          return;
        }
        deleteLocalProject(id);
        setProject(null);
        setHubStatus('Deleted "' + name + '".', false);
        await refreshProjectsView();
        return;
      }

      if (action === "export") {
        const project = peekLocalProjectById(id);
        if (project === null) {
          setHubStatus("Could not find that project.", true);
        } else {
          downloadProjectFile(project);
          setHubStatus('Exported "' + name + '".', false);
        }
        btn.disabled = false;
        return;
      }

      if (action === "duplicate") {
        const copy = duplicateLocalProject(id);
        if (copy === null) {
          setHubStatus("Could not duplicate that project.", true);
        } else {
          setHubStatus('Duplicated as "' + copy.name + '".', false);
          await refreshProjectsView();
        }
        return;
      }
    } catch (error) {
      console.error(error);
      setHubStatus(
        error && error.message ? error.message : "Something went wrong.",
        true
      );
    }

    btn.disabled = false;
  });
}

function fillPresetGrid() {
  const grid = document.getElementById("preset-grid");
  if (grid === null) {
    return;
  }

  let html = "";
  for (let i = 0; i < PRESET_CATALOG.length; i = i + 1) {
    const preset = PRESET_CATALOG[i];
    html =
      html +
      '<article class="preset-card">' +
      "<h2>" +
      escapeHtml(preset.name) +
      "</h2>" +
      "<p>" +
      escapeHtml(preset.summary) +
      "</p>" +
      '<button class="button button-primary" type="button" data-use-preset="' +
      escapeHtml(preset.id) +
      '" title="Start a new project filled with this sample pack’s entries, slots, and rules.">Use this preset</button>' +
      "</article>";
  }
  grid.innerHTML = html;

  grid.addEventListener("click", function (event) {
    const btn = event.target.closest("[data-use-preset]");
    if (btn === null) {
      return;
    }
    const presetId = btn.getAttribute("data-use-preset");
    if (presetId) {
      openCreateModal(presetId);
    }
  });
}

/**
 * @param {string} [presetId]
 */
function openCreateModal(presetId) {
  const modal = document.getElementById("new-project-modal");
  if (modal === null) {
    return;
  }

  selectedCreatePresetId =
    typeof presetId === "string" && presetId !== "" ? presetId : "blank";

  const lead = document.getElementById("new-project-lead");
  const info = getPresetInfo(selectedCreatePresetId);
  if (lead !== null) {
    if (info !== null && info.loadsSampleData === true) {
      lead.textContent =
        "Name your project. It will open with the " + info.name + " sample data.";
    } else {
      lead.textContent =
        "Name your project to open the workspace. You’ll choose a blank start or a sample preset next.";
    }
  }

  syncNameDefaultFromPreset(true);
  setCreateStatus("");
  openModal(modal);
}

/**
 * @param {boolean} force
 */
function syncNameDefaultFromPreset(force) {
  const nameInput = document.getElementById("new-project-name");
  if (nameInput === null) {
    return;
  }

  const info = getPresetInfo(selectedCreatePresetId);
  const defaultName =
    info !== null && info.id !== "blank" ? info.name : "Untitled project";

  if (
    force === true ||
    nameInput.value.trim() === "" ||
    nameInput.value === "Untitled project" ||
    isKnownPresetName(nameInput.value.trim())
  ) {
    nameInput.value = defaultName;
  }
}

/**
 * @param {string} name
 * @returns {boolean}
 */
function isKnownPresetName(name) {
  for (let i = 0; i < PRESET_CATALOG.length; i = i + 1) {
    if (PRESET_CATALOG[i].name === name) {
      return true;
    }
  }
  return name === "Untitled project";
}

function wireNewProjectModal() {
  const openBtn = document.getElementById("new-project-btn");
  const modal = document.getElementById("new-project-modal");
  const backdrop = document.getElementById("new-project-backdrop");
  const cancelBtn = document.getElementById("new-project-cancel");
  const createBtn = document.getElementById("new-project-create");

  if (modal === null) {
    return;
  }

  if (openBtn !== null) {
    openBtn.addEventListener("click", function (event) {
      event.preventDefault();
      openCreateModal("blank");
    });
  }

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

  if (createBtn !== null) {
    createBtn.addEventListener("click", onCreateProjectClick);
  }
}

async function onCreateProjectClick() {
  const nameInput = document.getElementById("new-project-name");
  const createBtn = document.getElementById("new-project-create");

  let name = "Untitled project";
  if (nameInput !== null && nameInput.value.trim() !== "") {
    name = nameInput.value.trim();
  }

  const presetId = selectedCreatePresetId || "blank";

  if (createBtn !== null) {
    createBtn.disabled = true;
  }
  setCreateStatus("Creating project…");

  try {
    const project = await buildProjectFromPreset(presetId, name);
    setProject(project);
    const saved = saveProject();
    if (saved === false) {
      setCreateStatus(
        "Could not save in this browser. Check storage space, or delete a project."
      );
      if (createBtn !== null) {
        createBtn.disabled = false;
      }
      return;
    }

    const info = getPresetInfo(presetId);
    const useNewFlag = info === null || info.loadsSampleData !== true;
    let href =
      "/app/project/?id=" + encodeURIComponent(project.id);
    if (useNewFlag === true) {
      href = href + "&new=1";
    }
    window.location.href = href;
  } catch (error) {
    console.error(error);
    setCreateStatus(
      error && error.message
        ? error.message
        : "Could not create project. Check the console for details."
    );
    if (createBtn !== null) {
      createBtn.disabled = false;
    }
  }
}

/**
 * @param {string} message
 */
function setCreateStatus(message) {
  const statusEl = document.getElementById("new-project-status");
  if (statusEl !== null) {
    statusEl.textContent = message;
  }
}

async function onImportHubFileChange(event) {
  const file = event.target.files[0];
  if (file === undefined || file === null) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = parseImportFile(text);
    if (parsed.ok === false) {
      setHubStatus(parsed.error, true);
      event.target.value = "";
      return;
    }

    const label =
      parsed.kind === "library"
        ? String(parsed.projects.length) + " projects from this backup"
        : "this project";
    const ok = window.confirm(
      "Import " + label + "? Existing projects with the same id will get a new id."
    );
    if (ok === false) {
      event.target.value = "";
      return;
    }

    let imported = 0;
    for (let i = 0; i < parsed.projects.length; i = i + 1) {
      const result = saveProjectIntoLibrary(parsed.projects[i], {
        forceNewId: false
      });
      // saveProjectIntoLibrary already assigns new id on collision
      if (result.ok === true) {
        imported = imported + 1;
      }
    }

    setView("projects");
    await refreshProjectsView();
    setHubStatus(
      "Imported " + String(imported) + " project" + (imported === 1 ? "" : "s") + ".",
      false
    );
  } catch (error) {
    console.error(error);
    setHubStatus("Could not read that file.", true);
  } finally {
    event.target.value = "";
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
    nameInput.select();
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
  if (!iso) {
    return "Saved in this browser";
  }
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return String(iso);
    }
    return "Updated " + d.toLocaleString();
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
