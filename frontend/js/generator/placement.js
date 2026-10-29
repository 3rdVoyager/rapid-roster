/**
 * placement.js
 *
 * This file answers one question:
 *   "Who is assigned to which slots right now?"
 *
 * It does NOT check rules. It does NOT score anything.
 * It only reads and changes the assignment map.
 *
 * ---------------------------------------------------------------------------
 * What an "assignments" object looks like
 * ---------------------------------------------------------------------------
 *
 * We store placements as a plain object:
 *
 *   assignments = {
 *     "person-id-1": ["slot-id-a"],
 *     "person-id-2": ["slot-id-a", "slot-id-b"],
 *     "person-id-3": []
 *   }
 *
 * - Each KEY is a person's id (a string).
 * - Each VALUE is an array of slot ids that person currently holds.
 * - An empty array [] means that person is not in any slot yet.
 *
 * Why this shape?
 * - Easy to look up: "which slots does Ava have?"
 * - Works when people may hold more than one slot (events, shifts, etc.).
 *
 * Important habit:
 * - These helpers never change the object you pass in.
 * - They return a NEW assignments object (or a new array) instead.
 * - That makes undo / "try a move then reject it" much safer later.
 */

/**
 * Create a blank assignments map for a list of people.
 *
 * Example:
 *   createEmptyAssignments(["a", "b"])
 *   → { "a": [], "b": [] }
 *
 * @param {string[]} entryIds - list of person id strings
 * @returns {Object} assignments object with every person starting empty
 */
export function createEmptyAssignments(entryIds) {
  const assignments = {};

  for (let i = 0; i < entryIds.length; i = i + 1) {
    const entryId = entryIds[i];
    assignments[entryId] = [];
  }

  return assignments;
}

/**
 * Make a full copy of an assignments object.
 *
 * Why copy at all?
 *   Helpers below return NEW maps instead of editing the one you pass in.
 *   That way the search can try a move, and throw it away if it is illegal.
 *
 * Why not:  const copy = assignments  ?
 *   That only copies the *reference*. Both names point at the same object.
 *
 * Why not:  const copy = { ...assignments }  (spread)?
 *   That copies the outer object, but the arrays inside are still shared.
 *   Changing copy["ava"] would also change the original.
 *
 * So we:
 *   1. Create a new empty object
 *   2. For each person id, copy their slot-id array with .slice()
 *
 * Object.keys(obj) → array of that object's own property names (the person ids).
 *
 * @param {Object} assignments
 * @returns {Object} a new assignments object with the same contents
 */
export function copyAssignments(assignments) {
  const copy = {};
  const entryIds = Object.keys(assignments);

  for (let i = 0; i < entryIds.length; i = i + 1) {
    const entryId = entryIds[i];
    const slots = assignments[entryId];

    // .slice() with no args copies every item into a new array.
    if (slots === undefined) {
      copy[entryId] = [];
    } else {
      copy[entryId] = slots.slice();
    }
  }

  return copy;
}

/**
 * Get the list of slot ids for one person.
 *
 * If that person is missing from the map, return an empty list
 * so callers do not have to special-case "undefined".
 *
 * @param {Object} assignments
 * @param {string} entryId
 * @returns {string[]} slot ids (may be empty)
 */
export function getSlotsForEntry(assignments, entryId) {
  const slots = assignments[entryId];

  if (slots === undefined) {
    return [];
  }

  // Return a copy so callers cannot accidentally change the original array.
  return slots.slice();
}

/**
 * True if this person currently holds this slot.
 *
 * @param {Object} assignments
 * @param {string} entryId
 * @param {string} slotId
 * @returns {boolean}
 */
export function entryIsInSlot(assignments, entryId, slotId) {
  const slots = getSlotsForEntry(assignments, entryId);

  for (let i = 0; i < slots.length; i = i + 1) {
    if (slots[i] === slotId) {
      return true;
    }
  }

  return false;
}

