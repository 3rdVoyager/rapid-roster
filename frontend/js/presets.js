/**
 * presets.js
 *
 * Starter packs that fill a project: entries + slots + rules + setup.
 * CSV files live under /presets/<id>/ and can also be downloaded as templates.
 *
 * Applying a preset REPLACES those parts of the project (not a merge).
 */

import { parseCsvText, csvToTable } from "/js/csv.js";
import { createEmptyProject } from "/js/state.js";

/**
 * Catalog shown in the New project / Load preset UI.
 * templateBase is the folder under /presets/ (same files used to load data).
 */
export const PRESET_CATALOG = [
  {
    id: "blank",
    name: "Blank project",
    summary: "Empty tables. Download templates, then import your own CSVs.",
    defaultSlotsPerEntry: 1,
    loadsSampleData: false
  },
  {
    id: "sports",
    name: "Sports teams",
    summary:
      "Players into teams. Balance skill, cluster availability & requests, limit keepers/coaches.",
    defaultSlotsPerEntry: 1,
    loadsSampleData: true
  },
  {
    id: "science-olympiad",
    name: "Science Olympiad",
    summary:
      "Students into events with ranked preference columns. Conflict groups by time block.",
    defaultSlotsPerEntry: 2,
    loadsSampleData: true
  },
  {
    id: "volunteers",
    name: "Volunteers",
    summary:
      "Volunteers into shifts. Cluster strengths ↔ needs and availability ↔ time.",
    defaultSlotsPerEntry: 1,
    loadsSampleData: true
  }
];

/**
 * @param {string} presetId
 * @returns {Object|null}
 */
export function getPresetInfo(presetId) {
  for (let i = 0; i < PRESET_CATALOG.length; i = i + 1) {
    if (PRESET_CATALOG[i].id === presetId) {
      return PRESET_CATALOG[i];
    }
  }

  return null;
}

/**
 * Paths to the three template CSVs for a preset (or blank).
 *
 * @param {string} presetId
 * @returns {{ entries: string, slots: string, rules: string }}
 */
export function getPresetTemplateUrls(presetId) {
  let id = presetId;

  if (getPresetInfo(id) === null) {
    id = "blank";
  }

  const base = "/presets/" + id + "/";

  return {
    entries: base + "entries.csv",
    slots: base + "slots.csv",
    rules: base + "rules.csv"
  };
}

/**
 * Build a full project from a preset pack.
 *
 * @param {string} presetId
 * @param {string} projectName
 * @returns {Promise<Object>}
 */
export async function buildProjectFromPreset(presetId, projectName) {
  const info = getPresetInfo(presetId);

  if (info === null || presetId === "blank") {
    const blank = createEmptyProject(projectName);
    blank.presetId = "blank";
    return blank;
  }

  const urls = getPresetTemplateUrls(presetId);
  const entriesText = await fetchText(urls.entries);
  const slotsText = await fetchText(urls.slots);
  const rulesText = await fetchText(urls.rules);

  const entriesParsed = parseCsvText(entriesText);
  const slotsParsed = parseCsvText(slotsText);

  if (entriesParsed === null || slotsParsed === null) {
    throw new Error("Preset CSV files were empty or missing.");
  }

  const entriesTable = csvToTable(entriesParsed, "entries");
  const slotsTable = csvToTable(slotsParsed, "slots");
  const rules = parseRulesCsv(rulesText);
  const conflictGroups = buildConflictGroupsFromSlots(slotsTable);

  const project = createEmptyProject(projectName);
  project.presetId = presetId;
  project.entries = entriesTable;
  project.slots = slotsTable;
  project.rules = rules;
  project.setup.defaultSlotsPerEntry = info.defaultSlotsPerEntry;
  project.setup.conflictGroups = conflictGroups;
  project.results = null;

  return project;
}

/**
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchText(url) {
  const response = await fetch(url);

  if (response.ok === false) {
    throw new Error("Could not load " + url);
  }

  return await response.text();
}

/**
 * If slots have a conflict_group column, group slot ids that share a value.
 *
 * @param {{ columns: Object[], rows: Object[] }} slotsTable
 * @returns {string[][]}
 */
function buildConflictGroupsFromSlots(slotsTable) {
  let groupKey = null;

  for (let i = 0; i < slotsTable.columns.length; i = i + 1) {
    const key = slotsTable.columns[i].key;
    if (key.toLowerCase() === "conflict_group") {
      groupKey = key;
    }
  }

  if (groupKey === null) {
    return [];
  }

  // Map: group name → list of slot ids
  const buckets = {};

  for (let r = 0; r < slotsTable.rows.length; r = r + 1) {
    const row = slotsTable.rows[r];
    const groupName = String(row.cells[groupKey] || "").trim();

    if (groupName === "") {
      continue;
    }

    if (buckets[groupName] === undefined) {
      buckets[groupName] = [];
    }

    buckets[groupName].push(row.id);
  }

  const groups = [];
  const names = Object.keys(buckets);

  for (let i = 0; i < names.length; i = i + 1) {
    const slotIds = buckets[names[i]];
    if (slotIds.length >= 2) {
      groups.push(slotIds);
    }
  }

  return groups;
}

