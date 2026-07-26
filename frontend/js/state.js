/**
 * state.js
 *
 * Holds the current project in memory (one plain object).
 * Saves to localStorage in this browser (no count cap).
 *
 * Other files import helpers like getProject() and saveProject().
 * They should not reach into localStorage themselves.
 *
 * Cloud/auth dual-write code lives under /future until accounts return.
 */

/** Legacy single-slot key — migrated into the multi-project index. */
const LEGACY_STORAGE_KEY = "rapidroster.currentProject";

const INDEX_KEY = "rapidroster.localProjectIndex";
const ACTIVE_KEY = "rapidroster.activeLocalProjectId";

/** @type {Object|null} */
let currentProject = null;

/** True when the in-memory project differs from the last save. */
let isDirty = false;

/**
 * Read the current project object.
 * Returns null if nothing is loaded yet.
 *
 * @returns {Object|null}
 */
export function getProject() {
  return currentProject;
}

/**
 * Replace the current project in memory.
 * Does NOT write to localStorage — call saveProject() for that.
 *
 * @param {Object} project
 */
export function setProject(project) {
  if (project !== null && project !== undefined) {
    upgradeLegacyNameColumns(project);
  }
  currentProject = project;
  isDirty = true;
}

/**
 * Mark the project as changed (or not).
 *
 * @param {boolean} dirty
 */
export function setDirty(dirty) {
  isDirty = dirty === true;
}

/**
 * @returns {boolean}
 */
export function getDirty() {
  return isDirty;
}

/**
 * Write the current project to localStorage.
 *
 * @returns {boolean} true if the local save worked
 */
export function saveProject() {
  return saveProjectLocal();
}

/**
 * Async save for callers that await a result object.
 *
 * @returns {Promise<{ local: boolean }>}
 */
export async function persistProject() {
  const localOk = saveProjectLocal();
  return { local: localOk };
}

/**
 * @returns {boolean}
 */
function saveProjectLocal() {
  if (currentProject === null) {
    return false;
  }

  currentProject.updatedAt = new Date().toISOString();

  try {
    const id = String(currentProject.id || "");
    if (id === "") {
      return false;
    }

    migrateLegacyLocalProject();

    const index = readLocalIndex();

    localStorage.setItem(projectStorageKey(id), JSON.stringify(currentProject));
    upsertLocalIndex(index, {
      id: id,
      name: currentProject.name || "Untitled project",
      updatedAt: currentProject.updatedAt
    });
    writeLocalIndex(index);
    localStorage.setItem(ACTIVE_KEY, id);
    // Keep legacy key in sync for older code paths / quick open.
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(currentProject));
    isDirty = false;
    return true;
  } catch (error) {
    console.error("Could not save project:", error);
    return false;
  }
}

/**
 * @param {string} id
 * @returns {string}
 */
function projectStorageKey(id) {
  return "rapidroster.localProject." + id;
}

/**
 * @returns {Array<{ id: string, name: string, updatedAt: string }>}
 */
function readLocalIndex() {
  migrateLegacyLocalProject();

  try {
    const text = localStorage.getItem(INDEX_KEY);
    if (text === null || text === "") {
      return [];
    }
    const data = JSON.parse(text);
    if (Array.isArray(data) === false) {
      return [];
    }
    return data;
  } catch (error) {
    console.error("Could not read local project index:", error);
    return [];
  }
}

/**
 * @param {Array<{ id: string, name: string, updatedAt: string }>} index
 */
function writeLocalIndex(index) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

/**
 * @param {Array<{ id: string, name: string, updatedAt: string }>} index
 * @param {string} id
 * @returns {{ id: string, name: string, updatedAt: string }|null}
 */
function findIndexEntry(index, id) {
  for (let i = 0; i < index.length; i = i + 1) {
    if (index[i].id === id) {
      return index[i];
    }
  }
  return null;
}

/**
 * @param {Array<{ id: string, name: string, updatedAt: string }>} index
 * @param {{ id: string, name: string, updatedAt: string }} entry
 */
function upsertLocalIndex(index, entry) {
  for (let i = 0; i < index.length; i = i + 1) {
    if (index[i].id === entry.id) {
      index[i] = entry;
      return;
    }
  }
  index.push(entry);
}

/**
 * Move the old single-slot save into the multi-project library once.
 */
function migrateLegacyLocalProject() {
  try {
    if (localStorage.getItem(INDEX_KEY) !== null) {
      return;
    }

    const text = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (text === null || text === "") {
      writeLocalIndex([]);
      return;
    }

    const project = JSON.parse(text);
    if (project === null || typeof project !== "object") {
      writeLocalIndex([]);
      return;
    }

    if (project.id === undefined || project.id === "") {
      project.id = makeId("proj");
    }

    localStorage.setItem(
      projectStorageKey(project.id),
      JSON.stringify(project)
    );
    writeLocalIndex([
      {
        id: String(project.id),
        name: project.name || "Untitled project",
        updatedAt: project.updatedAt || new Date().toISOString()
      }
    ]);
    localStorage.setItem(ACTIVE_KEY, String(project.id));
  } catch (error) {
    console.error("Could not migrate legacy local project:", error);
    writeLocalIndex([]);
  }
}

