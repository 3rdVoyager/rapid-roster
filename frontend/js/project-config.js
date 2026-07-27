/**
 * project-config.js
 *
 * Turns a project object (tables + rules) into the flat configs that
 * legal.js and score.js understand.
 *
 * Keep translation here so the generator files stay simple — they never
 * need to know about table columns or row.cells shapes.
 */

import { buildConflictGroupsFromSlots } from "/js/presets.js";

/**
 * Build the config object for checkLegal / runSearch.
 *
 * @param {Object} project
 * @returns {Object}
 */
export function buildLegalConfig(project) {
  const slotIds = [];
  // Plain objects used as "maps": key = slot id, value = a number.
  const slotMinSizes = {};
  const slotMaxSizes = {};

  // Column "type" tells us which cell holds min/max (keys can be renamed).
  const minKey = findColumnKeyByType(project.slots.columns, "minSize");
  const maxKey = findColumnKeyByType(project.slots.columns, "maxSize");

  for (let i = 0; i < project.slots.rows.length; i = i + 1) {
    const row = project.slots.rows[i];
    slotIds.push(row.id);

    if (minKey !== null) {
      // Number(...) turns cell text/numbers into a real number.
      // Number.isNaN(x) is true when the value was not a valid number.
      const minValue = Number(row.cells[minKey]);
      if (Number.isNaN(minValue) === false) {
        slotMinSizes[row.id] = minValue;
      }
    }

    if (maxKey !== null) {
      const maxValue = Number(row.cells[maxKey]);
      if (Number.isNaN(maxValue) === false) {
        slotMaxSizes[row.id] = maxValue;
      }
    }
  }

  let defaultSlotsPerEntry = 1;

  if (project.setup !== undefined && project.setup.defaultSlotsPerEntry !== undefined) {
    defaultSlotsPerEntry = project.setup.defaultSlotsPerEntry;
  }

  // Prefer conflict_group column on slots when present; else saved setup groups.
  let conflictGroups = buildConflictGroupsFromSlots(project.slots);

  if (
    conflictGroups.length === 0 &&
    project.setup !== undefined &&
    project.setup.conflictGroups !== undefined
  ) {
    conflictGroups = project.setup.conflictGroups;
  }

  const slotsPerEntryById = buildSlotsPerEntryById(project);

  return {
    slotIds: slotIds,
    slotMinSizes: slotMinSizes,
    slotMaxSizes: slotMaxSizes,
    defaultSlotsPerEntry: defaultSlotsPerEntry,
    slotsPerEntryById: slotsPerEntryById,
    conflictGroups: conflictGroups
  };
}

/**
 * Per-entry slot caps: optional CSV column, then setup.slotsPerEntryById on top
 * (Global overrides win over imported column values).
 *
 * @param {Object} project
 * @returns {Object} entryId → number
 */
function buildSlotsPerEntryById(project) {
  const byId = {};
  const key = findSlotsPerEntryColumnKey(project.entries.columns);

  if (key !== null) {
    for (let i = 0; i < project.entries.rows.length; i = i + 1) {
      const row = project.entries.rows[i];
      const raw = row.cells[key];

      if (raw === undefined || raw === null || String(raw).trim() === "") {
        continue;
      }

      const value = Number(raw);

      if (Number.isNaN(value) === true || value < 0) {
        continue;
      }

      byId[row.id] = value;
    }
  }

  if (
    project.setup !== undefined &&
    project.setup.slotsPerEntryById !== undefined &&
    project.setup.slotsPerEntryById !== null
  ) {
    const setupMap = project.setup.slotsPerEntryById;
    const ids = Object.keys(setupMap);

    for (let i = 0; i < ids.length; i = i + 1) {
      const entryId = ids[i];
      const value = Number(setupMap[entryId]);

      if (Number.isNaN(value) === true || value < 0) {
        continue;
      }

      byId[entryId] = value;
    }
  }

  return byId;
}

/**
 * @param {Object[]} columns
 * @returns {string|null}
 */
export function findSlotsPerEntryColumnKey(columns) {
  if (columns === undefined || columns === null) {
    return null;
  }

  for (let i = 0; i < columns.length; i = i + 1) {
    const key = String(columns[i].key || "").toLowerCase();
    if (
      key === "slots_per_entry" ||
      key === "slotsperentry" ||
      key === "num_slots" ||
      key === "max_slots"
    ) {
      return columns[i].key;
    }
  }

  return null;
}

/**
 * How many slots one entry may hold.
 *
 * @param {Object} legalConfig
 * @param {string} entryId
 * @returns {number}
 */
export function getMaxSlotsForEntry(legalConfig, entryId) {
  if (
    legalConfig.slotsPerEntryById !== undefined &&
    legalConfig.slotsPerEntryById[entryId] !== undefined
  ) {
    return legalConfig.slotsPerEntryById[entryId];
  }

  let maxSlots = legalConfig.defaultSlotsPerEntry;
  if (maxSlots === undefined) {
    maxSlots = 1;
  }

  return maxSlots;
}

/**
 * Build the config object for scorePlacement / runSearch.
 *
 * entriesAttrs / slotAttrs look like:
 *   { "ava": { name: "Ava", skill: 8 }, "bob": { ... } }
 *
 * @param {Object} project
 * @returns {Object}
 */
export function buildScoreConfig(project) {
  const entriesAttrs = {};
  const slotAttrs = {};

  for (let i = 0; i < project.entries.rows.length; i = i + 1) {
    const row = project.entries.rows[i];
    entriesAttrs[row.id] = copyCells(row.cells);
  }

  for (let i = 0; i < project.slots.rows.length; i = i + 1) {
    const row = project.slots.rows[i];
    slotAttrs[row.id] = copyCells(row.cells);
  }

  let rules = [];

  if (project.rules !== undefined) {
    rules = project.rules;
  }

  return {
    entriesAttrs: entriesAttrs,
    slotAttrs: slotAttrs,
    rules: rules
  };
}

/**
 * Find the first column key with a given type (id, name, minSize, …).
 *
 * @param {Object[]} columns
 * @param {string} typeName
 * @returns {string|null}
 */
export function findColumnKeyByType(columns, typeName) {
  if (columns === undefined) {
    return null;
  }

  for (let i = 0; i < columns.length; i = i + 1) {
    if (columns[i].type === typeName) {
      return columns[i].key;
    }
  }

  return null;
}

/**
 * Shallow copy of a cells object.
 *
 * Why copy?
 *   So later edits to the score config cannot accidentally change
 *   the project tables (they would share the same inner object).
 *
 * Object.keys(cells) returns an array of property names, e.g.
 *   Object.keys({ skill: 8, school: "North" }) → ["skill", "school"]
 *
 * @param {Object} cells
 * @returns {Object}
 */
function copyCells(cells) {
  const copy = {};

  if (cells === undefined) {
    return copy;
  }

  const keys = Object.keys(cells);

  for (let i = 0; i < keys.length; i = i + 1) {
    const key = keys[i];
    copy[key] = cells[key];
  }

  return copy;
}

