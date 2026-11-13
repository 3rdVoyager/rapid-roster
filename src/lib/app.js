import { exportCsv } from "./export.js";
import { parseCsv, parseRulesCsv } from "./import.js";
import { evaluateModel } from "./evaluation.js";
import { createModel } from "./model.js";

const data = { items: [], slots: [], rules: [] };
const STORAGE_KEY = "rapid-roster-project";
let latestCsv = "";
let evaluationState;
let generatedResult;

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
  } catch (error) {
    setMessage(`Could not restore saved project: ${error.message}`, true);
  }
}

function setTab(tab) {
  if (!["items", "slots", "rules", "evaluation", "generate"].includes(tab)) return;
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
      ${headers.map((header) => `<td>${escapeHtml(formatValue(record[header]))}</td>`).join("")}
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

function parseTargets(value) {
  const trimmed = value.trim();
  return !trimmed || trimmed.toLowerCase() === "all"
    ? "all"
    : trimmed.split(",").map((target) => target.trim()).filter(Boolean);
}

function humanize(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeNumericRuleAttributes(items, rules) {
  const numericAttributes = new Set(
    rules
      .filter((rule) => ["balance", "distribute"].includes(rule.keyword))
      .map((rule) => rule.inputs?.[0])
      .filter(Boolean),
  );
  if (numericAttributes.size === 0) return items;

  return items.map((item) => {
    const normalized = { ...item };
    for (const attribute of numericAttributes) {
      const value = normalized[attribute];
      if (
        typeof value === "string" &&
        value.trim() !== "" &&
        Number.isFinite(Number(value))
      ) {
        normalized[attribute] = Number(value);
      }
    }
    return normalized;
  });
}

function ruleKeywordMarkup(rule, index) {
  const options = ["match", "group", "limit", "balance", "distribute", "align"];
  return `<select class="sentence-control sentence-action" data-rule-index="${index}" data-rule-setting="keyword" aria-label="Rule action">${options.map((keyword) =>
    `<option value="${keyword}" ${rule.keyword === keyword ? "selected" : ""}>${keyword}</option>`).join("")}</select>`;
}

function ruleInputMarkup(index, inputIndex, value, label, type = "text") {
  return `<input class="sentence-control" data-rule-index="${index}" data-rule-input="${inputIndex}" type="${type}" value="${escapeHtml(value)}" aria-label="${label}" placeholder="${label}" />`;
}

function ruleTargetMarkup(index, inputIndex, value) {
  const text = value === "all" ? "all" : Array.isArray(value) ? value.join(", ") : value;
  return ruleInputMarkup(index, inputIndex, text, "all or slot IDs");
}

function ruleSentenceMarkup(rule, index) {
  const [first = "", second = "", third = ""] = rule.inputs;
  const action = ruleKeywordMarkup(rule, index);
  switch (rule.keyword) {
    case "match":
      return `${action} each item's ${ruleInputMarkup(index, 0, first, "item attribute")} to its assigned slot's ${ruleInputMarkup(index, 1, second, "slot attribute")}.`;
    case "group":
      return `${action} each item by matching its ${ruleInputMarkup(index, 0, first, "item attribute")} with related items' ${ruleInputMarkup(index, 1, second, "related item attribute")}.`;
    case "limit":
      return `${action} ${ruleTargetMarkup(index, 2, third)} to <select class="sentence-control" data-rule-index="${index}" data-rule-input="0" aria-label="Limit type"><option value="min" ${first === "min" ? "selected" : ""}>at least</option><option value="max" ${first === "max" ? "selected" : ""}>at most</option></select> ${ruleInputMarkup(index, 1, second, "item count", "number")} assigned items.`;
    case "balance":
      return `${action} the average item ${ruleInputMarkup(index, 0, first, "numeric item attribute")} across ${ruleTargetMarkup(index, 1, second)}.`;
    case "distribute":
      return `${action} item ${ruleInputMarkup(index, 0, first, "numeric item attribute")} values evenly across ${ruleTargetMarkup(index, 1, second)}.`;
    case "align":
      return `${action} each item's assigned slot's ${ruleInputMarkup(index, 0, first, "assigned slot attribute")} with its ${ruleInputMarkup(index, 1, second, "sibling attribute")}.`;
    default:
      return "Unsupported rule form.";
  }
}

function renderRules() {
  $("#rules-count").textContent = `${data.rules.length} rules`;
  $("#rule-list").innerHTML = data.rules.length
    ? data.rules.map((rule, index) => `
      <li class="rule-list-item">
        <div class="rule-list-copy">
          <div class="rule-list-sentence">${ruleSentenceMarkup(rule, index)}</div>
          <div class="rule-list-meta">
            <label>Enforcement <select data-rule-index="${index}" data-rule-setting="enforcement"><option value="hard" ${rule.enforcement === "hard" ? "selected" : ""}>Hard</option><option value="soft" ${rule.enforcement === "soft" ? "selected" : ""}>Soft</option></select></label>
            <label class="${rule.enforcement === "soft" ? "" : "is-hidden"}">Priority <input data-rule-index="${index}" data-rule-setting="priority" type="number" min="1" max="100" value="${rule.priority ?? 10}" /></label>
            <label>Name <input data-rule-index="${index}" data-rule-setting="name" value="${escapeHtml(rule.name ?? "")}" placeholder="optional" /></label>
          </div>
        </div>
        <button class="text-button danger-text" data-delete-rule="${index}" type="button">Delete</button>
      </li>`).join("")
    : '<li class="empty-hint">No rules yet. Import a JSON rule set or add a rule.</li>';
}

function updateInlineRule(event) {
  const control = event.target.closest("[data-rule-index]");
  if (!control) return;
  const index = Number(control.dataset.ruleIndex);
  const rule = data.rules[index];
  if (!rule) return;

  if (control.dataset.ruleSetting === "keyword") {
    rule.keyword = control.value;
    rule.inputs = {
      match: ["", ""],
      group: ["", ""],
      limit: ["min", 1, "all"],
      balance: ["", "all"],
      distribute: ["", "all"],
      align: ["", ""],
    }[rule.keyword];
  } else if (control.dataset.ruleSetting === "enforcement") {
    rule.enforcement = control.value;
    if (rule.enforcement === "soft") rule.priority ??= 10;
    else delete rule.priority;
  } else if (control.dataset.ruleSetting === "priority") {
    rule.priority = Number(control.value);
  } else if (control.dataset.ruleSetting === "name") {
    rule.name = control.value;
  } else {
    const inputIndex = Number(control.dataset.ruleInput);
    const isTarget =
      (rule.keyword === "limit" && inputIndex === 2) ||
      ((rule.keyword === "balance" || rule.keyword === "distribute") &&
        inputIndex === 1);
    rule.inputs[inputIndex] = isTarget
      ? parseTargets(control.value)
      : rule.keyword === "limit" && inputIndex === 0
        ? control.value
      : rule.keyword === "limit" && inputIndex === 1
        ? Number(control.value)
        : control.value;
  }

  saveData();
  renderAll();
}

function renderAll() {
  renderTable("items");
  renderTable("slots");
  renderCounts();
  renderRules();
}

async function importFile(event, type, format) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const value =
      type === "rules"
        ? parseRulesCsv(text)
        : format === "csv"
          ? parseCsv(text)
          : JSON.parse(text);
    if (!Array.isArray(value)) throw new Error("Imported JSON must be an array.");
    data[type] = value;
    saveData();
    renderAll();
    setMessage(`${file.name} imported.`);
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    event.target.value = "";
  }
}

