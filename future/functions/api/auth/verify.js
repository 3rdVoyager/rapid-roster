/**
 * GET /api/auth/verify?token=...
 *
 * Validate magic-link token, create session cookie, redirect to /app/.
 */
import {
  errorJson,
  expiresIso,
  nowIso,
  randomId,
  redirect
} from "../../_lib/http.js";
import {
  SESSION_MAX_AGE_SEC,
  buildSessionCookie,
  createSession
} from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;

  if (db === undefined || db === null) {
    return errorJson("Database is not configured.", 500);
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (token === null || token.trim() === "") {
    return errorJson("Missing sign-in token.", 400);
  }

  const now = nowIso();
  const row = await db
    .prepare(
      `SELECT token, user_id, expires_at FROM auth_tokens WHERE token = ?`
    )
    .bind(token.trim())
    .first();

  if (row === null) {
    return errorJson("This sign-in link is invalid or already used.", 400);
  }

  if (String(row.expires_at) <= now) {
    await db.prepare(`DELETE FROM auth_tokens WHERE token = ?`).bind(token).run();
    return errorJson("This sign-in link has expired. Request a new one.", 400);
  }

  // One-time use.
  await db.prepare(`DELETE FROM auth_tokens WHERE token = ?`).bind(token).run();

  const sessionId = "sess-" + randomId(18);
  const expiresAt = expiresIso(SESSION_MAX_AGE_SEC * 1000);

  await createSession(db, String(row.user_id), sessionId, expiresAt);

  return redirect("/app/", {
    "Set-Cookie": buildSessionCookie(request, sessionId)
  });
}
