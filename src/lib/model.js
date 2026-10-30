export function createModel(items, slots) {
  return {
    getItems() {
      return items;
    },

    getSlots() {
      return slots;
    },

    getItemById(id) {
      return items.find((item) => item.id === id);
    },

    getSlotById(id) {
      return slots.find((slot) => slot.id === id);
    },

    getItemsByAttribute(attribute, value) {
        return items.filter((item) => item[attribute] === value);
    },

    getSlotsByAttribute(attribute, value) {
        return slots.filter((slot) => slot[attribute] === value);
    },
  };
}
