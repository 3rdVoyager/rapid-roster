/**
 * legal.js
 *
 * This file answers one question:
 *   "Is this assignment allowed by Setup limits?"
 *
 * Minimum version — we only check Setup for now:
 *   1. Slot min / max sizes
 *   2. How many slots each person may hold
 *   3. Conflict groups (slots a person cannot hold at the same time)
 *
 * Later we will also check hard Cluster / Separate / Limit / Balance rules.
 * Soft rules do NOT belong here — those go in score.js.
 *
 * ---------------------------------------------------------------------------
 * How to call this file
 * ---------------------------------------------------------------------------
 *
 *   import { checkLegal } from "./legal.js";
 *
 *   const result = checkLegal(assignments, config);
 *
 *   if (result.ok === true) {
 *     // safe to keep this placement
 *   } else {
 *     // result.reasons is an array of plain-English strings
 *   }
 *
 * ---------------------------------------------------------------------------
 * What "config" looks like (simple on purpose)
 * ---------------------------------------------------------------------------
 *
 * We do NOT dig through the full project tables yet.
 * The workspace / CSV code can build this config later.
 * For now, pass a plain object like this:
 *
 *   config = {
 *     // Every slot id that exists in the project
 *     slotIds: ["t1", "t2"],
 *
 *     // Optional: minimum people required in each slot
 *     // Missing slot id → no minimum (treated as 0)
 *     slotMinSizes: {
 *       "t1": 5,
 *       "t2": 5
 *     },
 *
 *     // Optional: maximum people allowed in each slot
 *     // Missing slot id → no maximum
 *     slotMaxSizes: {
 *       "t1": 5,
 *       "t2": 5
 *     },
 *
 *     // How many slots one person may hold (project default)
 *     defaultSlotsPerPerson: 1,
 *
 *     // Groups of slot ids that the same person cannot hold together
 *     // Example: someone cannot be in both "optics" and "sounds" at once
 *     conflictGroups: [
 *       ["optics", "sounds"]
 *     ]
 *   }
 */

import {
  getSlotsForPerson,
  getPeopleInSlot
} from "./placement.js";

/**
 * Main entry point.
 *
 * Runs every setup check. Collects ALL problems it finds
 * (not just the first one), so the UI can show a full list.
 *
 * @param {Object} assignments - personId → array of slotIds
 * @param {Object} config - see file header for shape
 * @returns {{ ok: boolean, reasons: string[] }}
 */
export function checkLegal(assignments, config) {
  const reasons = [];

  // Run each family of checks. Each helper ADDS strings onto `reasons`.
  checkUnknownSlots(assignments, config, reasons);
  checkSlotSizes(assignments, config, reasons);
  checkSlotsPerPerson(assignments, config, reasons);
  checkConflictGroups(assignments, config, reasons);

  if (reasons.length === 0) {
    return {
      ok: true,
      reasons: []
    };
  }

  return {
    ok: false,
    reasons: reasons
  };
}

/**
 * If a person is assigned to a slot id that is not in config.slotIds,
 * that is a bug / bad data. Report it.
 *
 * @param {Object} assignments
 * @param {Object} config
 * @param {string[]} reasons - list we append messages to
 */
function checkUnknownSlots(assignments, config, reasons) {
  const knownSlotIds = config.slotIds;

  // Safety: if the caller forgot slotIds, skip this check.
  if (knownSlotIds === undefined) {
    return;
  }

  const personIds = Object.keys(assignments);

  for (let i = 0; i < personIds.length; i = i + 1) {
    const personId = personIds[i];
    const slotsForPerson = getSlotsForPerson(assignments, personId);

    for (let j = 0; j < slotsForPerson.length; j = j + 1) {
      const slotId = slotsForPerson[j];

      if (listContains(knownSlotIds, slotId) === false) {
        reasons.push(
          'Person "' + personId + '" is assigned to unknown slot "' + slotId + '".'
        );
      }
    }
  }
}

/**
 * Check min and max size for every known slot.
 *
 * @param {Object} assignments
 * @param {Object} config
 * @param {string[]} reasons
 */