function downloadCsv() {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([latestCsv], { type: "text/csv" }));
  link.download = "rapid-roster.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function renderSelectedResult() {
  const result = generatedResult;
  if (!result) return;
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
    <div><span>Hard penalty</span><strong>${evaluation.hardPenalty.toFixed(2)}</strong></div>
    <div><span>Soft penalty</span><strong>${evaluation.softPenalty.toFixed(2)}</strong></div>`;
  latestCsv = exportCsv(Object.entries(result.assignments).flatMap(([slot, itemIds]) =>
    itemIds.map((itemId) => ({ slot, itemId, participant: names.get(itemId) ?? itemId }))));
  $("#csv-output").textContent = latestCsv;
  $("#result-empty").hidden = true;
  $("#result-content").hidden = false;
  $("#copy-button").disabled = false;
  $("#download-button").disabled = false;
}

function renderResult(result) {
  generatedResult = {
    ...result,
    evaluation: evaluateModel(createModel(
      normalizeNumericRuleAttributes(data.items, data.rules),
      data.slots,
      data.rules,
      result.assignments,
    )),
  };
  renderSelectedResult();
}

function assignmentRecordsToMap(records) {
  const assignments = {};
  for (const record of records) {
    const slotId = record.slot ?? record.slotId;
    const itemId = record.itemId ?? record.item;
    if (slotId === undefined || itemId === undefined || itemId === "") {
      throw new Error("Assignment CSV must include slot and itemId columns.");
    }
    (assignments[slotId] ??= []).push(itemId);
  }
  return assignments;
}

function formatConflictDetails(conflict) {
  return Object.entries(conflict)
    .filter(([key]) => key !== "ruleId")
    .map(([key, value]) => `${humanize(key)}: ${typeof value === "object" ? JSON.stringify(value) : value}`)
    .join(" · ");
}

function describeConflict(rule, conflict, model) {
  const itemById = new Map(model.items.map((item) => [String(item.id), item]));
  const slotById = new Map(model.slots.map((slot) => [String(slot.id), slot]));
  const itemLabel = (id) => itemById.get(String(id))?.name ?? id;
  const slotLabel = (id) => slotById.get(String(id))?.name ?? id;
  const [first, second] = rule.inputs;

  switch (rule.keyword) {
    case "match":
      return `Item ${itemLabel(conflict.sourceId)} has ${humanize(first)} "${conflict.sourceValue}", but slot ${slotLabel(conflict.targetId)} has ${humanize(second)} "${conflict.targetValue}".`;
    case "group": {
      const sourceItem = itemById.get(String(conflict.sourceId));
      const assignedSlots = model.assignments.itemAssignments[conflict.sourceId] ?? [];
      const coAssignedIds = [...new Set(assignedSlots.flatMap((slotId) =>
        model.assignments.slotAssignments[slotId] ?? []).filter((id) => String(id) !== String(conflict.sourceId)))];
      const coAssignedValues = coAssignedIds.map((id) => itemById.get(String(id))?.[first]).filter(Boolean);
      return `Item ${itemLabel(conflict.sourceId)} requested ${humanize(second)} "${formatValue(sourceItem?.[second])}", but their assigned slot contains ${coAssignedValues.length ? `${humanize(first)} values "${formatValue(coAssignedValues)}"` : "none of the requested teammates"}.`;
    }
    case "limit":
      return `Slot ${slotLabel(conflict.sourceId)} has ${conflict.actual} assigned items; the rule requires ${conflict.type === "min" ? "at least" : "at most"} ${conflict.limit}.`;
    case "balance":
      return `Slot ${slotLabel(conflict.targetId)} has an average ${humanize(first)} of ${Number(conflict.actual).toFixed(2)}, compared with the overall target of ${Number(conflict.target).toFixed(2)}.`;
    case "distribute":
      return `Items with ${humanize(first)} values ${conflict.sourceValue} and ${conflict.targetValue} share slot(s): ${formatValue(conflict.sharedSlotIds)}.`;
    case "align":
      return `Sibling slots ${slotLabel(conflict.sourceId)} and ${slotLabel(conflict.targetId)} do not match on ${humanize(first)}: "${conflict.sourceValue}" versus "${conflict.targetValue}".`;
    default:
      return formatConflictDetails(conflict);
  }
}

function renderEvaluation(evaluation, model) {
  evaluationState = { evaluation, model };
  renderEvaluationConflicts();
  $("#evaluation-metrics").innerHTML = `
    <div><span>Hard conflicts</span><strong>${evaluation.hardViolations.length}</strong></div>
    <div><span>Soft conflicts</span><strong>${evaluation.softViolations.length}</strong></div>
    <div><span>Hard penalty</span><strong>${evaluation.hardPenalty.toFixed(2)}</strong></div>
    <div><span>Soft penalty</span><strong>${evaluation.softPenalty.toFixed(2)}</strong></div>`;
  $("#evaluation-empty").hidden = true;
  $("#evaluation-content").hidden = false;
}

function renderEvaluationConflicts() {
  if (!evaluationState) return;
  const { evaluation, model } = evaluationState;
  const conflicts = [
    ...evaluation.hardViolations.map((conflict) => ({ severity: "Hard", ...conflict })),
    ...evaluation.softViolations.map((conflict) => ({ severity: "Soft", ...conflict })),
  ];
  const rulesById = new Map(data.rules.map((rule) => [rule.id, rule]));
  const ruleFilter = $("#evaluation-rule-filter").value;
  const severityFilter = $("#evaluation-severity-filter").value;
  const minimumDifference = Number($("#evaluation-difference-filter").value) || 0;
  const filteredConflicts = conflicts.filter((conflict) => {
    const rule = rulesById.get(conflict.ruleId);
    return (
      (ruleFilter === "all" || rule?.keyword === ruleFilter) &&
      (severityFilter === "all" || conflict.severity.toLowerCase() === severityFilter) &&
      (minimumDifference === 0 ||
        (conflict.difference !== undefined &&
          Number(conflict.difference) >= minimumDifference))
    );
  });
  $("#evaluation-conflict-count").textContent =
    `${filteredConflicts.length} of ${conflicts.length} conflicts`;
  $("#evaluation-conflicts").innerHTML = filteredConflicts.length
    ? filteredConflicts.map((conflict) => `
      <li class="conflict-item">
        <div class="conflict-heading">
          <span class="conflict-severity ${conflict.severity.toLowerCase()}">${conflict.severity}</span>
          <span class="conflict-rule">${escapeHtml(rulesById.get(conflict.ruleId)?.keyword ?? "rule")}</span>
          <strong>${escapeHtml(rulesById.get(conflict.ruleId)?.name || conflict.ruleId)}</strong>
        </div>
        <p>${escapeHtml(describeConflict(rulesById.get(conflict.ruleId) ?? { keyword: "" }, conflict, model))}</p>
      </li>`).join("")
    : '<li class="empty-hint">No conflicts match the current filters.</li>';
}

async function importAssignments(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const records = parseCsv(await file.text());
    const assignments = assignmentRecordsToMap(records);
    const model = createModel(
      normalizeNumericRuleAttributes(data.items, data.rules),
      data.slots,
      data.rules,
      assignments,
    );
    renderEvaluation(evaluateModel(model), model);
    setMessage(`${file.name} evaluated.`);
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    event.target.value = "";
  }
}

async function generate() {
  let workers = [];
  let progressTimer;
  try {
    if (!data.items.length || !data.slots.length) {
      throw new Error("Add items and slots before generating.");
    }
    const limitMode = $("#generation-limit-mode").value;
    const limitValue = Number($("#generation-limit-value").value);
    const hardOnly = $("#generation-hard-only").checked;
    const limitMilliseconds = limitValue * 1000;
    if (
      !hardOnly &&
      (!Number.isFinite(limitValue) ||
        limitValue < 1 ||
        (limitMode === "time" && !Number.isSafeInteger(limitMilliseconds)) ||
        (limitMode === "rounds" && !Number.isInteger(limitValue))
      )
    ) {
      throw new Error(
        limitMode === "rounds"
          ? "Maximum rounds must be a positive whole number."
          : "Maximum time must be a positive number of seconds.",
      );
    }
    $("#generate-button").disabled = true;
    $("#generate-button").textContent = "Generating…";
    $("#generation-message").textContent = "Finding a compatible roster…";
    const progress = $(".generation-progress");
    const progressBar = $("#generation-progress-bar");
    progress.classList.remove("is-indeterminate");
    progress.setAttribute("aria-valuenow", "0");
    progressBar.style.width = "0%";
    $("#generation-progress-round").textContent = "Starting generation…";
    $("#generation-progress-elapsed").textContent = "";
    if (limitMode === "time" && !hardOnly) {
      const startedAt = performance.now();
      progressTimer = setInterval(() => {
        const percent = Math.min(
          95,
          ((performance.now() - startedAt) / limitMilliseconds) * 100,
        );
        progress.setAttribute("aria-valuenow", String(Math.round(percent)));
        progressBar.style.width = `${percent}%`;
        $("#generation-progress-elapsed").textContent =
          `Elapsed ${Math.round((performance.now() - startedAt) / 1000)} s`;
      }, 100);
    }
    const workerPayload = {
      ...data,
      hardOnly,
      items: normalizeNumericRuleAttributes(data.items, data.rules),
      ...(limitMode === "rounds"
        ? { maxSoftRounds: limitValue }
        : { maxSoftTimeMs: limitMilliseconds }),
    };
    const runWorker = () => new Promise((resolve, reject) => {
        const worker = new Worker(new URL("./generation-worker.js", import.meta.url), {
          type: "module",
        });
        workers.push(worker);
        worker.addEventListener("message", ({ data: message }) => {
          if (message.type === "progress") {
            const percent = limitMode === "rounds"
              ? Math.min(100, (message.progress.round / limitValue) * 100)
              : null;
            if (percent !== null) {
              progress.setAttribute("aria-valuenow", String(Math.round(percent)));
              progressBar.style.width = `${percent}%`;
            }
            $("#generation-progress-round").textContent =
              `Soft round ${message.progress.round}`;
            $("#generation-message").textContent =
              `Penalty ${message.progress.softPenalty.toFixed(4)}; ` +
              `improvement ${message.progress.improvement.toFixed(4)}`;
          } else if (message.type === "complete") {
            resolve(message.result);
          } else if (message.type === "error") {
            reject(new Error(message.message));
          }
        });
        worker.addEventListener("error", (error) => {
          reject(new Error(error.message || "Roster generation worker failed."));
        });
        worker.postMessage(workerPayload);
      });
    const result = await runWorker();
    renderResult(result);
    clearInterval(progressTimer);
    $(".generation-progress").classList.remove("is-indeterminate");
    $(".generation-progress").setAttribute("aria-valuenow", "100");
    $("#generation-progress-bar").style.width = "100%";
    $("#generation-progress-round").textContent = "Generation complete";
    $("#generation-progress-elapsed").textContent = "";
    $("#generation-message").textContent =
      `Roster generated. Soft penalty: ${generatedResult.evaluation.softPenalty.toFixed(6)}. ` +
      `${hardOnly ? "Hard rules only." : limitMode === "rounds" ? `Limit: ${limitValue} rounds per solution.` : `Limit: ${limitValue} seconds per solution.`}`;
    setMessage("Roster generated successfully.");
  } catch (error) {
    clearInterval(progressTimer);
    $(".generation-progress").classList.remove("is-indeterminate");
    $("#generation-progress-round").textContent = "Generation stopped";
    $("#generation-progress-elapsed").textContent = "";
    $("#generation-message").textContent = error.message;
    setMessage(error.message, true);
  } finally {
    workers?.forEach((activeWorker) => activeWorker.terminate());
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
$("#rules-file").addEventListener("change", (event) => importFile(event, "rules", "csv"));
$("#assignments-file").addEventListener("change", importAssignments);
$("#evaluation-rule-filter").addEventListener("change", renderEvaluationConflicts);
$("#evaluation-severity-filter").addEventListener("change", renderEvaluationConflicts);
$("#evaluation-difference-filter").addEventListener("input", renderEvaluationConflicts);
$("#rule-list").addEventListener("change", updateInlineRule);
document.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete]");
  if (deleteButton) {
    data[deleteButton.dataset.delete].splice(Number(deleteButton.dataset.row), 1);
    saveData();
    renderAll();
    return;
  }
  const deleteRuleButton = event.target.closest("[data-delete-rule]");
  if (deleteRuleButton) {
    data.rules.splice(Number(deleteRuleButton.dataset.deleteRule), 1);
    saveData();
    renderAll();
  }
});
$("#new-rule-button").addEventListener("click", () => {
  const nextId = data.rules.length
    ? Math.max(...data.rules.map((rule) => Number(String(rule.id).replace(/\D/g, "")) || 0)) + 1
    : 1;
  data.rules.push({
    id: `R${nextId}`,
    name: "",
    enforcement: "hard",
    keyword: "match",
    inputs: ["", ""],
  });
  saveData();
  renderAll();
});
$("#generation-limit-mode").addEventListener("change", (event) => {
  const isRounds = event.target.value === "rounds";
  $("#generation-limit-value-label").textContent = isRounds
    ? "Maximum rounds"
    : "Maximum time (seconds)";
  $("#generation-limit-value").step = isRounds ? "1" : "any";
  $("#generation-limit-value").value = isRounds ? "20" : "300";
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
