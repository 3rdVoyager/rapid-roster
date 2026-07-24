/**
 * project-config.js
 *
 * Turns a project object (tables + rules) into the flat configs that
 * legal.js and score.js understand.
 *
 * Keep translation here so the generator files stay simple — they never
 * need to know about table columns or row.cells shapes.
 */

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

  let defaultSlotsPerPerson = 1;

  if (project.setup !== undefined && project.setup.defaultSlotsPerPerson !== undefined) {
    defaultSlotsPerPerson = project.setup.defaultSlotsPerPerson;
  }

  let conflictGroups = [];

  if (project.setup !== undefined && project.setup.conflictGroups !== undefined) {
    conflictGroups = project.setup.conflictGroups;
  }

  return {
    slotIds: slotIds,
    slotMinSizes: slotMinSizes,
    slotMaxSizes: slotMaxSizes,
    defaultSlotsPerPerson: defaultSlotsPerPerson,
    conflictGroups: conflictGroups
  };
}

/**
 * Build the config object for scorePlacement / runSearch.
 *
 * peopleAttrs / slotAttrs look like:
 *   { "ava": { name: "Ava", skill: 8 }, "bob": { ... } }
 *
 * @param {Object} project
 * @returns {Object}
 */
export function buildScoreConfig(project) {
  const peopleAttrs = {};
  const slotAttrs = {};

  for (let i = 0; i < project.people.rows.length; i = i + 1) {
    const row = project.people.rows[i];
    peopleAttrs[row.id] = copyCells(row.cells);
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
    peopleAttrs: peopleAttrs,
    slotAttrs: slotAttrs,
    rules: rules
  };
}

/**
 * Find the first column key with a given type (id, minSize, …).
 *
 * @param {Object[]} columns
 * @param {string} typeName
 * @returns {string|null}
 */
function findColumnKeyByType(columns, typeName) {
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
