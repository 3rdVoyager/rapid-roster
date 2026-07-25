/**
 * Cookie + session helpers.
 */

export const SESSION_COOKIE = "session";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days
const AUTH_TOKEN_TTL_MS = 1000 * 60 * 15; // 15 minutes

/**
 * @param {Request} request
 * @param {string} name
 * @returns {string|null}
 */
export function getCookie(request, name) {
  const header = request.headers.get("Cookie");
  if (header === null || header === "") {
    return null;
  }

  const parts = header.split(";");
  for (let i = 0; i < parts.length; i = i + 1) {
    const piece = parts[i].trim();
    const eq = piece.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = piece.slice(0, eq);
    if (key === name) {
      return decodeURIComponent(piece.slice(eq + 1));
    }
  }

  return null;
}

/**
 * @param {Request} request
 * @param {string} sessionId
 * @returns {string}
 */
export function buildSessionCookie(request, sessionId) {
  const url = new URL(request.url);
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return (
    SESSION_COOKIE +
    "=" +
    encodeURIComponent(sessionId) +
    "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" +
    String(SESSION_MAX_AGE_SEC) +
    secure
  );
}

/**
 * @param {Request} request
 * @returns {string}
 */
export function clearSessionCookie(request) {
  const url = new URL(request.url);
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return (
    SESSION_COOKIE +
    "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" +
    secure
  );
}

/**
 * @param {import("@cloudflare/workers-types").D1Database} db
 * @param {Request} request
 * @returns {Promise<{ id: string, email: string }|null>}
 */
export async function getSessionUser(db, request) {
  const sessionId = getCookie(request, SESSION_COOKIE);
  if (sessionId === null || sessionId === "") {
    return null;
  }

  const now = new Date().toISOString();
  const row = await db
    .prepare(
      `SELECT users.id AS id, users.email AS email
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.id = ? AND sessions.expires_at > ?`
    )
    .bind(sessionId, now)
    .first();

  if (row === null) {
    return null;
  }

  return {
    id: String(row.id),
    email: String(row.email)
  };
}

/**
 * @param {import("@cloudflare/workers-types").D1Database} db
 * @param {string} userId
 * @param {string} sessionId
 * @param {string} expiresAt
 */
export async function createSession(db, userId, sessionId, expiresAt) {
  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`
    )
    .bind(sessionId, userId, expiresAt)
    .run();
}

/**
 * @param {import("@cloudflare/workers-types").D1Database} db
 * @param {string} sessionId
 */
export async function deleteSession(db, sessionId) {
  await db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
}

export { AUTH_TOKEN_TTL_MS, SESSION_MAX_AGE_SEC };
