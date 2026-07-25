/**
 * get-started.js
 *
 * Chooser page: sign in (link) or open a local try-out project (no cloud).
 */
import {
  createEmptyProject,
  setProject,
  saveProject,
  setCloudSynced,
  setDirty
} from "/js/state.js";

function main() {
  const tryBtn = document.getElementById("try-local-btn");
  const statusEl = document.getElementById("get-started-status");

  if (tryBtn === null) {
    return;
  }

  tryBtn.addEventListener("click", function () {
    if (statusEl !== null) {
      statusEl.hidden = false;
      statusEl.textContent = "Opening a local project…";
    }

    tryBtn.disabled = true;

    const project = createEmptyProject("Try-out project");
    setProject(project);
    setCloudSynced(false);
    setDirty(false);
    saveProject();
    window.location.href = "/app/project/";
  });
}

main();
