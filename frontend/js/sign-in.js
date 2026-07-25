/**
 * sign-in.js
 *
 * Posts the email form to /api/auth/request-link and shows status text.
 */
import { requestMagicLink } from "/js/api.js";

function main() {
  const form = document.querySelector(".sign-in-form");
  const statusEl = document.querySelector(".sign-in-status");

  if (form === null) {
    return;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const emailInput = document.getElementById("email");
    const submitBtn = form.querySelector('button[type="submit"]');
    let email = "";

    if (emailInput !== null) {
      email = emailInput.value.trim();
    }

    if (email === "") {
      showStatus(statusEl, "Enter your email address.", false);
      return;
    }

    if (submitBtn !== null) {
      submitBtn.disabled = true;
    }

    showStatus(statusEl, "Sending sign-in link…", true);

    try {
      const result = await requestMagicLink(email);
      const message =
        result && typeof result.message === "string"
          ? result.message
          : "Check your email for a sign-in link. It may take a minute to arrive.";
      showStatus(statusEl, message, true);
    } catch (error) {
      console.error(error);
      const message =
        error && typeof error.message === "string"
          ? error.message
          : "Could not send a sign-in link. Try again.";
      showStatus(statusEl, message, false);
      if (submitBtn !== null) {
        submitBtn.disabled = false;
      }
    }
  });
}

/**
 * @param {HTMLElement|null} statusEl
 * @param {string} text
 * @param {boolean} ok
 */
function showStatus(statusEl, text, ok) {
  if (statusEl === null) {
    return;
  }
  statusEl.hidden = false;
  statusEl.textContent = text;
  statusEl.setAttribute("data-ok", ok ? "true" : "false");
}

main();
