import { exportCsv } from "./export.js";
import { parseCsv } from "./import.js";

const data = { items: [], slots: [], rules: [] };
const STORAGE_KEY = "rapid-roster-project";
let latestCsv = "";

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

function setMessage(message, isError = false) {
  const element = $("#app-message");
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    setMessage(`Could not save project locally: ${error.message}`, true);
  }
}

function restoreData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    const restored = JSON.parse(saved);
    if (
      !restored ||
      !Array.isArray(restored.items) ||
      !Array.isArray(restored.slots) ||
      !Array.isArray(restored.rules)
    ) {
      throw new Error("Saved project must contain items, slots, and rules arrays.");
    }
    data.items = restored.items;
    data.slots = restored.slots;
    data.rules = restored.rules;
    $("#rules-input").value = data.rules.length
      ? JSON.stringify(data.rules, null, 2)
      : "";
    setMessage("Saved project restored.");
  } catch (error) {
    setMessage(`Could not restore saved project: ${error.message}`, true);
  }
}

function setTab(tab) {
  if (!["items", "slots", "rules", "generate"].includes(tab)) return;
  document.querySelectorAll(".app-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === tab);
  });
  document.querySelectorAll(".app-nav-item").forEach((link) => {
    link.classList.toggle("is-active", link.getAttribute("href") === `#${tab}`);
  });
  window.history.replaceState(null, "", `#${tab}`);
}

function getHeaders(records) {
  return [...new Set(records.flatMap((record) => Object.keys(record)))];
}

function renderTable(type) {
  const records = data[type];
  const headers = getHeaders(records);
  const prefix = type === "items" ? "items" : "slots";
  $(`#${prefix}-count`).textContent = `${records.length} ${type}`;
  $(`#${prefix}-empty`).hidden = records.length > 0;
  $(`#${prefix}-head`).innerHTML = headers.length
    ? `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}<th></th></tr>`
    : "";
  $(`#${prefix}-body`).innerHTML = records.map((record, rowIndex) => `
    <tr>
      ${headers.map((header) => `<td><input data-type="${type}" data-row="${rowIndex}" data-key="${escapeHtml(header)}" value="${escapeHtml(formatValue(record[header]))}" /></td>`).join("")}
      <td><button class="icon-button" data-delete="${type}" data-row="${rowIndex}" type="button" aria-label="Delete ${type.slice(0, -1)}">×</button></td>
    </tr>`).join("");
}

function formatValue(value) {
  return Array.isArray(value) ? value.join("; ") : value ?? "";
}

function renderCounts() {
  $("#generate-items-count").textContent = data.items.length;
  $("#generate-slots-count").textContent = data.slots.length;
  $("#generate-rules-count").textContent = data.rules.length;
  $("#rules-count").textContent = `${data.rules.length} rules`;
}

function renderAll() {
  renderTable("items");
  renderTable("slots");
  renderCounts();
}

function updateRecord(event) {
  const input = event.target.closest("input[data-type]");
  if (!input) return;
  const record = data[input.dataset.type][Number(input.dataset.row)];
  record[input.dataset.key] = input.value.includes(";")
    ? input.value.split(";").map((value) => value.trim()).filter(Boolean)
    : input.value;
  saveData();
}

async function importFile(event, type, format) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const value = format === "csv" ? parseCsv(text) : JSON.parse(text);
    if (!Array.isArray(value)) throw new Error("Imported JSON must be an array.");
    data[type] = value;
    if (type === "rules") $("#rules-input").value = JSON.stringify(value, null, 2);
    saveData();
    renderAll();
    setMessage(`${file.name} imported.`);
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    event.target.value = "";
  }
}

function syncRules() {
  const text = $("#rules-input").value.trim();
  data.rules = text ? JSON.parse(text) : [];
  if (!Array.isArray(data.rules)) throw new Error("Rules JSON must be an array.");
  saveData();
  renderCounts();
}

