import { validateData } from "./validate.js";

export function createModel(items, slots, rules = [], assignments = {}) {
  validateData(items, slots);

  const itemAssignments = {};

  for (const [slotId, itemIds] of Object.entries(assignments)) {
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
      slotAssignments: assignments,
      itemAssignments: itemAssignments,
    },
  };
}
