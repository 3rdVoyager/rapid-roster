import {
  validateAssignments,
  validateData,
  validateRules,
} from "./validate.js";

export function createModel(items, slots, rules = [], assignments = {}) {
  validateData(items, slots);
  validateRules(rules);
  validateAssignments(assignments, items, slots);

  const itemIdsByKey = new Map(items.map((item) => [String(item.id), item.id]));
  const slotIdsByKey = new Map(slots.map((slot) => [String(slot.id), slot.id]));
  const canonicalAssignments = Object.fromEntries(
    Object.entries(assignments).map(([slotId, itemIds]) => [
      slotIdsByKey.get(String(slotId)),
      itemIds.map((itemId) => itemIdsByKey.get(String(itemId))),
    ]),
  );
  const itemAssignments = {};

  for (const [slotId, itemIds] of Object.entries(canonicalAssignments)) {
    for (const itemId of itemIds) {
      if (!itemAssignments[itemId]) {
        itemAssignments[itemId] = [];
      }

      itemAssignments[itemId].push(slotId);
    }
  }

  return {
    items,
    slots,
    rules,
    assignments: {
      slotAssignments: canonicalAssignments,
      itemAssignments: itemAssignments,
    },
  };
}
