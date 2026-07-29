/**
 * project.js
 *
 * Main controller for the project workspace.
 * Loads the project, wires panels, and handles global actions.
 */

import { getProject, setProject, setDirty, saveProject, loadProject, createEmptyProject } from "/js/state.js";
import { PRESET_CATALOG, buildProjectFromPreset } from "/js/presets.js";
import { initRouter } from "/js/project/router.js";
import { initEntriesPanel } from "/js/project/entries.js";
import { initSlotsPanel } from "/js/project/slots.js";
import { initRulesPanel } from "/js/project/rules.js";
import { initReviewPanel } from "/js/project/review.js";
import { initGeneratePanel } from "/js/project/generate.js";
import { initResultsPanel } from "/js/project/results.js";

/**
 * Initialize the workspace on page load.
 */
function init() {
  // Load or create project
  const project = loadProject() || createEmptyProject();
  setProject(project);

  // Init router with panel switching
  initRouter((panelId) => {
    // Refresh the active panel when switching
    switch (panelId) {
      case "entries":
        initEntriesPanel();
        break;
      case "slots":
        initSlotsPanel();
        break;
      case "rules":
        initRulesPanel();
        break;
      case "review":
        initReviewPanel();
        break;
      case "generate":
        initGeneratePanel();
        break;
      case "results":
        initResultsPanel();
        break;
    }
  });

  // Global actions
  initProjectActions();
  initPresetModal();
}

/**
 * Project-level buttons: export, import, name change.
 */
function initProjectActions() {
  const nameInput = document.getElementById("project-name");
  if (nameInput) {
    nameInput.addEventListener("input", () => {
      const project = getProject();
      project.name = nameInput.value;
      setProject(project);
      setDirty(true);
      saveProject();
    });
  }

  document.getElementById("export-project-btn")?.addEventListener("click", () => {
    const project = getProject();
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name || "project"}.rapidroster.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("import-project-btn")?.addEventListener("click", () => {
    document.getElementById("import-project-file")?.click();
  });

  document.getElementById("import-project-file")?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        setProject(data);
        setDirty(true);
        saveProject();
        location.reload();
      } catch {
        alert("Could not read that project file.");
      }
    };
    reader.readAsText(file);
  });
}

/**
 * Preset modal wiring.
 */
function initPresetModal() {
  const modal = document.getElementById("load-preset-modal");
  const listEl = document.getElementById("load-preset-list");
  const summaryEl = document.getElementById("load-preset-summary");
  const applyBtn = document.getElementById("load-preset-apply");
  const cancelBtn = document.getElementById("load-preset-cancel");
  const backdrop = document.getElementById("load-preset-backdrop");

  if (!modal || !listEl) return;

  // Populate preset list
  listEl.innerHTML = PRESET_CATALOG.map((preset) => {
    return `<label class="preset-choice">
      <input type="radio" name="preset-choice" value="${preset.id}" />
      <strong>${escapeHtml(preset.name)}</strong>
      <span>${escapeHtml(preset.description || "")}</span>
    </label>`;
  }).join("");

  const openSummary = () => {
    const checked = listEl.querySelector('input[name="preset-choice"]:checked');
    if (!checked) {
      summaryEl.textContent = "";
      return;
    }
    const preset = PRESET_CATALOG.find(p => p.id === checked.value);
    summaryEl.textContent = preset
      ? `Replaces entries, slots, rules, and global setup with the "${preset.name}" preset.`
      : "";
  };

  listEl.addEventListener("change", openSummary);

  const close = () => {
    modal.hidden = true;
    modal.removeAttribute("open");
  };

  const apply = () => {
    const checked = listEl.querySelector('input[name="preset-choice"]:checked');
    if (!checked) return;
    const preset = PRESET_CATALOG.find(p => p.id === checked.value);
    if (!preset) return;

    const project = buildProjectFromPreset(preset.id);
    if (project) {
      setProject(project);
      setDirty(true);
      saveProject();
      close();
      location.reload();
    }
  };

  document.getElementById("load-preset-btn")?.addEventListener("click", () => {
    modal.hidden = false;
    modal.setAttribute("open", "");
  });

  cancelBtn?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);
  applyBtn?.addEventListener("click", apply);
}

/**
 * Start the app once the DOM is ready.
 */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}