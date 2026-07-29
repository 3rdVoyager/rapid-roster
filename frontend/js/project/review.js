/**
 * review.js
 *
 * Handles the Review panel: summary of entries, slots, rules, and global setup.
 */

import { getProject } from "/js/state.js";

export function refreshReview() {
  const project = getProject();
  const entries = project.entries || [];
  const slots = project.slots || [];
  const rules = project.rules || [];

  // Global
  const slotsPerEntryEl = document.getElementById("review-slots-per-entry");
  if (slotsPerEntryEl) {
    slotsPerEntryEl.textContent = String(project.defaultSlotsPerEntry ?? 1);
  }

  const conflictsEl = document.getElementById("review-conflicts");
  if (conflictsEl) {
    const groups = project.conflictGroups || [];
    conflictsEl.textContent = groups.length === 0 ? "None" : `${groups.length} group(s)`;
  }

  // Entries
  const entriesCountEl = document.getElementById("review-entries-count");
  if (entriesCountEl) {
    entriesCountEl.innerHTML = `<strong>${entries.length}</strong> entries loaded`;
  }

  const entriesPreviewEl = document.getElementById("review-entries-preview");
  if (entriesPreviewEl) {
    entriesPreviewEl.innerHTML = entries
      .slice(0, 20)
      .map((entry) => `<li>${escapeHtml(entry.name || entry.id || "Unnamed")}</li>`)
      .join("");
    if (entries.length > 20) {
      entriesPreviewEl.innerHTML += `<li>+${entries.length - 20} more</li>`;
    }
  }

  // Slots
  const slotsCountEl = document.getElementById("review-slots-count");
  if (slotsCountEl) {
    slotsCountEl.innerHTML = `<strong>${slots.length}</strong> slots`;
  }

  const slotsPreviewEl = document.getElementById("review-slots-preview");
  if (slotsPreviewEl) {
    slotsPreviewEl.innerHTML = slots
      .slice(0, 20)
      .map((slot, i) => {
        const label = slot.name || slot.id || `Slot ${i + 1}`;
        const size = slot.min_size !== undefined || slot.max_size !== undefined
          ? `${slot.min_size ?? "?"}–${slot.max_size ?? "?"}`
          : "";
        return `<li><strong>${escapeHtml(label)}</strong><span>${size ? `Size ${size}` : ""}</span></li>`;
      })
      .join("");
    if (slots.length > 20) {
      slotsPreviewEl.innerHTML += `<li>+${slots.length - 20} more</li>`;
    }
  }

  // Rules
  const rulesListEl = document.getElementById("review-rules-list");
  if (rulesListEl) {
    rulesListEl.innerHTML = rules
      .map((rule, index) => {
        const priority = rule.priority === "hard" ? "Hard" : `P${rule.priority}`;
        const badgeClass = rule.priority === "hard" ? "is-active" : "";
        const desc = generateRuleDescription(rule);
        return `<li>
          <div class="review-rule-top">
            <strong>${escapeHtml(rule.label || `Rule ${index + 1}`)}</strong>
            <span class="app-pill ${badgeClass}">${rule.priority === "hard" ? "Hard" : "Soft"} · ${priority}</span>
          </div>
          <p>${escapeHtml(desc)}</p>
        </li>`;
      })
      .join("");
  }
}

function generateRuleDescription(rule) {
  const cfg = rule.config || {};
  switch (rule.action) {
    case "cluster":
    case "separate": {
      const p1 = cfg.data?.parameter1 || "entries";
      return `${rule.action === "cluster" ? "Keep together" : "Keep apart"}: ${p1}`;
    }
    case "limit": {
      const p1 = cfg.data?.parameter1 || "entries";
      const p2 = cfg.data2?.parameter1 || "slots";
      const min = cfg.min ?? 0;
      const max = cfg.max ?? 1;
      return `Limit ${p1} per ${p2} to ${min}–${max}`;
    }
    case "match": {
      return `Match ${cfg.entryColumn || "entries"} to ${cfg.slotColumn || "slots"}`;
    }
    case "balance": {
      return `Balance ${cfg.attribute || "attribute"} across ${cfg.data?.parameter1 || "entries"}`;
    }
    case "assign":
    case "avoid": {
      return `${rule.action === "assign" ? "Place" : "Avoid placing"} ${cfg.data?.parameter1 || "entries"} to ${cfg.data2?.parameter1 || "slots"}`;
    }
    default:
      return rule.action;
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """);
}

export function initReviewPanel() {
  refreshReview();
}