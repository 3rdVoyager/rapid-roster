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

  if (toggle.getAttribute("title") === null || toggle.getAttribute("title") === "") {
    toggle.setAttribute(
      "title",
      "Open or close the site navigation menu on smaller screens."
    );
  }

  function setOpen(open) {
    if (open === true) {
      nav.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close menu");
      toggle.setAttribute("title", "Close the site navigation menu.");
    } else {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
      toggle.setAttribute(
        "title",
        "Open or close the site navigation menu on smaller screens."
      );
    }
  }

  toggle.addEventListener("click", function () {
    const open = nav.classList.contains("is-open") === false;
    setOpen(open);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && nav.classList.contains("is-open")) {
      setOpen(false);
    }
  });
}

main();
