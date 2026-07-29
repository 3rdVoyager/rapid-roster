/**
 * router.js
 *
 * Handle hash-based panel switching for the workspace.
 * Maps URL hashes (#entries, #slots, …) to panel sections.
 */

const PANEL_IDS = ["entries", "slots", "rules", "review", "generate", "results"];

/**
 * Get the current panel id from the URL hash.
 * Returns "entries" if no valid hash is present.
 */
export function getCurrentPanel() {
  const hash = window.location.hash.replace(/^#/, "");
  return PANEL_IDS.includes(hash) ? hash : "entries";
}

/**
 * Switch the visible panel.
 * Updates .is-active on both the sidebar nav item and the panel section.
 */
export function switchPanel(panelId) {
  if (!PANEL_IDS.includes(panelId)) return;

  // Update sidebar
  document.querySelectorAll(".app-nav-item").forEach((link) => {
    const isMatch = link.getAttribute("href") === `#${panelId}`;
    link.classList.toggle("is-active", isMatch);
    if (isMatch) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  // Update panels
  document.querySelectorAll(".app-panel").forEach((panel) => {
    const isMatch = panel.id === panelId;
    panel.classList.toggle("is-active", isMatch);
  });

  // Scroll main to top
  const main = document.querySelector(".app-main");
  if (main) main.scrollTop = 0;
}

/**
 * Listen for hash changes and switch panels.
 */
export function initRouter(onSwitch) {
  const handler = () => {
    const panel = getCurrentPanel();
    switchPanel(panel);
    if (onSwitch) onSwitch(panel);
  };

  window.addEventListener("hashchange", handler);
  // Run once on load
  handler();
}