/**
 * List local (browser-only) projects, newest first.
 *
 * @returns {Array<{ id: string, name: string, updatedAt: string }>}
 */
export function listLocalProjects() {
  const index = readLocalIndex().slice();
  index.sort(function (a, b) {
    const at = a.updatedAt || "";
    const bt = b.updatedAt || "";
    if (at === bt) {
      return 0;
    }
    return at < bt ? 1 : -1;
  });
  return index;
}

/**
 * @returns {number}
 */
export function getLocalProjectCount() {
  return readLocalIndex().length;
}

/**
 * Always true — local project count is uncapped.
 * Kept so older call sites can import a stable helper.
 *
 * @param {string} [projectId]
 * @returns {boolean}
 */
export function canCreateLocalProject(projectId) {
  void projectId;
  return true;
}

/**
 * Load a local project by id into memory.
 *
 * @param {string} id
 * @returns {Object|null}
 */
export function loadLocalProjectById(id) {
  if (id === undefined || id === "") {
    return null;
  }

  try {
    migrateLegacyLocalProject();
    const text = localStorage.getItem(projectStorageKey(id));
    if (text === null || text === "") {
      return null;
    }
    const project = JSON.parse(text);
    upgradeLegacyNameColumns(project);
    currentProject = project;
    isDirty = false;
    localStorage.setItem(ACTIVE_KEY, id);
    localStorage.setItem(LEGACY_STORAGE_KEY, text);
    return project;
  } catch (error) {
    console.error("Could not load local project:", error);
    return null;
  }
}

/**
 * Delete one local library project.
 *
 * @param {string} id
 */
export function deleteLocalProject(id) {
  if (id === undefined || id === "") {
    return;
  }

  migrateLegacyLocalProject();
  localStorage.removeItem(projectStorageKey(id));

  const index = readLocalIndex().filter(function (entry) {
    return entry.id !== id;
  });
  writeLocalIndex(index);

  const active = localStorage.getItem(ACTIVE_KEY);
  if (active === id) {
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    if (currentProject !== null && currentProject.id === id) {
      currentProject = null;
    }
  }
}

/**
 * Load a project from localStorage into memory.
 * Prefers the active local library project, then the legacy single-slot key.
 *
 * @returns {Object|null} the loaded project, or null if none / invalid
 */
export function loadProject() {
  try {
    migrateLegacyLocalProject();

    const activeId = localStorage.getItem(ACTIVE_KEY);
    if (activeId !== null && activeId !== "") {
      const fromLibrary = loadLocalProjectById(activeId);
      if (fromLibrary !== null) {
        return fromLibrary;
      }
    }

    const text = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (text === null || text === "") {
      return null;
    }

    const project = JSON.parse(text);
    upgradeLegacyNameColumns(project);
    currentProject = project;
    isDirty = false;
    return project;
  } catch (error) {
    console.error("Could not load project:", error);
    return null;
  }
}

/**
 * Remove the active/legacy saved project from localStorage.
 * Prefer deleteLocalProject(id) when deleting from the library list.
 */
