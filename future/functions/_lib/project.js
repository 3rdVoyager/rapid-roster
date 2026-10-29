/**
 * Server-side project JSON shape checks (mirrors frontend/js/state.js ideas).
 */

/** Reject cloud saves larger than this (results can bloat). */
export const MAX_PROJECT_BYTES = 1.5 * 1024 * 1024;

/**
 * @param {unknown} project
 * @returns {{ ok: true, project: object }|{ ok: false, error: string }}
 */
export function validateProjectPayload(project) {
  if (project === null || typeof project !== "object") {
    return { ok: false, error: "project must be an object." };
  }

  const p = /** @type {Record<string, unknown>} */ (project);

  if (isTableShape(p.entries) === false) {
    return { ok: false, error: "entries must have columns and rows arrays." };
  }

  if (isTableShape(p.slots) === false) {
    return { ok: false, error: "slots must have columns and rows arrays." };
  }

  if (Array.isArray(p.rules) === false) {
    return { ok: false, error: "rules must be an array." };
  }

  return { ok: true, project: p };
}

/**
 * Normalize a project blob before storing in data_json.
 *
 * @param {object} project
 * @param {string} id
 * @param {string} name
 * @param {string} updatedAt
 * @returns {object}
 */
export function normalizeStoredProject(project, id, name, updatedAt) {
  const next = { ...project };
  next.id = id;
  next.name = name;
  next.updatedAt = updatedAt;

  if (next.setup === undefined || next.setup === null || typeof next.setup !== "object") {
    next.setup = {
      defaultSlotsPerEntry: 1,
      conflictGroups: []
    };
  }

  if (next.results === undefined) {
    next.results = null;
  }

  return next;
}

/**
 * @param {unknown} table
 * @returns {boolean}
 */
function isTableShape(table) {
  if (table === null || typeof table !== "object") {
    return false;
  }

  const t = /** @type {Record<string, unknown>} */ (table);
  return Array.isArray(t.columns) === true && Array.isArray(t.rows) === true;
}