function downloadCsv() {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([latestCsv], { type: "text/csv" }));
  link.download = "rapid-roster.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function renderResults(result) {
  const names = new Map(data.items.map((item) => [item.id, item.name ?? item.id]));
  $("#results-body").innerHTML = Object.entries(result.assignments).map(([slot, itemIds]) => `
    <tr>
      <th scope="row">${escapeHtml(slot)}</th>
      <td>${itemIds.map((id) => `<span class="person-chip">${escapeHtml(names.get(id) ?? id)}</span>`).join("") || '<span class="muted">No assignments</span>'}</td>
      <td>${itemIds.length}</td>
    </tr>`).join("");
  const evaluation = result.evaluation;
  $("#metrics").innerHTML = `
    <div><span>Hard violations</span><strong>${evaluation.hardViolations.length}</strong></div>
    <div><span>Soft violations</span><strong>${evaluation.softViolations.length}</strong></div>
    <div><span>Soft penalty</span><strong>${evaluation.softPenalty.toFixed(2)}</strong></div>`;
  latestCsv = exportCsv(Object.entries(result.assignments).flatMap(([slot, itemIds]) =>
    itemIds.map((itemId) => ({ slot, itemId, participant: names.get(itemId) ?? itemId }))));
  $("#csv-output").textContent = latestCsv;
  $("#result-empty").hidden = true;
  $("#result-content").hidden = false;
  $("#copy-button").disabled = false;
  $("#download-button").disabled = false;
}

async function generate() {
  let worker;
  try {
    syncRules();
    if (!data.items.length || !data.slots.length) {
      throw new Error("Add items and slots before generating.");
    }
    $("#generate-button").disabled = true;
    $("#generate-button").textContent = "Generating…";
    $("#generation-message").textContent = "Finding a compatible roster…";
    worker = new Worker(new URL("./generation-worker.js", import.meta.url), {
      type: "module",
    });
    const result = await new Promise((resolve, reject) => {
      worker.addEventListener("message", ({ data: message }) => {
        if (message.type === "progress") {
          const progress = message.progress;
          $("#generation-message").textContent =
            `Soft round ${progress.round}: rule ${progress.ruleId ?? "none"}; ` +
            `penalty ${progress.softPenalty}; improvement ${progress.improvement}`;
        } else if (message.type === "complete") {
          resolve(message.result);
        } else if (message.type === "error") {
          reject(new Error(message.message));
        }
      });
      worker.addEventListener("error", (error) => {
        reject(new Error(error.message || "Roster generation worker failed."));
      });
      worker.postMessage({ ...data, maxSoftRounds: 20 });
    });
    renderResults(result);
    $("#generation-message").textContent = "Roster generated successfully.";
    setMessage("Roster generated successfully.");
  } catch (error) {
    $("#generation-message").textContent = error.message;
    setMessage(error.message, true);
  } finally {
    worker?.terminate();
    $("#generate-button").disabled = false;
    $("#generate-button").textContent = "Generate roster";
  }
}

document.querySelectorAll(".app-nav-item").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setTab(link.getAttribute("href").slice(1));
  });
});
document.querySelectorAll("[data-next]").forEach((button) => {
  button.addEventListener("click", () => setTab(button.dataset.next));
});
$("#items-file").addEventListener("change", (event) => importFile(event, "items", "csv"));
$("#slots-file").addEventListener("change", (event) => importFile(event, "slots", "csv"));
$("#rules-file").addEventListener("change", (event) => importFile(event, "rules", "json"));
$("#items-body").addEventListener("change", updateRecord);
$("#slots-body").addEventListener("change", updateRecord);
document.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete]");
  if (!deleteButton) return;
  data[deleteButton.dataset.delete].splice(Number(deleteButton.dataset.row), 1);
  saveData();
  renderAll();
});
$("#rules-input").addEventListener("change", () => {
  try { syncRules(); setMessage("Rules updated."); } catch (error) { setMessage(error.message, true); }
});
$("#clear-rules-button").addEventListener("click", () => {
  $("#rules-input").value = "";
  data.rules = [];
  saveData();
  renderCounts();
});
$("#generate-button").addEventListener("click", generate);
$("#copy-button").addEventListener("click", async () => {
  await navigator.clipboard.writeText(latestCsv);
  setMessage("CSV copied to your clipboard.");
});
$("#download-button").addEventListener("click", downloadCsv);

for (const type of ["items", "slots"]) {
  $(`#export-${type}-button`).addEventListener("click", () => {
    const csv = exportCsv(data[type]);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `${type}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
}

restoreData();
renderAll();
setTab(window.location.hash.slice(1) || "items");
