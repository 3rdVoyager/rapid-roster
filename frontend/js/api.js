/**
 * api.js
 *
 * Thin fetch wrappers for /api/auth and /api/projects.
 * credentials: "same-origin" so the httpOnly session cookie is sent.
 */

/**
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
async function apiFetch(path, options) {
  const init = options || {};
  const headers = new Headers(init.headers || {});

  if (init.body !== undefined && headers.has("Content-Type") === false) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers: headers,
    credentials: "same-origin"
  });

  let data = null;
  const text = await response.text();
  if (text !== "") {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = { error: text };
    }
  }

  if (response.ok === false) {
    const message =
      data && typeof data.error === "string"
        ? data.error
        : "Request failed (" + String(response.status) + ")";
    const err = new Error(message);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

/**
 * @returns {Promise<{ id: string, email: string }|null>}
 */
export async function fetchMe() {
  try {
    const data = await apiFetch("/api/auth/me");
    if (data && data.user) {
      return data.user;
    }
    return null;
  } catch (error) {
    if (error && error.status === 401) {
      return null;
    }
    // Network / API down — treat as signed out for UI purposes.
    return null;
  }
}

/**
 * @param {string} email
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function requestMagicLink(email) {
  return apiFetch("/api/auth/request-link", {
    method: "POST",
    body: JSON.stringify({ email: email })
  });
}

/**
 * @returns {Promise<void>}
 */
export async function logout() {
  await apiFetch("/api/auth/logout", { method: "POST", body: "{}" });
}

/**
 * @returns {Promise<Array<{ id: string, name: string, updated_at: string }>>}
 */
export async function listProjects() {
  const data = await apiFetch("/api/projects");
  if (data && Array.isArray(data.projects)) {
    return data.projects;
  }
  return [];
}

/**
 * @param {string} id
 * @returns {Promise<{ id: string, name: string, updated_at: string, project: object }>}
 */
export async function fetchCloudProject(id) {
  return apiFetch("/api/projects/" + encodeURIComponent(id));
}

/**
 * @param {{ name: string, project?: object }} body
 * @returns {Promise<{ id: string, name: string, updated_at: string, project: object }>}
 */
export async function createCloudProject(body) {
  return apiFetch("/api/projects", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

/**
 * @param {string} id
 * @param {{ name: string, project: object }} body
 * @returns {Promise<{ id: string, name: string, updated_at: string, project: object }>}
 */
export async function updateCloudProject(id, body) {
  return apiFetch("/api/projects/" + encodeURIComponent(id), {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteCloudProject(id) {
  await apiFetch("/api/projects/" + encodeURIComponent(id), {
    method: "DELETE"
  });
}
