/**
 * state.js
 *
 * Holds the current project in memory (one plain object).
 * Can save / load that object with localStorage so you can refresh
 * the page without losing work (no cloud login yet).
 *
 * Other files import helpers like getProject() and saveProject().
 * They should not reach into localStorage themselves.
 *
 * ---------------------------------------------------------------------------
 * Browser storage tools used here
 * ---------------------------------------------------------------------------
 *
 * localStorage.setItem(key, text)
 *   Save a string under a key in this browser (survives refresh).
 *
 * localStorage.getItem(key)
 *   Read that string back (or null if nothing saved).
 *
 * JSON.stringify(object)
 *   Turn a plain object into a text string so it can be stored.
 *
 * JSON.parse(text)
 *   Turn that text back into a plain object.
 */

const STORAGE_KEY = "rapidroster.currentProject";

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
 * @returns {boolean} true if save worked
 */
export function saveProject() {
  if (currentProject === null) {
    return false;
  }

  currentProject.updatedAt = new Date().toISOString();

  try {
    const text = JSON.stringify(currentProject);
    localStorage.setItem(STORAGE_KEY, text);
    isDirty = false;
    return true;
  } catch (error) {
    console.error("Could not save project:", error);
    return false;
  }
}

/**
 * Load a project from localStorage into memory.
 *
 * @returns {Object|null} the loaded project, or null if none / invalid
 */
export function loadProject() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);

    if (text === null || text === "") {
      return null;
    }

    const project = JSON.parse(text);
    currentProject = project;
    isDirty = false;
    return project;
  } catch (error) {
    console.error("Could not load project:", error);
    return null;
  }
}

/**
 * Remove the saved project from localStorage.
 * Does not clear the in-memory project unless you also setProject(null).
 */
export function clearSavedProject() {
  localStorage.removeItem(STORAGE_KEY);
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
    people: {
      columns: [
        { key: "id", label: "ID", type: "id" },
        { key: "name", label: "Name", type: "text" }
      ],
      rows: []
    },
    slots: {
      columns: [
        { key: "id", label: "ID", type: "id" },
        { key: "name", label: "Name", type: "text" },
        { key: "min_size", label: "Min", type: "minSize" },
        { key: "max_size", label: "Max", type: "maxSize" }
      ],
      rows: []
    },
    setup: {
      defaultSlotsPerPerson: 1,
      conflictGroups: []
    },
    rules: [],
    results: null
  };
}

/**
 * Demo project based on the generator test data (teams + schools + skill).
 * Used when there is nothing saved yet so Generate works immediately.
 *
 * @returns {Object}
 */
export function createDemoProject() {
  const peopleColumns = [
    { key: "id", label: "ID", type: "id" },
    { key: "name", label: "Name", type: "text" },
    { key: "skill", label: "Skill", type: "number" },
    { key: "school", label: "School", type: "text" },
    { key: "availability", label: "Availability", type: "text" }
  ];

  const personSeed = [
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

  const peopleRows = [];

  for (let i = 0; i < personSeed.length; i = i + 1) {
    const row = personSeed[i];
    peopleRows.push({
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
    people: {
      columns: peopleColumns,
      rows: peopleRows
    },
    slots: {
      columns: [
        { key: "id", label: "ID", type: "id" },
        { key: "name", label: "Name", type: "text" },
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
      defaultSlotsPerPerson: 1,
      conflictGroups: []
    },
    rules: [
      {
        id: "R1",
        name: "Balance skill",
        type: "balance",
        hard: false,
        priority: 9,
        personAttribute: "skill"
      },
      {
        id: "R2",
        name: "Cluster by school",
        type: "cluster",
        hard: false,
        priority: 8,
        shape: "peopleTogether",
        personAttribute: "school",
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
