/**
 * /api/projects
 *   GET  — list { id, name, updated_at } for the signed-in user
 *   POST — create from { name, project? }
 */
import {
  errorJson,
  json,
  nowIso,
  randomId,
  readJsonBody
} from "../_lib/http.js";
import { getSessionUser } from "../_lib/auth.js";
import {
  MAX_PROJECT_BYTES,
  normalizeStoredProject,
  validateProjectPayload
} from "../_lib/project.js";

export async function onRequestGet(context) {
  const user = await requireUser(context);
  if (user instanceof Response) {
    return user;
  }

  const rows = await context.env.DB
    .prepare(
      `SELECT id, name, updated_at
       FROM projects
       WHERE user_id = ?
       ORDER BY updated_at DESC`
    )
    .bind(user.id)
    .all();

  return json({
    projects: rows.results || []
  });
}

export async function onRequestPost(context) {
  const user = await requireUser(context);
  if (user instanceof Response) {
    return user;
  }

  const bodyResult = await readJsonBody(context.request, MAX_PROJECT_BYTES);
  if (bodyResult.ok === false) {
    return bodyResult.response;
  }

  const body = bodyResult.data;
  let name = "Untitled project";
  if (body && typeof body.name === "string" && body.name.trim() !== "") {
    name = body.name.trim();
  }

  let projectInput = body && body.project !== undefined ? body.project : null;

  if (projectInput === null) {
    projectInput = emptyProjectShell(name);
  }

  const checked = validateProjectPayload(projectInput);
  if (checked.ok === false) {
    return errorJson(checked.error);
  }

  const id =
    typeof projectInput.id === "string" && projectInput.id.trim() !== ""
      ? projectInput.id.trim()
      : "proj-" + randomId(12);

  const updatedAt = nowIso();
  const stored = normalizeStoredProject(checked.project, id, name, updatedAt);
  const dataJson = JSON.stringify(stored);

  if (dataJson.length > MAX_PROJECT_BYTES) {
    return errorJson("Project is too large to save to the cloud.", 413);
  }

  try {
    await context.env.DB
      .prepare(
        `INSERT INTO projects (id, user_id, name, data_json, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(id, user.id, name, dataJson, updatedAt)
      .run();
  } catch (error) {
    console.error("[projects] create failed", error);
    return errorJson("Could not create project.", 500);
  }

  return json({ id: id, name: name, updated_at: updatedAt, project: stored }, 201);
}

/**
 * @param {EventContext} context
 * @returns {Promise<{ id: string, email: string }|Response>}
 */
async function requireUser(context) {
  const db = context.env.DB;
  if (db === undefined || db === null) {
    return errorJson("Database is not configured.", 500);
  }

  const user = await getSessionUser(db, context.request);
  if (user === null) {
    return errorJson("Not signed in.", 401);
  }
  return user;
}

/**
 * @param {string} name
 * @returns {object}
 */
function emptyProjectShell(name) {
  return {
    name: name,
    entries: {
      columns: [
        { key: "id", label: "ID", type: "id" },
        { key: "name", label: "Name", type: "text" }
      ],
      rows: []
    },
    slots: {
      columns: [
        { key: "id", label: "ID", type: "id" },
        { key: "name", label: "Name", type: "text" },
        { key: "min_size", label: "Min", type: "minSize" },
        { key: "max_size", label: "Max", type: "maxSize" }
      ],
      rows: []
    },
    setup: {
      defaultSlotsPerEntry: 1,
      conflictGroups: []
    },
    rules: [],
    results: null
  };
}
