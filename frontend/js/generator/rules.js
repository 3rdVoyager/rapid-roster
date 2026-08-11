/**
 * rules.js
 *
 * Rule validation, selector resolution, and scoring for RapidRoster.
 * Implements the JSON rule schema (validate → select → score).
 * Used by the generator before and during placement search.
 */

const ALLOWED_ACTIONS = [
  "cluster",
  "separate",
  "assign",
  "avoid",
  "limit",
  "match",
  "balance",
];

/**
 * @typedef {Object} RosterData
 * @property {Record<string, string>[]} [entries]
 * @property {Record<string, string>[]} [slots]
 */

/**
 * @typedef {Object} Selector
 * @property {string} source
 * @property {string|string[]|Selector} [match]
 */

/**
 * @typedef {Object} Rule
 * @property {string} label
 * @property {number|string} priority
 * @property {string} action
 * @property {Record<string, unknown>} config
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} ok
 * @property {string[]} errors
 * @property {string[]} warnings
 */

/**
 * @typedef {Object} ScoreResult
 * @property {boolean} ok
 * @property {boolean} hard
 * @property {number} satisfied
 * @property {number} points
 * @property {string} details
 */

/**
 * Parse "entries.role" into table name and optional column.
 */
function parseSourcePath(sourcePath) {
  if (typeof sourcePath !== "string" || sourcePath.trim() === "") {
    return { table: "", column: "" };
  }

  const parts = sourcePath.split(".");
  const table = parts[0].trim().toLowerCase();
  const column = parts.length > 1 ? parts.slice(1).join(".").trim() : "";

  return { table, column };
}

function getTableRows(roster, table) {
  if (table === "entries") {
    return roster.entries === undefined ? [] : roster.entries;
  }

  if (table === "slots") {
    return roster.slots === undefined ? [] : roster.slots;
  }

  return [];
}

function normalizeMatchValues(match) {
  if (match === undefined || match === null || match === "") {
    return [];
  }

  if (Array.isArray(match) === true) {
    return match.map(function (value) {
      return String(value).trim();
    });
  }

  return [String(match).trim()];
}

function rowValueMatches(row, column, matchValues) {
  if (matchValues.length === 0) {
    return true;
  }

  if (column === "") {
    const haystack = JSON.stringify(row).toLowerCase();
    for (const matchValue of matchValues) {
      if (haystack.includes(matchValue.toLowerCase()) === true) {
        return true;
      }
    }
    return false;
  }

  const cell = row[column];
  if (cell === undefined || cell === null) {
    return false;
  }

  const cellText = String(cell).trim().toLowerCase();
  for (const matchValue of matchValues) {
    if (cellText === matchValue.toLowerCase()) {
      return true;
    }
  }

  return false;
}

/**
 * Resolve a selector against roster tables.
 *
 * @param {RosterData} roster
 * @param {Selector} selector
 * @returns {Record<string, string>[]}
 */
export function selectBySelector(roster, selector) {
  if (selector === undefined || selector === null) {
    return [];
  }

  const sourcePath = selector.source === undefined ? "" : selector.source;
  const { table, column } = parseSourcePath(sourcePath);
  const rows = getTableRows(roster, table);

  if (rows.length === 0) {
    return [];
  }

  const matchValues = normalizeMatchValues(selector.match);
  const matched = [];

  for (const row of rows) {
    if (rowValueMatches(row, column, matchValues) === true) {
      matched.push(row);
    }
  }

  return matched;
}

function isHardPriority(priority) {
  return String(priority).toLowerCase() === "hard";
}

function priorityWeight(priority) {
  if (isHardPriority(priority) === true) {
    return 10;
  }

  const numeric = Number(priority);
  if (Number.isFinite(numeric) === false || numeric < 1) {
    return 1;
  }

  if (numeric > 10) {
    return 10;
  }

  return numeric;
}

function selectorFromConfig(value) {
  if (value === undefined || value === null) {
    return { source: "", match: "" };
  }

  if (typeof value === "object") {
    return {
      source: value.source === undefined ? "" : String(value.source),
      match: value.match === undefined ? "" : value.match,
    };
  }

  return { source: "", match: "" };
}

/**
 * Validate one rule against the JSON schema and optional roster data.
 *
 * @param {Rule} rule
 * @param {RosterData} [roster]
 * @returns {ValidationResult}
 */