/**
 * List every person currently assigned to a given slot.
 *
 * This walks the whole assignments map. That is fine for typical
 * roster sizes (dozens or low hundreds of people).
 *
 * @param {Object} assignments
 * @param {string} slotId
 * @returns {string[]} person ids in that slot
 */
export function getEntriesInSlot(assignments, slotId) {
  const entriesInSlot = [];
  // Object.keys(obj) → array of property names (here: every person id).
  const entryIds = Object.keys(assignments);

  for (let i = 0; i < entryIds.length; i = i + 1) {
    const entryId = entryIds[i];

    if (entryIsInSlot(assignments, entryId, slotId) === true) {
      entriesInSlot.push(entryId);
    }
  }

  return entriesInSlot;
}

/**
 * Put a person into a slot.
 *
 * Rules for this helper (not project rules — just placement safety):
 * - If they are already in that slot, return a copy unchanged.
 * - Otherwise add the slot id to their list.
 *
 * Does NOT check max size, conflict groups, or hard rules.
 * legal.js will do that later.
 *
 * @param {Object} assignments
 * @param {string} entryId
 * @param {string} slotId
 * @returns {Object} new assignments object
 */
export function addEntryToSlot(assignments, entryId, slotId) {
  const next = copyAssignments(assignments);

  // Make sure this person exists in the map.
  if (next[entryId] === undefined) {
    next[entryId] = [];
  }

  // Already there? Nothing to add.
  if (entryIsInSlot(next, entryId, slotId) === true) {
    return next;
  }

  next[entryId].push(slotId);
  return next;
}

/**
 * Remove a person from a slot.
 *
 * If they were not in that slot, return a copy unchanged.
 *
 * @param {Object} assignments
 * @param {string} entryId
 * @param {string} slotId
 * @returns {Object} new assignments object
 */
export function removeEntryFromSlot(assignments, entryId, slotId) {
  const next = copyAssignments(assignments);

  if (next[entryId] === undefined) {
    next[entryId] = [];
    return next;
  }

  const keptSlots = [];
  const currentSlots = next[entryId];

  for (let i = 0; i < currentSlots.length; i = i + 1) {
    const currentSlotId = currentSlots[i];

    // Keep every slot that is NOT the one we want to remove.
    if (currentSlotId !== slotId) {
      keptSlots.push(currentSlotId);
    }
  }

  next[entryId] = keptSlots;
  return next;
}

/**
 * Move a person from one slot to another.
 *
 * Steps:
 * 1. Remove them from fromSlotId
 * 2. Add them to toSlotId
 *
 * If from and to are the same, just return a copy.
 *
 * @param {Object} assignments
 * @param {string} entryId
 * @param {string} fromSlotId
 * @param {string} toSlotId
 * @returns {Object} new assignments object
 */
export function moveEntry(assignments, entryId, fromSlotId, toSlotId) {
  if (fromSlotId === toSlotId) {
    return copyAssignments(assignments);
  }

  let next = removeEntryFromSlot(assignments, entryId, fromSlotId);
  next = addEntryToSlot(next, entryId, toSlotId);
  return next;
}

/**
 * Swap the slot lists of two people.
 *
 * Example:
 *   Ava had ["Team A"], Bob had ["Team B"]
 *   after swap: Ava has ["Team B"], Bob has ["Team A"]
 *
 * This is one of the move types search.js will try later.
 *
 * @param {Object} assignments
 * @param {string} entryIdA
 * @param {string} entryIdB
 * @returns {Object} new assignments object
 */
export function swapEntries(assignments, entryIdA, entryIdB) {
  const next = copyAssignments(assignments);

  // If a person is missing, treat them as holding no slots.
  let slotsA = next[entryIdA];
  let slotsB = next[entryIdB];

  if (slotsA === undefined) {
    slotsA = [];
  }

  if (slotsB === undefined) {
    slotsB = [];
  }

  // Give each person a copy of the other's list.
  next[entryIdA] = slotsB.slice();
  next[entryIdB] = slotsA.slice();

  return next;
}
