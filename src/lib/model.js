export function createModel(items, slots) {
  return {
    getItems() {
      return items;
    },

    getSlots() {
      return slots;
    },

    getItemById(id) {
      try {
        return items.find((item) => item.id === id);
      } catch (error) {
        console.error(`Error getting item by id: ${id}`, error);
        return null;
      }
    },

    getSlotById(id) {
      try {
        return slots.find((slot) => slot.id === id);
      } catch (error) {
        console.error(`Error getting slot by id: ${id}`, error);
        return null;
      }
    },

    getItemsByAttribute(attribute, value) {
      try {
        return items.filter((item) => item[attribute] === value);
      } catch (error) {
        console.error(`Error getting items by attribute: ${attribute}`, error);
        return [];
      }
    },

    getSlotsByAttribute(attribute, value) {
      try {
        return slots.filter((slot) => slot[attribute] === value);
      } catch (error) {
        console.error(`Error getting slots by attribute: ${attribute}`, error);
        return [];
      }
    },
  };
}
