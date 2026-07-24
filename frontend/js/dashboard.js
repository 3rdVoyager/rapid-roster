/**
 * dashboard.js
 *
 * Project list page (/app/): New project modal with blank vs preset + templates.
 */

import {
  PRESET_CATALOG,
  getPresetInfo,
  getPresetTemplateUrls,
  buildProjectFromPreset
} from "/js/presets.js";

import { setProject, saveProject } from "/js/state.js";

function main() {
  wireNewProjectModal();
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
    // Button may be an <a> — stop navigation; we open the modal instead.
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

  const templateLinks = document.getElementById("new-project-templates");
  if (templateLinks !== null) {
    templateLinks.addEventListener("click", onTemplateLinkClick);
  }

  if (createBtn !== null) {
    createBtn.addEventListener("click", onCreateProjectClick);
  }
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
      warnEl.textContent =
        "Starts empty. Use the template downloads if you want the expected CSV headers.";
    } else {
      warnEl.textContent =
        "Loads sample entries, slots, and rules for this pack. You can edit or re-import afterward.";
    }
  }

  // Point template links at this preset’s files.
  const urls = getPresetTemplateUrls(presetId);
  setTemplateHref("template-entries", urls.entries, presetId + "-entries.csv");
  setTemplateHref("template-slots", urls.slots, presetId + "-slots.csv");
  setTemplateHref("template-rules", urls.rules, presetId + "-rules.csv");
}

/**
 * @param {string} linkId
 * @param {string} url
 * @param {string} filename
 */
function setTemplateHref(linkId, url, filename) {
  const link = document.getElementById(linkId);
  if (link === null) {
    return;
  }
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.setAttribute("data-download-name", filename);
}

/**
 * Prefer the download attribute; fall back to JS click helper if needed.
 * @param {MouseEvent} event
 */
function onTemplateLinkClick(event) {
  const link = event.target.closest("a[download]");
  if (link === null) {
    return;
  }
  // Let the browser handle normal download links.
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
    setProject(project);
    saveProject();
    window.location.href = "/app/project/";
  } catch (error) {
    console.error(error);
    if (statusEl !== null) {
      statusEl.textContent =
        "Could not create project. Check the console for details.";
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

function escapeHtml(text) {
  let safe = String(text);
  safe = safe.replace(/&/g, "&amp;");
  safe = safe.replace(/</g, "&lt;");
  safe = safe.replace(/>/g, "&gt;");
  safe = safe.replace(/"/g, "&quot;");
  return safe;
}

main();

