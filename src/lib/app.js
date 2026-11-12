import { generateRoster } from "./generator.js";
import { exportCsv } from "./export.js";
import { parseCsv } from "./import.js";

const initialData = window.__RAPID_ROSTER_SAMPLE__;
const data = { items: [], slots: [], rules: [] };
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

function generate() {
  try {
    syncRules();
    if (!data.items.length || !data.slots.length) {
      throw new Error("Add items and slots before generating.");
    }
    $("#generate-button").disabled = true;
    $("#generate-button").textContent = "Generating…";
    $("#generation-message").textContent = "Finding a compatible roster…";
    const result = generateRoster({
      ...data,
      maxSoftRounds: 20,
      onProgress: (progress) => {
        $("#generation-message").textContent = `Optimizing ${progress.ruleId ?? "rules"}…`;
      },
    });
    renderResults(result);
    $("#generation-message").textContent = "Roster generated successfully.";
    setMessage("Roster generated successfully.");
  } catch (error) {
    $("#generation-message").textContent = error.message;
    setMessage(error.message, true);
  } finally {
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
  renderAll();
});
$("#rules-input").addEventListener("change", () => {
  try { syncRules(); setMessage("Rules updated."); } catch (error) { setMessage(error.message, true); }
});
$("#clear-rules-button").addEventListener("click", () => {
  $("#rules-input").value = "";
  data.rules = [];
  renderCounts();
});
$("#sample-button").addEventListener("click", () => {
  data.items = structuredClone(initialData.items);
  data.slots = structuredClone(initialData.slots);
  data.rules = structuredClone(initialData.rules);
  $("#rules-input").value = JSON.stringify(data.rules, null, 2);
  renderAll();
  setMessage("Sample project loaded.");
});
$("#reset-button").addEventListener("click", () => {
  data.items = [];
  data.slots = [];
  data.rules = [];
  $("#rules-input").value = "";
  $("#result-empty").hidden = false;
  $("#result-content").hidden = true;
  renderAll();
  setMessage("Project reset.");
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

renderAll();
setTab(window.location.hash.slice(1) || "items");
