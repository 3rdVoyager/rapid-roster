/**
 * account.js
 *
 * Shared Account menu for /app/ and /app/project/.
 * Shows email + Sign out when signed in; Get started when signed out.
 */
import { fetchMe, logout } from "/js/api.js";

/**
 * Wire the Account button into a small dropdown menu.
 *
 * @returns {Promise<{ id: string, email: string }|null>}
 */
export async function wireAccountMenu() {
  const btn = document.getElementById("account-menu-btn");
  if (btn === null) {
    return null;
  }

  ensureMenuShell(btn);
  const menu = document.getElementById("account-menu");
  const label = document.getElementById("account-menu-label");
  const actions = document.getElementById("account-menu-actions");

  btn.addEventListener("click", function (event) {
    event.stopPropagation();
    toggleMenu(menu, btn);
  });

  document.addEventListener("click", function () {
    closeMenu(menu, btn);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeMenu(menu, btn);
    }
  });

  const user = await fetchMe();
  renderAccountMenu(user, label, actions, menu, btn);
  return user;
}

/**
 * @param {HTMLElement} btn
 */
function ensureMenuShell(btn) {
  let wrap = btn.closest(".account-menu-wrap");
  if (wrap === null) {
    wrap = document.createElement("div");
    wrap.className = "account-menu-wrap";
    btn.parentNode.insertBefore(wrap, btn);
    wrap.appendChild(btn);
  }

  if (document.getElementById("account-menu") !== null) {
    return;
  }

  const menu = document.createElement("div");
  menu.className = "account-menu";
  menu.id = "account-menu";
  menu.hidden = true;
  menu.setAttribute("role", "menu");
  menu.innerHTML =
    '<p class="account-menu-label" id="account-menu-label"></p>' +
    '<div class="account-menu-actions" id="account-menu-actions"></div>';
  wrap.appendChild(menu);
}

/**
 * @param {{ id: string, email: string }|null} user
 * @param {HTMLElement|null} label
 * @param {HTMLElement|null} actions
 * @param {HTMLElement|null} menu
 * @param {HTMLElement} btn
 */
function renderAccountMenu(user, label, actions, menu, btn) {
  if (actions === null) {
    return;
  }

  actions.innerHTML = "";

  if (user !== null) {
    if (label !== null) {
      label.hidden = false;
      label.textContent = user.email;
    }
    btn.textContent = "Account ▾";

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
  } else {
    if (label !== null) {
      label.hidden = true;
      label.textContent = "";
    }
    btn.textContent = "Account ▾";

    const link = document.createElement("a");
    link.className = "account-menu-item";
    link.href = "/get-started/";
    link.setAttribute("role", "menuitem");
    link.textContent = "Get started";
    actions.appendChild(link);
  }
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
