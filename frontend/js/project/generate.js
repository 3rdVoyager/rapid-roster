/**
 * generate.js
 *
 * Handles the Generate panel: search settings and running the generator.
 */

import { getProject } from "/js/state.js";
import { buildSearchOptions, normalizeGenerateSettings } from "/js/generator/search.js";

let generateAbort = false;

export function refreshGenerateStatus() {
  const project = getProject();
  const entries = project.entries || [];
  const slots = project.slots || [];
  const rules = project.rules || [];

  const statusEl = document.getElementById("generate-status-title");
  const detailEl = document.getElementById("generate-status-detail");

  if (statusEl) {
    if (entries.length === 0 || slots.length === 0) {
      statusEl.textContent = "Not ready";
    } else if (rules.length === 0) {
      statusEl.textContent = "No rules";
    } else {
      statusEl.textContent = "Ready";
    }
  }

  if (detailEl) {
    if (entries.length === 0) detailEl.textContent = "Add entries first.";
    else if (slots.length === 0) detailEl.textContent = "Add slots first.";
    else if (rules.length === 0) detailEl.textContent = "Add at least one rule.";
    else detailEl.textContent = "Ready to generate.";
  }
}

export function startGenerate() {
  const project = getProject();
  const entries = project.entries || [];
  const slots = project.slots || [];
  const rules = project.rules || [];

  if (entries.length === 0 || slots.length === 0 || rules.length === 0) {
    alert("Please add entries, slots, and at least one rule before generating.");
    return;
  }

  generateAbort = false;

  const generateBtn = document.getElementById("generate-btn");
  const cancelBtn = document.getElementById("cancel-generate-btn");
  const progressEl = document.getElementById("generate-progress");
  const progressFill = document.getElementById("generate-progress-fill");
  const progressLabel = document.getElementById("generate-progress-label");
  const optionsListEl = document.getElementById("generate-options-list");

  if (generateBtn) generateBtn.disabled = true;
  if (cancelBtn) cancelBtn.disabled = false;
  if (progressEl) progressEl.hidden = false;
  if (optionsListEl) optionsListEl.innerHTML = "";

  const settings = normalizeGenerateSettings({
    mode: document.querySelector('input[name="generate-mode"]:checked')?.value || "balanced",
  });

  try {
    const searchOptions = buildSearchOptions(project, settings);
    const results = [];

    // Simulate async search with progress updates
    const totalSteps = 10;
    let currentStep = 0;

    const interval = setInterval(() => {
      if (generateAbort) {
        clearInterval(interval);
        if (generateBtn) generateBtn.disabled = false;
        if (cancelBtn) cancelBtn.disabled = true;
        if (progressEl) progressEl.hidden = true;
        return;
      }

      currentStep++;
      const pct = Math.round((currentStep / totalSteps) * 100);
      if (progressFill) progressFill.style.width = `${pct}%`;
      if (progressLabel) progressLabel.textContent = `Searching... ${pct}%`;

      // After a few steps, show a placeholder result
      if (currentStep === 3) {
        const mockResult = {
          score: 85,
          assignments: slots.map((slot, i) => ({
            slot: slot.name || slot.id || `Slot ${i + 1}`,
            entries: entries.slice(0, Math.min(2, entries.length)).map(e => e.name || e.id || "?"),
          })),
        };
        results.push(mockResult);

        if (optionsListEl) {
          optionsListEl.innerHTML = `<div class="card"><div class="card-header"><h3 class="card-title">Option 1 — Score: ${mockResult.score}</h3></div>` +
            mockResult.assignments.map(a => `<p><strong>${escapeHtml(a.slot)}</strong>: ${a.entries.map(e => escapeHtml(e)).join(", ")}</p>`).join("") +
            `</div>`;
        }
      }

      if (currentStep >= totalSteps) {
        clearInterval(interval);
        if (generateBtn) generateBtn.disabled = false;
        if (cancelBtn) cancelBtn.disabled = true;
        if (progressEl) progressEl.hidden = true;
      }
    }, 300);

  } catch (err) {
    alert(`Generate failed: ${err.message}`);
    if (generateBtn) generateBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = true;
  }
}

export function cancelGenerate() {
  generateAbort = true;
  const statusEl = document.getElementById("generate-status-title");
  if (statusEl) statusEl.textContent = "Cancelled";
}

export function initGeneratePanel() {
  refreshGenerateStatus();

  document.getElementById("generate-btn")?.addEventListener("click", startGenerate);
  document.getElementById("cancel-generate-btn")?.addEventListener("click", cancelGenerate);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """);
}