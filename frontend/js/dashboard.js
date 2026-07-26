/**
 * dashboard.js
 *
 * Project list page (/app/): local multi-project library in this browser.
 *
 * Preset packs are chosen in the project workspace after create (?new=1).
 */

import {
  createEmptyProject,
  setProject,
  saveProject,
  listLocalProjects,
  deleteLocalProject
} from "/js/state.js";

async function main() {
  wireNewProjectModal();
  wireProjectListClicks();
  renderProjectList();
}

function renderProjectList() {
  const listEl = document.getElementById("project-list");
  const noteEl = document.querySelector(".dashboard-note");

  if (listEl === null) {
    return;
  }

  if (noteEl !== null) {
    noteEl.hidden = false;
    noteEl.textContent =
      "Projects save in this browser on this device.";
  }

  renderLocalList(listEl);
}

/**
 * @param {HTMLElement} listEl
 */
function renderLocalList(listEl) {
  const projects = listLocalProjects();

  if (projects.length === 0) {
    listEl.innerHTML =
      '<li class="project-list-status">No projects yet. Create one to get started.</li>';
    return;
  }

  let html = "";
  for (let i = 0; i < projects.length; i = i + 1) {
    const p = projects[i];
    let meta = "Saved in this browser";
    if (p.updatedAt) {
      meta = meta + " · " + formatUpdated(p.updatedAt);
    }
    html =
      html +
      buildProjectListItem({
        href: "/app/project/?id=" + encodeURIComponent(p.id),
        name: p.name || "Untitled project",
        meta: meta,
        deleteId: p.id
      });
  }

  listEl.innerHTML = html;
}

/**
 * @param {{ href: string, name: string, meta: string, deleteId: string }} opts
 * @returns {string}
 */
function buildProjectListItem(opts) {
  return (
    '<li class="project-list-item">' +
    '<a class="project-row" href="' +
    escapeHtml(opts.href) +
    '">' +
    '<span class="project-row-icon" aria-hidden="true">' +
    '<span class="material-symbols-outlined">folder_open</span>' +
    "</span>" +
    '<span class="project-row-main">' +
    "<strong>" +
    escapeHtml(opts.name) +
    "</strong>" +
    '<span class="project-row-meta">' +
    escapeHtml(opts.meta) +
    "</span>" +
    "</span>" +
    '<span class="project-row-aside">' +
    '<span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>' +
    "</span>" +
    "</a>" +
    '<button class="button button-secondary button-small project-delete-btn" type="button" aria-label="Delete ' +
    escapeHtml(opts.name) +
    '" title="Delete" data-delete-id="' +
    escapeHtml(opts.deleteId) +
    '" data-delete-name="' +
    escapeHtml(opts.name) +
    '">' +
    '<span class="material-symbols-outlined" aria-hidden="true">delete</span>' +
    "</button>" +
    "</li>"
  );
}

function wireProjectListClicks() {
  const listEl = document.getElementById("project-list");
  if (listEl === null) {
    return;
  }

  listEl.addEventListener("click", function (event) {
    const btn = event.target.closest(".project-delete-btn");
    if (btn === null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const id = btn.getAttribute("data-delete-id");
    const name = btn.getAttribute("data-delete-name") || "this project";

    const confirmed = window.confirm(
      'Delete "' + name + '"? This cannot be undone.'
    );
    if (confirmed === false) {
      return;
    }

    btn.disabled = true;

    try {
      if (id !== null && id !== "") {
        deleteLocalProject(id);
        setProject(null);
      }
      renderProjectList();
    } catch (error) {
      console.error(error);
      window.alert(
        error && error.message
          ? error.message
          : "Could not delete that project."
      );
      btn.disabled = false;
    }
  });
}

function wireNewProjectModal() {
  const openBtn = document.getElementById("new-project-btn");
  const modal = document.getElementById("new-project-modal");
  const backdrop = document.getElementById("new-project-backdrop");
  const cancelBtn = document.getElementById("new-project-cancel");
  const createBtn = document.getElementById("new-project-create");

  if (openBtn === null || modal === null) {
    return;
  }

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

  if (createBtn !== null) {
    createBtn.addEventListener("click", onCreateProjectClick);
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

  if (createBtn !== null) {
    createBtn.disabled = true;
  }

  if (statusEl !== null) {
    statusEl.textContent = "Creating project…";
  }

  try {
    const project = createEmptyProject(name);
    setProject(project);
    const saved = saveProject();
    if (saved === false) {
      if (statusEl !== null) {
        statusEl.textContent =
          "Could not save in this browser. Check storage space, or delete a project.";
      }
      if (createBtn !== null) {
        createBtn.disabled = false;
      }
      return;
    }

    window.location.href =
      "/app/project/?id=" + encodeURIComponent(project.id) + "&new=1";
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