function checkSlotSizes(assignments, config, reasons) {
  const slotIds = config.slotIds;

  if (slotIds === undefined) {
    return;
  }

  // If these maps are missing, treat them as empty objects.
  let minSizes = config.slotMinSizes;
  let maxSizes = config.slotMaxSizes;

  if (minSizes === undefined) {
    minSizes = {};
  }

  if (maxSizes === undefined) {
    maxSizes = {};
  }

  for (let i = 0; i < slotIds.length; i = i + 1) {
    const slotId = slotIds[i];
    const count = getPeopleInSlot(assignments, slotId).length;

    // ----- minimum -----
    // If there is no min listed for this slot, we require nothing (min = 0).
    let minSize = minSizes[slotId];

    if (minSize === undefined) {
      minSize = 0;
    }

    if (count < minSize) {
      reasons.push(
        'Slot "' + slotId + '" has ' + count +
          " people but needs at least " + minSize + "."
      );
    }

    // ----- maximum -----
    // If there is no max listed, there is no upper limit for this check.
    const maxSize = maxSizes[slotId];

    if (maxSize !== undefined) {
      if (count > maxSize) {
        reasons.push(
          'Slot "' + slotId + '" has ' + count +
            " people but allows at most " + maxSize + "."
        );
      }
    }
  }
}

/**
 * Check that no person holds more slots than allowed.
 *
 * Minimum version: one project-wide number, config.defaultSlotsPerPerson.
 * (Per-person overrides can be added later.)
 *
 * @param {Object} assignments
 * @param {Object} config
 * @param {string[]} reasons
 */
function checkSlotsPerPerson(assignments, config, reasons) {
  let maxSlots = config.defaultSlotsPerPerson;

  // If the caller forgot this field, assume 1 (most common case: teams).
  if (maxSlots === undefined) {
    maxSlots = 1;
  }

  const personIds = Object.keys(assignments);

  for (let i = 0; i < personIds.length; i = i + 1) {
    const personId = personIds[i];
    const held = getSlotsForPerson(assignments, personId).length;

    if (held > maxSlots) {
      reasons.push(
        'Person "' + personId + '" holds ' + held +
          " slots but may hold at most " + maxSlots + "."
      );
    }
  }
}

/**
 * Check conflict groups.
 *
 * Each group is a list of slot ids.
 * A person may hold AT MOST ONE slot from the same group.
 *
 * Example:
 *   conflictGroups: [ ["optics", "sounds"] ]
 *   Ava has ["optics", "sounds"] → illegal
 *   Ava has ["optics"]           → fine
 *
 * @param {Object} assignments
 * @param {Object} config
 * @param {string[]} reasons
 */
function checkConflictGroups(assignments, config, reasons) {
  let groups = config.conflictGroups;

  if (groups === undefined) {
    return;
  }

  const personIds = Object.keys(assignments);

  for (let i = 0; i < personIds.length; i = i + 1) {
    const personId = personIds[i];
    const slotsForPerson = getSlotsForPerson(assignments, personId);

    for (let g = 0; g < groups.length; g = g + 1) {
      const group = groups[g];
      const hits = [];

      // Which of this person's slots appear in this conflict group?
      for (let s = 0; s < slotsForPerson.length; s = s + 1) {
        const slotId = slotsForPerson[s];

        if (listContains(group, slotId) === true) {
          hits.push(slotId);
        }
      }

      if (hits.length > 1) {
        reasons.push(
          'Person "' + personId + '" holds conflicting slots: ' +
            hits.join(", ") + "."
        );
      }
    }
  }
}

/**
 * Small helper: is `value` one of the items in `list`?
 *
 * Written as a plain loop on purpose (easy to read).
 *
 * @param {string[]} list
 * @param {string} value
 * @returns {boolean}
 */
function listContains(list, value) {
  for (let i = 0; i < list.length; i = i + 1) {
    if (list[i] === value) {
      return true;
    }
  }

  return false;
}