/**
 * Turn rules.csv text into project.rules objects the generator understands.
 *
 * Expected columns: id, name, type, data, filter, options, priority, hard
 * data examples:
 *   entries.skill
 *   entries.availability ↔ slots.practice_night
 *   preferences.1 ↔ slots.name  (treated as entry column "1")
 *
 * @param {string} text
 * @returns {Object[]}
 */
export function parseRulesCsv(text) {
  const parsed = parseCsvText(text);
  const rules = [];

  if (parsed === null) {
    return rules;
  }

  for (let i = 0; i < parsed.dataRows.length; i = i + 1) {
    const cells = rowToObject(parsed.headers, parsed.dataRows[i]);
    const rule = ruleFromCsvCells(cells);

    if (rule !== null) {
      rules.push(rule);
    }
  }

  return rules;
}

/**
 * @param {string[]} headers
 * @param {string[]} values
 * @returns {Object}
 */
function rowToObject(headers, values) {
  const obj = {};

  for (let i = 0; i < headers.length; i = i + 1) {
    let value = "";
    if (i < values.length) {
      value = values[i];
    }
    obj[headers[i].toLowerCase()] = value;
  }

  return obj;
}

/**
 * @param {Object} cells - lowercased header keys
 * @returns {Object|null}
 */
function ruleFromCsvCells(cells) {
  const typeRaw = String(cells.type || "").trim().toLowerCase();
  let type = typeRaw;

  if (type === "balance") {
    type = "balance";
  } else if (type === "cluster") {
    type = "cluster";
  } else if (type === "separate") {
    type = "separate";
  } else if (type === "limit") {
    type = "limit";
  } else if (type === "") {
    return null;
  } else {
    return null;
  }

  const hardRaw = String(cells.hard || "no").trim().toLowerCase();
  const hard = hardRaw === "yes" || hardRaw === "true" || hardRaw === "1";

  let priority = Number(cells.priority);
  if (Number.isNaN(priority) === true) {
    priority = 5;
  }

  const rule = {
    id: cells.id || "R" + Date.now(),
    name: cells.name || "Untitled rule",
    type: type,
    hard: hard,
    priority: priority
  };

  const data = String(cells.data || "").trim();
  const filter = String(cells.filter || "").trim();
  const options = String(cells.options || "").trim();

  applyDataField(rule, data);
  applyLimitOptions(rule, filter, options);

  return rule;
}

/**
 * Fill entryAttribute / slotAttribute / shape from the data column.
 *
 * @param {Object} rule
 * @param {string} data
 */
function applyDataField(rule, data) {
  if (data === "") {
    return;
  }

  // "left ↔ right" form
  if (data.indexOf("↔") !== -1) {
    const parts = data.split("↔");
    const left = cleanAttrPath(parts[0]);
    const right = cleanAttrPath(parts[1]);

    if (rule.type === "cluster" || rule.type === "separate") {
      if (right.table === "slots") {
        rule.shape = "entryMatchesSlot";
        rule.entryAttribute = left.attribute;
        rule.slotAttribute = right.attribute;
        rule.match = "exact";
      } else {
        // entries.X ↔ entries.Y — treat as "same value together" on left attr for now
        rule.shape = "entriesTogether";
        rule.entryAttribute = left.attribute;
        rule.match = "exact";
      }
    }

    return;
  }

  // Single path: entries.skill
  const single = cleanAttrPath(data);
  rule.entryAttribute = single.attribute;

  if (rule.type === "cluster" || rule.type === "separate") {
    rule.shape = "entriesTogether";
    rule.match = "exact";
  }
}

/**
 * @param {string} pathText - e.g. "entries.skill" or "preferences.1" or "1"
 * @returns {{ table: string, attribute: string }}
 */
function cleanAttrPath(pathText) {
  const cleaned = String(pathText || "").trim();
  const dot = cleaned.indexOf(".");

  if (dot === -1) {
    return {
      table: "entries",
      attribute: cleaned
    };
  }

  const table = cleaned.slice(0, dot).trim().toLowerCase();
  const attribute = cleaned.slice(dot + 1).trim();

  // preferences.N means entry column N (SciOly rank columns)
  if (table === "preferences") {
    return {
      table: "entries",
      attribute: attribute
    };
  }

  return {
    table: table,
    attribute: attribute
  };
}

/**
 * Limit rules: filter cell + options like max=2 or min=1.
 *
 * @param {Object} rule
 * @param {string} filter
 * @param {string} options
 */
function applyLimitOptions(rule, filter, options) {
  if (rule.type !== "limit") {
    // Still allow match mode on cluster/separate from options: exact / partial
    if (options === "partial" || options === "exact") {
      rule.match = options;
    }
    return;
  }

  if (filter !== "") {
    rule.filterValue = filter;
  }

  const bits = options.split(";");

  for (let i = 0; i < bits.length; i = i + 1) {
    const bit = bits[i].trim();
    if (bit.indexOf("max=") === 0) {
      rule.maxCount = Number(bit.slice(4));
    }
    if (bit.indexOf("min=") === 0) {
      rule.minCount = Number(bit.slice(4));
    }
  }
}

/**
 * Trigger a browser file download from a URL (template CSV).
 *
 * @param {string} url
 * @param {string} filename
 */
export function downloadTemplateFile(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
