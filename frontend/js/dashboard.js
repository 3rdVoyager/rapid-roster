/**
 * dashboard.js
 *
 * Project list page (/app/):
 *   - Signed out: multi-project local library (capped)
 *   - Signed in: list/create/open/delete cloud projects from D1
 *
 * Preset packs are chosen in the project workspace after create (?new=1).
 */

import {
  createEmptyProject,
  setProject,
  saveProject,
  loadProject,
  setCloudSynced,
  clearSavedProject,
  listLocalProjects,
  deleteLocalProject,
  canCreateLocalProject,
  getLocalProjectCount,
  MAX_LOCAL_PROJECTS
} from "/js/state.js";

import {
  listProjects,
  createCloudProject,
  deleteCloudProject
} from "/js/api.js";

import { wireAccountMenu } from "/js/account.js";

/** @type {{ id: string, email: string }|null} */
let currentUser = null;

async function main() {
  currentUser = await wireAccountMenu();
  wireNewProjectModal();
  wireImportButton();
  wireProjectListClicks();
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
      const count = getLocalProjectCount();
      noteEl.innerHTML =
        "Projects save in this browser (" +
        String(count) +
        " / " +
        String(MAX_LOCAL_PROJECTS) +
        "). Sign in to sync across devices and save more.";
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
        buildProjectListItem({
          href: "/app/project/?id=" + encodeURIComponent(p.id),
          name: p.name,
          meta: "Updated " + formatUpdated(p.updated_at),
          deleteId: p.id,
          deleteKind: "cloud"
        });
    }
    listEl.innerHTML = html;
  } catch (error) {
    console.error(error);
    listEl.innerHTML =
      '<li class="project-list-status">Could not load cloud projects. Showing local library.</li>';
    renderLocalList(listEl, true);
  }
}

/**
 * @param {HTMLElement} listEl
 * @param {boolean} [append]
 */
function renderLocalList(listEl, append) {
  const projects = listLocalProjects();

  if (projects.length === 0) {
    const empty =
      '<li class="project-list-status">No local projects yet. Create one to get started.</li>';
    if (append === true) {
      listEl.innerHTML = listEl.innerHTML + empty;
    } else {
      listEl.innerHTML = empty;
    }
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
        deleteId: p.id,
        deleteKind: "local"
      });
  }

  if (append === true) {
    listEl.innerHTML = listEl.innerHTML + html;
  } else {
    listEl.innerHTML = html;
  }
}

/**
 * @param {{ href: string, name: string, meta: string, deleteId: string, deleteKind: string }} opts
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
    '" data-delete-kind="' +
    escapeHtml(opts.deleteKind) +
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

  listEl.addEventListener("click", async function (event) {
    const btn = event.target.closest(".project-delete-btn");
    if (btn === null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const kind = btn.getAttribute("data-delete-kind");
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
      if (kind === "cloud" && id !== null && id !== "") {
        await deleteCloudProject(id);

        const local = loadProject();
        if (local !== null && local.id === id) {
          clearSavedProject();
          setProject(null);
        }
      } else if (kind === "local" && id !== null && id !== "") {
        deleteLocalProject(id);
        setProject(null);
      }

      await renderProjectList();
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

function wireImportButton() {
  const importBtn = document.getElementById("import-project-btn");
  if (importBtn === null) {
    return;
  }

  importBtn.addEventListener("click", function () {
    window.location.href = "/app/project/#entries";
  });
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
    if (currentUser === null && canCreateLocalProject() === false) {
      if (statusEl !== null) {
        statusEl.innerHTML =
          "This browser already has " +
          String(MAX_LOCAL_PROJECTS) +
          ' local projects. <a href="/sign-in/">Sign in</a> to save more in the cloud, or delete one first.';
      }
      if (createBtn !== null) {
        createBtn.disabled = false;
      }
      return;
    }

    const project = createEmptyProject(name);

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
        "/app/project/?id=" +
        encodeURIComponent(created.id) +
        "&new=1";
      return;
    }

    setProject(project);
    setCloudSynced(false);
    const saved = saveProject();
    if (saved === false) {
      if (statusEl !== null) {
        statusEl.innerHTML =
          "Could not save locally (limit or storage full). <a href=\"/sign-in/\">Sign in</a> or delete a project.";
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
