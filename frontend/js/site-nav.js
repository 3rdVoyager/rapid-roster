/**
 * site-nav.js
 *
 * Mobile menu toggle for public site headers (.site-nav-toggle).
 */
function main() {
  const toggle = document.getElementById("site-nav-toggle");
  const nav = document.getElementById("site-nav");

  if (toggle === null || nav === null) {
    return;
  }

  toggle.addEventListener("click", function () {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.textContent = open ? "Close" : "Menu";
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && nav.classList.contains("is-open")) {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = "Menu";
    }
  });
}

main();
