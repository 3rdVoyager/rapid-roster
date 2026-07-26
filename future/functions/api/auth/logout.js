/**
 * POST /api/auth/logout — clear session cookie.
 */
import { json } from "../../_lib/http.js";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  deleteSession,
  getCookie
} from "../../_lib/auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;
  const sessionId = getCookie(request, SESSION_COOKIE);

  if (db !== undefined && db !== null && sessionId !== null && sessionId !== "") {
    try {
      await deleteSession(db, sessionId);
    } catch (error) {
      console.error("[auth] logout delete failed", error);
    }
  }

  return json(
    { ok: true },
    200,
    { "Set-Cookie": clearSessionCookie(request) }
  );
}
