/**
 * Shared HTTP helpers for Pages Functions.
 */

/**
 * @param {unknown} data
 * @param {number} [status]
 * @param {Record<string, string>} [extraHeaders]
 * @returns {Response}
 */
export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders
    }
  });
}

/**
 * @param {string} message
 * @param {number} [status]
 * @returns {Response}
 */
export function errorJson(message, status = 400) {
  return json({ error: message }, status);
}

/**
 * @param {string} location
 * @param {Record<string, string>} [extraHeaders]
 * @returns {Response}
 */
export function redirect(location, extraHeaders = {}) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      ...extraHeaders
    }
  });
}

/**
 * Read JSON body; rejects oversized payloads.
 *
 * @param {Request} request
 * @param {number} maxBytes
 * @returns {Promise<{ ok: true, data: any }|{ ok: false, response: Response }>}
 */
export async function readJsonBody(request, maxBytes) {
  const contentLength = request.headers.get("Content-Length");

  if (contentLength !== null && Number(contentLength) > maxBytes) {
    return {
      ok: false,
      response: errorJson("Request body is too large.", 413)
    };
  }

  const text = await request.text();

  if (text.length > maxBytes) {
    return {
      ok: false,
      response: errorJson("Request body is too large.", 413)
    };
  }

  if (text.trim() === "") {
    return { ok: true, data: {} };
  }

  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (error) {
    return {
      ok: false,
      response: errorJson("Request body must be valid JSON.")
    };
  }
}

/**
 * Parse application/x-www-form-urlencoded or JSON email field.
 *
 * @param {Request} request
 * @returns {Promise<string>}
 */
export async function readEmailFromBody(request) {
  const contentType = request.headers.get("Content-Type") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    if (body && typeof body.email === "string") {
      return body.email.trim();
    }
    return "";
  }

  const form = await request.formData();
  const email = form.get("email");
  if (typeof email === "string") {
    return email.trim();
  }
  return "";
}

/**
 * @returns {string}
 */
export function nowIso() {
  return new Date().toISOString();
}

/**
 * @param {number} msFromNow
 * @returns {string}
 */
export function expiresIso(msFromNow) {
  return new Date(Date.now() + msFromNow).toISOString();
}

/**
 * Cryptographically random id (hex).
 *
 * @param {number} [bytes]
 * @returns {string}
 */
export function randomId(bytes = 16) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  let out = "";
  for (let i = 0; i < buffer.length; i = i + 1) {
    out = out + buffer[i].toString(16).padStart(2, "0");
  }
  return out;
}
