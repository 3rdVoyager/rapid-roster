/**
 * GET /api/auth/me — current user or 401.
 */
import { errorJson, json } from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;

  if (db === undefined || db === null) {
    return errorJson("Database is not configured.", 500);
  }

  const user = await getSessionUser(db, request);
  if (user === null) {
    return errorJson("Not signed in.", 401);
  }

  return json({ user: user });
}
