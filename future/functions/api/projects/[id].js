/**
 * /api/projects/:id
 *   GET    — full project JSON
 *   PUT    — replace name + data_json (owner only)
 *   DELETE — delete owned project
 */
import {
  errorJson,
  json,
  nowIso,
  readJsonBody
} from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/auth.js";
import {
  MAX_PROJECT_BYTES,
  normalizeStoredProject,
  validateProjectPayload
} from "../../_lib/project.js";

export async function onRequestGet(context) {
  const user = await requireUser(context);
  if (user instanceof Response) {
    return user;
  }

  const id = context.params.id;
  const row = await context.env.DB
    .prepare(
      `SELECT id, name, data_json, updated_at
       FROM projects
       WHERE id = ? AND user_id = ?`
    )
    .bind(id, user.id)
    .first();

  if (row === null) {
    return errorJson("Project not found.", 404);
  }

  let project = null;
  try {
    project = JSON.parse(String(row.data_json));
  } catch (error) {
    return errorJson("Stored project data is corrupt.", 500);
  }

  return json({
    id: String(row.id),
    name: String(row.name),
    updated_at: String(row.updated_at),
    project: project
  });
}

export async function onRequestPut(context) {
  const user = await requireUser(context);
  if (user instanceof Response) {
    return user;
  }

  const id = context.params.id;
  const bodyResult = await readJsonBody(context.request, MAX_PROJECT_BYTES);
  if (bodyResult.ok === false) {
    return bodyResult.response;
  }

  const body = bodyResult.data;
  const existing = await context.env.DB
    .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ?`)
    .bind(id, user.id)
    .first();

  if (existing === null) {
    return errorJson("Project not found.", 404);
  }

  let name = "Untitled project";
  if (body && typeof body.name === "string" && body.name.trim() !== "") {
    name = body.name.trim();
  }

  const projectInput =
    body && body.project !== undefined ? body.project : body;

  const checked = validateProjectPayload(projectInput);
  if (checked.ok === false) {
    return errorJson(checked.error);
  }

  const updatedAt = nowIso();
  const stored = normalizeStoredProject(checked.project, id, name, updatedAt);
  const dataJson = JSON.stringify(stored);

  if (dataJson.length > MAX_PROJECT_BYTES) {
    return errorJson("Project is too large to save to the cloud.", 413);
  }

  await context.env.DB
    .prepare(
      `UPDATE projects
       SET name = ?, data_json = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    )
    .bind(name, dataJson, updatedAt, id, user.id)
    .run();

  return json({
    id: id,
    name: name,
    updated_at: updatedAt,
    project: stored
  });
}

export async function onRequestDelete(context) {
  const user = await requireUser(context);
  if (user instanceof Response) {
    return user;
  }

  const id = context.params.id;
  const result = await context.env.DB
    .prepare(`DELETE FROM projects WHERE id = ? AND user_id = ?`)
    .bind(id, user.id)
    .run();

  const changes =
    result && result.meta && typeof result.meta.changes === "number"
      ? result.meta.changes
      : 0;

  if (changes === 0) {
    return errorJson("Project not found.", 404);
  }

  return json({ ok: true });
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
