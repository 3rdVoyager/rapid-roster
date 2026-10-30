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

    getItemAttributes() {
      for (const item of items) {
        for (const attribute in item) {
          attributes.push(attribute);
        }
      }
      return attributes;
    },

    getSlotAttributes() {
      for (const slot of slots) {
        for (const attribute in slot) {
          attributes.push(attribute);
        }
      }
      return attributes;
    },

    getItemAttribute(attribute) {
      return items.map((item) => item[attribute]);
    },

    getSlotAttribute(attribute) {
      return slots.map((slot) => slot[attribute]);
    },
  };
}
