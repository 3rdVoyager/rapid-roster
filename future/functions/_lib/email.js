/**
 * Cloudflare Email Sending helpers for magic-link auth.
 *
 * Prefer the send_email binding (env.EMAIL) when present — local wrangler
 * simulates it; Workers can use it natively.
 * On Pages production, use the REST API with EMAIL_API_KEY + account id.
 */

/**
 * @param {Record<string, unknown>} env
 * @param {string} toEmail
 * @param {string} magicUrl
 * @returns {Promise<boolean>} true when a provider accepted the send
 */
export async function sendMagicLinkEmail(env, toEmail, magicUrl) {
  const fromAddress = getEmailFrom(env);
  if (fromAddress === "") {
    return false;
  }

  const appName =
    typeof env.APP_NAME === "string" && env.APP_NAME.trim() !== ""
      ? env.APP_NAME.trim()
      : "RapidRoster";

  const subject = "Your " + appName + " sign-in link";
  const textBody = buildTextBody(appName, magicUrl);
  const htmlBody = buildHtmlBody(appName, magicUrl);

  // Prefer REST when credentials exist (real delivery on Pages / local).
  const apiKey = readTrimmedString(env.EMAIL_API_KEY);
  const accountId = readTrimmedString(env.CLOUDFLARE_ACCOUNT_ID);
  if (apiKey !== "" && accountId !== "") {
    try {
      const sent = await sendViaRestApi(
        apiKey,
        accountId,
        toEmail,
        fromAddress,
        appName,
        subject,
        textBody,
        htmlBody
      );
      if (sent === true) {
        return true;
      }
    } catch (error) {
      console.error("[auth] email send failed", error);
    }
    // Fall through to binding / fail-open log in request-link.
  }

  // Binding path: local wrangler simulation, or Workers with send_email.
  const binding = env.EMAIL;
  if (
    binding !== undefined &&
    binding !== null &&
    typeof binding === "object" &&
    typeof /** @type {{ send?: unknown }} */ (binding).send === "function"
  ) {
    try {
      await /** @type {{ send: (msg: object) => Promise<unknown> }} */ (
        binding
      ).send({
        to: toEmail,
        from: { email: fromAddress, name: appName },
        subject: subject,
        text: textBody,
        html: htmlBody
      });
      return true;
    } catch (error) {
      console.error("[auth] EMAIL binding send failed", error);
      return false;
    }
  }

  return false;
}

/**
 * @param {string} apiKey
 * @param {string} accountId
 * @param {string} toEmail
 * @param {string} fromAddress
 * @param {string} appName
 * @param {string} subject
 * @param {string} textBody
 * @param {string} htmlBody
 * @returns {Promise<boolean>}
 */
async function sendViaRestApi(
  apiKey,
  accountId,
  toEmail,
  fromAddress,
  appName,
  subject,
  textBody,
  htmlBody
) {
  const url =
    "https://api.cloudflare.com/client/v4/accounts/" +
    encodeURIComponent(accountId) +
    "/email/sending/send";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to: toEmail,
      from: { address: fromAddress, name: appName },
      subject: subject,
      text: textBody,
      html: htmlBody
    })
  });

  const payload = await response.json().catch(function () {
    return null;
  });

  if (response.ok !== true || payload === null || payload.success !== true) {
    console.error("[auth] Cloudflare Email Sending REST failed", {
      status: response.status,
      errors: payload && payload.errors
    });
    return false;
  }

  return true;
}

/**
 * @param {Record<string, unknown>} env
 * @returns {string}
 */
function getEmailFrom(env) {
  return readTrimmedString(env.EMAIL_FROM);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function readTrimmedString(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

/**
 * @param {string} appName
 * @param {string} magicUrl
 * @returns {string}
 */
function buildTextBody(appName, magicUrl) {
  return (
    "Sign in to " +
    appName +
    "\n\n" +
    "Open this link to sign in (expires in 15 minutes):\n" +
    magicUrl +
    "\n\n" +
    "If you did not request this, you can ignore this email.\n"
  );
}

/**
 * @param {string} appName
 * @param {string} magicUrl
 * @returns {string}
 */
function buildHtmlBody(appName, magicUrl) {
  const safeName = escapeHtml(appName);
  const safeUrl = escapeHtml(magicUrl);
  return (
    "<p>Sign in to <strong>" +
    safeName +
    "</strong></p>" +
    "<p><a href=\"" +
    safeUrl +
    "\">Sign in to " +
    safeName +
    "</a></p>" +
    "<p>This link expires in 15 minutes.</p>" +
    "<p>If you did not request this, you can ignore this email.</p>"
  );
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
