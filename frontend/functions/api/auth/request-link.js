/**
 * POST /api/auth/request-link
 *
 * Upsert user by email, create a short-lived token, email the magic link
 * (or log it when EMAIL_API_KEY is not configured).
 */
import {
  errorJson,
  expiresIso,
  json,
  nowIso,
  randomId,
  readEmailFromBody
} from "../../_lib/http.js";
import { AUTH_TOKEN_TTL_MS } from "../../_lib/auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  if (db === undefined || db === null) {
    return errorJson("Database is not configured.", 500);
  }

  let email = "";
  try {
    email = await readEmailFromBody(request);
  } catch (error) {
    return errorJson("Could not read email from request body.");
  }

  email = normalizeEmail(email);
  if (isValidEmail(email) === false) {
    return errorJson("Enter a valid email address.");
  }

  const now = nowIso();
  let user = await db
    .prepare(`SELECT id, email FROM users WHERE email = ?`)
    .bind(email)
    .first();

  if (user === null) {
    const userId = "user-" + randomId(12);
    await db
      .prepare(`INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)`)
      .bind(userId, email, now)
      .run();
    user = { id: userId, email: email };
  }

  const token = randomId(24);
  const expiresAt = expiresIso(AUTH_TOKEN_TTL_MS);

  await db
    .prepare(
      `INSERT INTO auth_tokens (token, user_id, expires_at) VALUES (?, ?, ?)`
    )
    .bind(token, user.id, expiresAt)
    .run();

  const origin = getAppOrigin(request, env);
  const magicUrl = origin + "/api/auth/verify?token=" + encodeURIComponent(token);

  const emailed = await maybeSendMagicLink(env, email, magicUrl);

  if (emailed === false) {
    // Dev mode: link appears in Wrangler / Pages Function logs.
    console.log("[auth] Magic link for " + email + ": " + magicUrl);
  }

  return json({
    ok: true,
    message: emailed
      ? "Check your email for a sign-in link."
      : "Check your email for a sign-in link. (Dev: link also logged on the server.)"
  });
}

/**
 * @param {string} email
 * @returns {string}
 */
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/**
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (email.length < 3 || email.length > 254) {
    return false;
  }
  // Simple shape check — good enough for MVP magic-link.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @returns {string}
 */
function getAppOrigin(request, env) {
  if (typeof env.APP_ORIGIN === "string" && env.APP_ORIGIN.trim() !== "") {
    return env.APP_ORIGIN.replace(/\/$/, "");
  }
  return new URL(request.url).origin;
}

/**
 * Optional email send. Returns true when a provider was used.
 * Without EMAIL_API_KEY we only log (dev mode).
 *
 * @param {Record<string, unknown>} env
 * @param {string} email
 * @param {string} magicUrl
 * @returns {Promise<boolean>}
 */
async function maybeSendMagicLink(env, email, magicUrl) {
  const apiKey = env.EMAIL_API_KEY;
  if (typeof apiKey !== "string" || apiKey.trim() === "") {
    return false;
  }

  // Placeholder for a real provider (Resend / Mailchannels / etc.).
  // Keep fail-open for MVP: if send fails, still log the link.
  try {
    console.log(
      "[auth] EMAIL_API_KEY is set but no provider is wired yet. Link for " +
        email +
        ": " +
        magicUrl
    );
  } catch (error) {
    console.error("[auth] email send failed", error);
  }

  return false;
}
