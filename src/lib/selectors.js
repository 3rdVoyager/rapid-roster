export function getItemById(model, id) {
  return model.items.find((item) => item.id === id);
}

export function getSlotById(model, id) {
  return model.slots.find((slot) => slot.id === id);
}

export function getItemsWithAttribute(model, attribute, value) {
  return model.items.filter((item) => item[attribute] === value);
}

export function getSlotsWithAttribute(model, attribute, value) {
  return model.slots.filter((slot) => slot[attribute] === value);
}

export function getItemAttributes(model) {
  const attributes = [];
  for (const item of model.items) {
    for (const attribute in item) {
      attributes.push(attribute);
    }
  }
  return attributes;
}

export function getSlotAttributes(model) {
  const attributes = [];
  for (const slot of model.slots) {
    for (const attribute in slot) {
      attributes.push(attribute);
    }
  }
  return attributes;
}

export function getItemAttribute(model, attribute) {
  return model.items.map((item) => item[attribute]);
}

export function getSlotAttribute(model, attribute) {
  return model.slots.map((slot) => slot[attribute]);
}

export function getAssignedItemIds(model, slotId) {
  return model.assignments.slotAssignments[slotId] || [];
}

export function getAssignedSlotIds(model, itemId) {
  return model.assignments.itemAssignments[itemId] || [];
}

export function getAssignedItems(model, slotId) {
  const itemIds = getAssignedItemIds(model, slotId);

  return itemIds.map((itemId) => getItemById(model, itemId));
}

export function getAssignedSlots(model, itemId) {
  const slotIds = getAssignedSlotIds(model, itemId);

  return slotIds.map((slotId) => getSlotById(model, slotId));
}
