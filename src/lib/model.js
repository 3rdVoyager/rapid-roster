import testItems from '../../tests/fixtures/items.json' with { type: 'json' };
import testSlots from '../../tests/fixtures/slots.json' with { type: 'json' };

const items = testItems; // TODO: replace with actual data later
const slots = testSlots; // TODO: replace with actual data later

export function getItems() {
  return items;
}

export function getSlots() {
  return slots;
}

export function getItemById(id) {
  try {
    return items.find(item => item.id === id);
  } catch (error) {
    console.error(`Error getting item by id: ${id}`, error);
    return null;
  }
}

export function getSlotById(id) {
  try {
    return slots.find(slot => slot.id === id);
  } catch (error) {
    console.error(`Error getting slot by id: ${id}`, error);
    return null;
  }
}
export function getItemsByAttribute(attribute, value) {
    try {
        return items.filter(item => item[attribute] === value);
    } catch (error) {
        console.error(`Error getting items by attribute: ${attribute}`, error);
        return [];
    }
}

export function getSlotsByAttribute(attribute, value) {
  try {
    return slots.filter(slot => slot[attribute] === value);
  } catch (error) {
    console.error(`Error getting slots by attribute: ${attribute}`, error);
    return [];
  }
}
