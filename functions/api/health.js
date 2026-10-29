/**
 * GET /api/health — smoke check that Functions are wired.
 */
import { json } from "../_lib/http.js";

export async function onRequestGet(context) {
  const hasDb = context.env.DB !== undefined && context.env.DB !== null;

  return json({
    ok: true,
    service: "rapid-roster",
    db: hasDb
  });
}
