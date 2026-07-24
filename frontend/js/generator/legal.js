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
 * One JS habit used a lot in this file
 * ---------------------------------------------------------------------------
 *
 * Object.keys(assignments)
 *   Returns an array of the object's own property names.
 *   For an assignments map, that list is every person id.
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
 *     // - a number  → same minimum for EVERY slot (example: 5)
 *     // - an object → per-slot minimums (missing slot id → 0)
 *     slotMinSizes: 5,
 *     // or: slotMinSizes: { "t1": 5, "t2": 4 },
 *
 *     // Optional: maximum people allowed in each slot
 *     // - a number  → same maximum for EVERY slot
 *     // - an object → per-slot maximums
 *     // - missing / missing slot id → default:
 *     //     ceil(number of people / number of slots)
 *     //   (so total seats can still fit everyone)
 *     slotMaxSizes: 5,
 *     // or: slotMaxSizes: { "t1": 5, "t2": 6 },
 *
 *     // How many slots one person may hold (project default)
 *     defaultSlotsPerEntry: 1,
 *
 *     // Groups of slot ids that the same person cannot hold together
 *     // Example: someone cannot be in both "optics" and "sounds" at once
 *     conflictGroups: [
 *       ["optics", "sounds"]
 *     ]
 *   }
 */

import {
  getSlotsForEntry,
  getEntriesInSlot
} from "./placement.js";

/**
 * Main entry point.
 *
 * Runs every setup check. Collects ALL problems it finds
 * (not just the first one), so the UI can show a full list.
 *
 * @param {Object} assignments - entryId → array of slotIds
 * @param {Object} config - see file header for shape
 * @returns {{ ok: boolean, reasons: string[] }}
 */
export function checkLegal(assignments, config) {
  const reasons = [];

  // Run each family of checks. Each helper ADDS strings onto `reasons`.
  checkUnknownSlots(assignments, config, reasons);
  checkSlotSizes(assignments, config, reasons);
  checkSlotsPerEntry(assignments, config, reasons);
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

  const entryIds = Object.keys(assignments); // property names = person ids

  for (let i = 0; i < entryIds.length; i = i + 1) {
    const entryId = entryIds[i];
    const slotsForEntry = getSlotsForEntry(assignments, entryId);

    for (let j = 0; j < slotsForEntry.length; j = j + 1) {
      const slotId = slotsForEntry[j];

      if (listContains(knownSlotIds, slotId) === false) {
        reasons.push(
          'Entry "' + entryId + '" is assigned to unknown slot "' + slotId + '".'
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

  const minSizes = config.slotMinSizes;
  const maxSizes = config.slotMaxSizes;

  // Default max when the user did not set one:
  //   people ÷ slots, rounded UP so there are enough seats in total.
  // Example: 10 people, 3 slots → default max 4 per slot.
  const entryCount = Object.keys(assignments).length;
  const slotCount = slotIds.length;
  let defaultMaxSize = undefined;

  if (slotCount > 0) {
    defaultMaxSize = Math.ceil(entryCount / slotCount);
  }

  for (let i = 0; i < slotIds.length; i = i + 1) {
    const slotId = slotIds[i];
    const count = getEntriesInSlot(assignments, slotId).length;

    // ----- minimum -----
    // If there is no min for this slot, we require nothing (min = 0).
    let minSize = sizeForSlot(minSizes, slotId);

    if (minSize === undefined) {
      minSize = 0;
    }

    if (count < minSize) {
      reasons.push(
        'Slot "' + slotId + '" has ' + count +
          " entries but needs at least " + minSize + "."
      );
    }

    // ----- maximum -----
    // Use the configured max when present; otherwise the people/slots default.
    let maxSize = sizeForSlot(maxSizes, slotId);

    if (maxSize === undefined) {
      maxSize = defaultMaxSize;
    }

    if (maxSize !== undefined) {
      if (count > maxSize) {
        reasons.push(
          'Slot "' + slotId + '" has ' + count +
            " entries but allows at most " + maxSize + "."
        );
      }
    }
  }
}

/**
 * Read a size for one slot from config.
 *
 * sizes can be:
 *   - a number  → use that same value for every slot
 *   - an object → use sizes[slotId] (may be undefined)
 *   - undefined → no size configured
 *
 * @param {number|Object|undefined} sizes
 * @param {string} slotId
 * @returns {number|undefined}
 */
function sizeForSlot(sizes, slotId) {
  if (sizes === undefined) {
    return undefined;
  }

  // Same size for every slot: slotMinSizes: 5
  if (typeof sizes === "number") {
    return sizes;
  }

  // Per-slot map: slotMinSizes: { "t1": 5, "t2": 4 }
  return sizes[slotId];
}

/**
 * Check that no person holds more slots than allowed.
 *
 * Minimum version: one project-wide number, config.defaultSlotsPerEntry.
 * (Per-person overrides can be added later.)
 *
 * @param {Object} assignments
 * @param {Object} config
 * @param {string[]} reasons
 */
function checkSlotsPerEntry(assignments, config, reasons) {
  let maxSlots = config.defaultSlotsPerEntry;

  // If the caller forgot this field, assume 1 (most common case: teams).
  if (maxSlots === undefined) {
    maxSlots = 1;
  }

  const entryIds = Object.keys(assignments); // property names = person ids

  for (let i = 0; i < entryIds.length; i = i + 1) {
    const entryId = entryIds[i];
    const held = getSlotsForEntry(assignments, entryId).length;

    if (held > maxSlots) {
      reasons.push(
        'Entry "' + entryId + '" holds ' + held +
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

  const entryIds = Object.keys(assignments); // property names = person ids

  for (let i = 0; i < entryIds.length; i = i + 1) {
    const entryId = entryIds[i];
    const slotsForEntry = getSlotsForEntry(assignments, entryId);

    for (let g = 0; g < groups.length; g = g + 1) {
      const group = groups[g];
      const hits = [];

      // Which of this person's slots appear in this conflict group?
      for (let s = 0; s < slotsForEntry.length; s = s + 1) {
        const slotId = slotsForEntry[s];

        if (listContains(group, slotId) === true) {
          hits.push(slotId);
        }
      }

      if (hits.length > 1) {
        reasons.push(
          'Entry "' + entryId + '" holds conflicting slots: ' +
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
