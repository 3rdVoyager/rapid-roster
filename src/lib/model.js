export function createModel(items, slots, rules = {}, assignments = {byItemId: {}, bySlotId: {}}) {
  return {
    items,
    slots,
    rules,
    assignments,
  };
}