export function clearSavedProject() {
  const activeId = localStorage.getItem(ACTIVE_KEY);
  if (activeId !== null && activeId !== "") {
    deleteLocalProject(activeId);
    return;
  }
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

/**
 * Empty project shell (for "New project" later).
 *
 * @param {string} name
 * @returns {Object}
 */
export function createEmptyProject(name) {
  let projectName = name;

  if (projectName === undefined || projectName === "") {
    projectName = "Untitled project";
  }

  return {
    id: makeId("proj"),
    name: projectName,
    updatedAt: new Date().toISOString(),
    entries: {
      columns: [
        { key: "id", label: "ID", type: "id" },
        { key: "name", label: "Name", type: "name" }
      ],
      rows: []
    },
    slots: {
      columns: [
        { key: "id", label: "ID", type: "id" },
        { key: "name", label: "Name", type: "name" },
        { key: "min_size", label: "Min", type: "minSize" },
        { key: "max_size", label: "Max", type: "maxSize" }
      ],
      rows: []
    },
    setup: {
      defaultSlotsPerEntry: 1,
      conflictGroups: []
    },
    rules: [],
    results: null
  };
}

/** Marker written into exported project files. */
export const PROJECT_FILE_FORMAT = "rapidroster-project";

/** Bump when the on-disk shape changes in a breaking way. */
export const PROJECT_FILE_FORMAT_VERSION = 1;

/**
 * Build a JSON string for downloading the current project.
 * Includes results so a teammate can open the same options.
 *
 * @param {Object} project
 * @returns {string}
 */
export function serializeProjectFile(project) {
  const payload = {
    format: PROJECT_FILE_FORMAT,
    formatVersion: PROJECT_FILE_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      updatedAt: project.updatedAt,
      presetId: project.presetId,
      entries: project.entries,
      slots: project.slots,
      setup: project.setup,
      rules: project.rules,
      results: project.results
    }
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Parse an exported project file into a project object.
 *
 * @param {string} text
 * @returns {{ ok: true, project: Object }|{ ok: false, error: string }}
 */
export function parseProjectFile(text) {
  let data = null;

  try {
    data = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      error: "That file is not valid JSON."
    };
  }

  if (data === null || typeof data !== "object") {
    return {
      ok: false,
      error: "That file does not look like a RapidRoster project."
    };
  }

  // Wrapped export: { format, formatVersion, project }
  let project = null;

  if (data.format === PROJECT_FILE_FORMAT && data.project !== undefined) {
    if (Number(data.formatVersion) > PROJECT_FILE_FORMAT_VERSION) {
      return {
        ok: false,
        error:
          "This project file is from a newer RapidRoster version. Update the app and try again."
      };
    }
    project = data.project;
  } else if (
    data.entries !== undefined &&
    data.slots !== undefined &&
    data.rules !== undefined
  ) {
    // Bare project object (same shape as localStorage).
    project = data;
  } else {
    return {
      ok: false,
      error: "That file is missing entries, slots, or rules."
    };
  }

  const check = validateProjectShape(project);

  if (check.ok === false) {
    return check;
  }

  if (project.id === undefined || project.id === "") {
    project.id = makeId("proj");
  }

  if (project.name === undefined || project.name === "") {
    project.name = "Imported project";
  }

  if (project.updatedAt === undefined) {
    project.updatedAt = new Date().toISOString();
  }

  if (project.setup === undefined) {
    project.setup = {
      defaultSlotsPerEntry: 1,
      conflictGroups: []
    };
  }

  if (project.setup.defaultSlotsPerEntry === undefined) {
    project.setup.defaultSlotsPerEntry = 1;
  }

  if (project.setup.conflictGroups === undefined) {
    project.setup.conflictGroups = [];
  }

  if (project.results === undefined) {
    project.results = null;
  }

  upgradeLegacyNameColumns(project);

  return {
    ok: true,
    project: project
  };
}

/**
 * Older projects used a text column keyed "name" as the display label.
 * Promote that to type "name" when no name column is configured yet.
 *
 * @param {Object} project
 */
function upgradeLegacyNameColumns(project) {
  upgradeLegacyNameColumnOnTable(project.entries);
  upgradeLegacyNameColumnOnTable(project.slots);
}

/**
 * @param {Object|undefined} table
 */
function upgradeLegacyNameColumnOnTable(table) {
  if (table === undefined || Array.isArray(table.columns) === false) {
    return;
  }

  for (let i = 0; i < table.columns.length; i = i + 1) {
    if (table.columns[i].type === "name") {
      return;
    }
  }

  for (let i = 0; i < table.columns.length; i = i + 1) {
    const col = table.columns[i];

    if (col.key === "name" && col.type === "text") {
      col.type = "name";
      return;
    }
  }
}

/**
 * @param {Object} project
 * @returns {{ ok: true }|{ ok: false, error: string }}
 */
function validateProjectShape(project) {
  if (project === null || typeof project !== "object") {
    return {
      ok: false,
      error: "That file does not contain a project object."
    };
  }

  if (isTableShape(project.entries) === false) {
    return {
      ok: false,
      error: "entries must have columns and rows arrays."
    };
  }

  if (isTableShape(project.slots) === false) {
    return {
      ok: false,
      error: "slots must have columns and rows arrays."
    };
  }

  if (Array.isArray(project.rules) === false) {
    return {
      ok: false,
      error: "rules must be an array."
    };
  }

  return { ok: true };
}

/**
 * @param {Object} table
 * @returns {boolean}
 */
function isTableShape(table) {
  if (table === null || typeof table !== "object") {
    return false;
  }

  if (Array.isArray(table.columns) === false) {
    return false;
  }

  if (Array.isArray(table.rows) === false) {
    return false;
  }

  return true;
}

/**
 * Demo project based on the generator test data (teams + schools + skill).
 * Used when there is nothing saved yet so Generate works immediately.
 *
 * @returns {Object}
 */
export function createDemoProject() {
  const entriesColumns = [
    { key: "id", label: "ID", type: "id" },
    { key: "name", label: "Name", type: "name" },
    { key: "skill", label: "Skill", type: "number" },
    { key: "school", label: "School", type: "text" },
    { key: "availability", label: "Availability", type: "text" }
  ];

  const entrySeed = [
    ["ava", "Ava Chen", 8, "Northwest", "Mon;Wed"],
    ["bob", "Noah Patel", 5, "Northeast", "Wed"],
    ["charlie", "Mia Brooks", 3, "Southwest", "Tue;Thu"],
    ["dave", "Jordan Lee", 2, "Northwest", "Mon"],
    ["eve", "Sam Okonkwo", 1, "Northeast", "Wed"],
    ["frank", "Riley Quinn", 4, "Southwest", "Fri"],
    ["grace", "Casey Nguyen", 6, "Northwest", "Mon;Wed"],
    ["hannah", "Taylor Kim", 7, "Northeast", "Tue"],
    ["ivy", "Jamie Ortiz", 9, "Southwest", "Thu"],
    ["jack", "Drew Hassan", 10, "Northwest", "Mon"],
    ["kate", "Alex Rivera", 6, "Northeast", "Wed"],
    ["lily", "Morgan Blake", 7, "Southwest", "Fri"],
    ["maddy", "Quinn Hayes", 8, "Northwest", "Mon;Wed"],
    ["nate", "Reese Park", 9, "Northeast", "Tue"],
    ["olive", "Sky Jordan", 10, "Southwest", "Thu"],
    ["paul", "Cameron Wu", 10, "Northwest", "Wed"],
    ["quinn", "Avery Scott", 10, "Northeast", "Fri"],
    ["rachel", "Jamie Cole", 9, "Southwest", "Mon"],
    ["sara", "Parker Diaz", 8, "Northwest", "Tue"],
    ["taylor", "Reese Kim", 7, "Northeast", "Wed"],
    ["uva", "Sam Lee", 6, "Southwest", "Thu"],
    ["vince", "Casey Brooks", 5, "Northwest", "Fri"],
    ["wendy", "Jordan Price", 4, "Northeast", "Mon"],
    ["xavier", "Taylor Ng", 3, "Southwest", "Tue"],
    ["yara", "Alex Chen", 2, "Northwest", "Wed"],
    ["zane", "Morgan Patel", 1, "Northeast", "Thu"]
  ];

  const entriesRows = [];

  for (let i = 0; i < entrySeed.length; i = i + 1) {
    const row = entrySeed[i];
    entriesRows.push({
      id: row[0],
      cells: {
        id: row[0],
        name: row[1],
        skill: row[2],
        school: row[3],
        availability: row[4]
      }
    });
  }

  return {
    id: makeId("proj"),
    name: "Rec league teams",
    updatedAt: new Date().toISOString(),
    entries: {
      columns: entriesColumns,
      rows: entriesRows
    },
    slots: {
      columns: [
        { key: "id", label: "ID", type: "id" },
        { key: "name", label: "Name", type: "name" },
        { key: "min_size", label: "Min", type: "minSize" },
        { key: "max_size", label: "Max", type: "maxSize" },
        { key: "practice_night", label: "Practice", type: "text" }
      ],
      rows: [
        {
          id: "s1",
          cells: {
            id: "s1",
            name: "Team A",
            min_size: 2,
            max_size: 10,
            practice_night: "Mon"
          }
        },
        {
          id: "s2",
          cells: {
            id: "s2",
            name: "Team B",
            min_size: 2,
            max_size: 10,
            practice_night: "Wed"
          }
        },
        {
          id: "s3",
          cells: {
            id: "s3",
            name: "Team C",
            min_size: 2,
            max_size: 10,
            practice_night: "Fri"
          }
        }
      ]
    },
    setup: {
      defaultSlotsPerEntry: 1,
      conflictGroups: []
    },
    rules: [
      {
        id: "R1",
        name: "Balance skill",
        type: "balance",
        hard: false,
        priority: 9,
        entryAttribute: "skill"
      },
      {
        id: "R2",
        name: "Cluster by school",
        type: "cluster",
        hard: false,
        priority: 8,
        shape: "entriesTogether",
        entryAttribute: "school",
        match: "exact"
      }
    ],
    results: null
  };
}

/**
 * Simple unique-ish id for local use (good enough before cloud ids exist).
 *
 * Example pieces:
 *   Date.now()           → milliseconds since 1970 (always growing)
 *   .toString(36)        → write that number with digits 0-9 and letters a-z
 *                          (shorter than base 10)
 *   Math.random() * 10000 → extra digits so two ids in the same ms differ
 *
 * @param {string} prefix
 * @returns {string}
 */
function makeId(prefix) {
  const timePart = Date.now().toString(36);
  const randomPart = Math.floor(Math.random() * 10000);
  return prefix + "-" + timePart + "-" + randomPart;
}
