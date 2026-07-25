/**
 * get-started.js
 *
 * Chooser page: sign in, or open a local try-out project from a preset.
 */
import {
  PRESET_CATALOG,
  getPresetInfo,
  buildProjectFromPreset
} from "/js/presets.js";

import {
  setProject,
  saveProject,
  setCloudSynced,
  setDirty
} from "/js/state.js";

function main() {
  const tryBtn = document.getElementById("try-local-btn");
  const panel = document.getElementById("try-local-panel");
  const presetList = document.getElementById("try-local-preset-list");
  const openBtn = document.getElementById("try-local-open");
  const statusEl = document.getElementById("get-started-status");

  if (tryBtn === null || panel === null || openBtn === null) {
    return;
  }

  renderPresetChoices(presetList, "sports");
  updatePresetDetails("sports");

  tryBtn.addEventListener("click", function () {
    const open = panel.hidden === true;
    panel.hidden = !open;
    tryBtn.setAttribute("aria-expanded", open ? "true" : "false");
    tryBtn.classList.toggle("is-selected", open);

    if (open === true) {
      panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  if (presetList !== null) {
    presetList.addEventListener("change", function (event) {
      const input = event.target;
      if (input.name !== "try-local-preset") {
        return;
      }
      highlightSelectedPreset(presetList);
      updatePresetDetails(input.value);
    });
  }

  openBtn.addEventListener("click", async function () {
    const selected = document.querySelector(
      'input[name="try-local-preset"]:checked'
    );
    let presetId = "sports";
    if (selected !== null) {
      presetId = selected.value;
    }

    const info = getPresetInfo(presetId);
    let name = "Try-out project";
    if (info !== null && info.name !== undefined && info.name !== "") {
      name = info.name;
    }

    openBtn.disabled = true;
    if (statusEl !== null) {
      statusEl.hidden = false;
      statusEl.textContent = "Opening local project…";
    }

    try {
      const project = await buildProjectFromPreset(presetId, name);
      setProject(project);
      setCloudSynced(false);
      setDirty(false);
      saveProject();
      window.location.href = "/app/project/";
    } catch (error) {
      console.error(error);
      if (statusEl !== null) {
        statusEl.textContent =
          "Could not open that preset. Check the console for details.";
      }
      openBtn.disabled = false;
    }
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
      '<input type="radio" name="try-local-preset" value="' +
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

/**
 * @param {HTMLElement|null} listEl
 */
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
  const summaryEl = document.getElementById("try-local-summary");

  if (summaryEl === null || info === null) {
    return;
  }

  summaryEl.textContent = info.summary;
}

/**
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  let safe = String(text);
  safe = safe.replace(/&/g, "&amp;");
  safe = safe.replace(/</g, "&lt;");
  safe = safe.replace(/>/g, "&gt;");
  safe = safe.replace(/"/g, "&quot;");
  return safe;
}

main();
