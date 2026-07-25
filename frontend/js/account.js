/**
 * account.js
 *
 * Shared account control for /app/ and /app/project/.
 * Signed out: Sign in button (no empty dropdown).
 * Signed in: menu with email, Projects, Sign out.
 */
import { fetchMe, logout } from "/js/api.js";
import {
  getLocalProjectCount,
  MAX_LOCAL_PROJECTS
} from "/js/state.js";

/**
 * Wire the Account control in the app header.
 *
 * @returns {Promise<{ id: string, email: string }|null>}
 */
export async function wireAccountMenu() {
  const btn = document.getElementById("account-menu-btn");
  if (btn === null) {
    return null;
  }

  const wrap = ensureMenuShell(btn);
  const menu = document.getElementById("account-menu");
  const user = await fetchMe();

  if (user === null) {
    renderSignedOut(wrap, btn, menu);
    return null;
  }

  renderSignedIn(wrap, btn, menu, user);
  wireDropdown(btn, menu);
  return user;
}

/**
 * @param {HTMLElement} btn
 * @returns {HTMLElement}
 */
function ensureMenuShell(btn) {
  let wrap = btn.closest(".account-menu-wrap");
  if (wrap === null) {
    wrap = document.createElement("div");
    wrap.className = "account-menu-wrap";
    btn.parentNode.insertBefore(wrap, btn);
    wrap.appendChild(btn);
  }

  if (document.getElementById("account-menu") === null) {
    const menu = document.createElement("div");
    menu.className = "account-menu";
    menu.id = "account-menu";
    menu.hidden = true;
    menu.setAttribute("role", "menu");
    menu.innerHTML =
      '<p class="account-menu-label" id="account-menu-label"></p>' +
      '<p class="account-menu-hint" id="account-menu-hint" hidden></p>' +
      '<div class="account-menu-actions" id="account-menu-actions"></div>';
    wrap.appendChild(menu);
  }

  return wrap;
}

/**
 * @param {HTMLElement} wrap
 * @param {HTMLElement} btn
 * @param {HTMLElement|null} menu
 */
function renderSignedOut(wrap, btn, menu) {
  if (menu !== null) {
    menu.hidden = true;
  }

  clearHint(wrap);

  const count = getLocalProjectCount();
  if (count > 0) {
    const hint = document.createElement("span");
    hint.className = "account-local-hint";
    hint.textContent =
      "Local " + String(count) + "/" + String(MAX_LOCAL_PROJECTS);
    wrap.insertBefore(hint, btn);
  }

  const link = document.createElement("a");
  link.className = btn.className;
  link.href = "/sign-in/";
  link.id = "account-menu-btn";
  link.textContent = "Sign in";
  btn.replaceWith(link);
}

/**
 * @param {HTMLElement} wrap
 * @param {HTMLElement} btn
 * @param {HTMLElement|null} menu
 * @param {{ id: string, email: string }} user
 */
function renderSignedIn(wrap, btn, menu, user) {
  clearHint(wrap);

  btn.textContent = "Account ▾";
  btn.setAttribute("aria-haspopup", "menu");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", "account-menu");

  if (menu === null) {
    return;
  }

  const label = document.getElementById("account-menu-label");
  const hint = document.getElementById("account-menu-hint");
  const actions = document.getElementById("account-menu-actions");

  if (label !== null) {
    label.hidden = false;
    label.textContent = user.email;
  }

  if (hint !== null) {
    hint.hidden = false;
    hint.textContent = "Cloud projects sync across devices.";
  }

  if (actions === null) {
    return;
  }

  actions.innerHTML = "";

  const projectsLink = document.createElement("a");
  projectsLink.className = "account-menu-item";
  projectsLink.href = "/app/";
  projectsLink.setAttribute("role", "menuitem");
  projectsLink.textContent = "Projects";
  actions.appendChild(projectsLink);

  const logoutBtn = document.createElement("button");
  logoutBtn.type = "button";
  logoutBtn.className = "account-menu-item";
  logoutBtn.setAttribute("role", "menuitem");
  logoutBtn.textContent = "Sign out";
  logoutBtn.addEventListener("click", async function () {
    try {
      await logout();
    } catch (error) {
      console.error(error);
    }
    window.location.href = "/sign-in/";
  });
  actions.appendChild(logoutBtn);
}

/**
 * @param {HTMLElement} wrap
 */
function clearHint(wrap) {
  const old = wrap.querySelector(".account-local-hint");
  if (old !== null) {
    old.remove();
  }
}

/**
 * @param {HTMLElement} btn
 * @param {HTMLElement|null} menu
 */
function wireDropdown(btn, menu) {
  if (menu === null) {
    return;
  }

  btn.addEventListener("click", function (event) {
    event.stopPropagation();
    toggleMenu(menu, btn);
  });

  menu.addEventListener("click", function (event) {
    event.stopPropagation();
  });

  document.addEventListener("click", function () {
    closeMenu(menu, btn);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeMenu(menu, btn);
    }
  });
}

/**
 * @param {HTMLElement|null} menu
 * @param {HTMLElement} btn
 */
function toggleMenu(menu, btn) {
  if (menu === null) {
    return;
  }
  if (menu.hidden === true) {
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
  } else {
    closeMenu(menu, btn);
  }
}

/**
 * @param {HTMLElement|null} menu
 * @param {HTMLElement} btn
 */
function closeMenu(menu, btn) {
  if (menu === null) {
    return;
  }
  menu.hidden = true;
  btn.setAttribute("aria-expanded", "false");
}