export function validateRule(rule, roster) {
  const errors = [];
  const warnings = [];

  if (rule === undefined || rule === null || typeof rule !== "object") {
    return { ok: false, errors: ["Rule must be an object."], warnings };
  }

  if (typeof rule.label !== "string" || rule.label.trim() === "") {
    errors.push("Rule label is required.");
  }

  if (rule.priority === undefined || rule.priority === null || rule.priority === "") {
    errors.push("Rule priority is required.");
  } else if (isHardPriority(rule.priority) === false) {
    const numeric = Number(rule.priority);
    if (Number.isFinite(numeric) === false || numeric < 1 || numeric > 10) {
      errors.push("Soft rule priority must be a number from 1 to 10.");
    }
  }

  if (typeof rule.action !== "string" || ALLOWED_ACTIONS.includes(rule.action.toLowerCase()) === false) {
    errors.push("Rule action must be one of: " + ALLOWED_ACTIONS.join(", ") + ".");
  }

  if (rule.config === undefined || rule.config === null || typeof rule.config !== "object") {
    errors.push("Rule config is required.");
    return { ok: errors.length === 0, errors, warnings };
  }

  const action = String(rule.action).toLowerCase();
  const config = rule.config;

  if (action === "limit") {
    const min = Number(config.min);
    const max = Number(config.max);

    if (Number.isFinite(min) === false || Number.isFinite(max) === false) {
      errors.push("Limit rules require numeric min and max.");
    } else if (min > max) {
      errors.push("Limit rule min must be less than or equal to max.");
    }

    if (roster !== undefined) {
      const entryMatches = selectBySelector(roster, selectorFromConfig(config.data));
      if (entryMatches.length === 0) {
        errors.push("Limit rule data selector matched no entries.");
      }
    }
  }

  if (action === "balance") {
    if (typeof config.attribute !== "string" || config.attribute.trim() === "") {
      errors.push("Balance rules require an attribute name.");
    }

    if (roster !== undefined) {
      const entryMatches = selectBySelector(roster, selectorFromConfig(config.data));
      if (entryMatches.length === 0) {
        errors.push("Balance rule data selector matched no entries.");
      }
    }
  }

  if (roster !== undefined && config.data !== undefined) {
    const dataMatches = selectBySelector(roster, selectorFromConfig(config.data));
    if (dataMatches.length === 0 && errors.length === 0) {
      warnings.push("Rule data selector matched no entries.");
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

function entryId(row) {
  if (row.id !== undefined && String(row.id).trim() !== "") {
    return String(row.id);
  }

  if (row.name !== undefined && String(row.name).trim() !== "") {
    return String(row.name);
  }

  return "";
}

function slotId(row) {
  if (row.slot_id !== undefined && String(row.slot_id).trim() !== "") {
    return String(row.slot_id);
  }

  if (row.id !== undefined && String(row.id).trim() !== "") {
    return String(row.id);
  }

  if (row.name !== undefined && String(row.name).trim() !== "") {
    return String(row.name);
  }

  return "";
}

function buildEntryLookup(entries) {
  const lookup = {};

  for (const row of entries) {
    const id = entryId(row);
    if (id !== "") {
      lookup[id] = row;
    }
  }

  return lookup;
}

function getAssignedEntriesForSlot(assignment, slotKey, entryLookup, entryFilter) {
  const assigned = [];

  for (const [assignedEntryId, assignedSlotId] of Object.entries(assignment)) {
    if (assignedSlotId !== slotKey) {
      continue;
    }

    const row = entryLookup[assignedEntryId];
    if (row === undefined) {
      continue;
    }

    if (entryFilter(row) === true) {
      assigned.push(row);
    }
  }

  return assigned;
}

/**
 * Score a Limit rule against one assignment map (entryId -> slotId).
 *
 * @param {Record<string, string>} assignment
 * @param {Rule} rule
 * @param {RosterData} roster
 * @returns {ScoreResult}
 */
export function scoreLimit(assignment, rule, roster) {
  const hard = isHardPriority(rule.priority);
  const weight = priorityWeight(rule.priority);
  const config = rule.config;

  const entrySelector = selectorFromConfig(config.data);
  const slotSelector = selectorFromConfig(config.data2);
  const min = Number(config.min);
  const max = Number(config.max);

  const filteredEntries = selectBySelector(roster, entrySelector);
  const filteredEntryIds = {};

  for (const row of filteredEntries) {
    const id = entryId(row);
    if (id !== "") {
      filteredEntryIds[id] = true;
    }
  }

  function entryFilter(row) {
    const id = entryId(row);
    return filteredEntryIds[id] === true;
  }

  const slots = selectBySelector(roster, slotSelector);
  const entryLookup = buildEntryLookup(roster.entries === undefined ? [] : roster.entries);

  if (slots.length === 0) {
    return {
      ok: hard === false,
      hard,
      satisfied: 0,
      points: 0,
      details: "No slots matched the Limit rule.",
    };
  }

  let satisfiedSlots = 0;

  for (const slot of slots) {
    const currentSlotId = slotId(slot);
    const assigned = getAssignedEntriesForSlot(
      assignment,
      currentSlotId,
      entryLookup,
      entryFilter
    );
    const count = assigned.length;

    if (count >= min && count <= max) {
      satisfiedSlots += 1;
    } else if (hard === true) {
      return {
        ok: false,
        hard,
        satisfied: 0,
        points: 0,
        details:
          "Slot " +
          currentSlotId +
          " has " +
          String(count) +
          " matching entries; allowed " +
          String(min) +
          " to " +
          String(max) +
          ".",
      };
    }
  }

  const satisfied = satisfiedSlots / slots.length;
  const points = hard === true ? weight : satisfied * weight;

  return {
    ok: true,
    hard,
    satisfied,
    points,
    details:
      String(satisfiedSlots) +
      " of " +
      String(slots.length) +
      " slots satisfy the Limit range.",
  };
}

/**
 * Score a Balance rule across slot totals for one numeric attribute.
 *
 * @param {Record<string, string>} assignment
 * @param {Rule} rule
 * @param {RosterData} roster
 * @returns {ScoreResult}
 */
export function scoreBalance(assignment, rule, roster) {
  const hard = isHardPriority(rule.priority);
  const weight = priorityWeight(rule.priority);
  const config = rule.config;
  const attribute = String(config.attribute).trim();

  const entrySelector = selectorFromConfig(config.data);
  const scopedEntries = selectBySelector(roster, entrySelector);
  const scopedIds = {};

  for (const row of scopedEntries) {
    const id = entryId(row);
    if (id !== "") {
      scopedIds[id] = true;
    }
  }

  const slots = roster.slots === undefined ? [] : roster.slots;
  const entryLookup = buildEntryLookup(roster.entries === undefined ? [] : roster.entries);
  const totals = [];

  for (const slot of slots) {
    const currentSlotId = slotId(slot);
    let sum = 0;

    for (const [assignedEntryId, assignedSlotId] of Object.entries(assignment)) {
      if (assignedSlotId !== currentSlotId) {
        continue;
      }

      if (scopedIds[assignedEntryId] !== true) {
        continue;
      }

      const row = entryLookup[assignedEntryId];
      if (row === undefined) {
        continue;
      }

      const value = Number(row[attribute]);
      if (Number.isFinite(value) === true) {
        sum += value;
      }
    }

    totals.push(sum);
  }

  if (totals.length === 0) {
    return {
      ok: hard === false,
      hard,
      satisfied: 0,
      points: 0,
      details: "No slot totals were calculated for Balance.",
    };
  }

  const minTotal = Math.min(...totals);
  const maxTotal = Math.max(...totals);
  const spread = maxTotal - minTotal;

  let satisfied = 1;
  if (maxTotal > 0) {
    satisfied = 1 - spread / maxTotal;
  } else if (spread > 0) {
    satisfied = 0;
  }

  if (satisfied < 0) {
    satisfied = 0;
  }

  const points = satisfied * weight;

  return {
    ok: true,
    hard,
    satisfied,
    points,
    details:
      "Skill totals range from " +
      String(minTotal) +
      " to " +
      String(maxTotal) +
      " (spread " +
      String(spread) +
      ").",
  };
}

/**
 * Score one rule. Dispatches by action type.
 *
 * @param {Record<string, string>} assignment
 * @param {Rule} rule
 * @param {RosterData} roster
 * @returns {ScoreResult}
 */
export function scoreRule(assignment, rule, roster) {
  const action = String(rule.action).toLowerCase();

  if (action === "limit") {
    return scoreLimit(assignment, rule, roster);
  }

  if (action === "balance") {
    return scoreBalance(assignment, rule, roster);
  }

  return {
    ok: true,
    hard: isHardPriority(rule.priority),
    satisfied: 0,
    points: 0,
    details: "Scoring for action '" + action + "' is not implemented yet.",
  };
}

/**
 * Score all rules and compute a total with hard-rule enforcement.
 *
 * @param {Record<string, string>} assignment
 * @param {Rule[]} rules
 * @param {RosterData} roster
 * @returns {{ ok: boolean, total: number, results: ScoreResult[] }}
 */
export function scoreAssignment(assignment, rules, roster) {
  const results = [];
  let total = 0;
  let ok = true;

  for (const rule of rules) {
    const result = scoreRule(assignment, rule, roster);
    results.push(result);

    if (result.hard === true && result.ok === false) {
      ok = false;
      total = 0;
      break;
    }

    total += result.points;
  }

  if (ok === false) {
    return { ok: false, total: 0, results };
  }

  return { ok: true, total, results };
}
