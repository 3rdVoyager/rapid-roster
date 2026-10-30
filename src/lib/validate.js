
export function validateData(items, slots) {
  try {
    validateShape(items, slots);
    validateIds(items, slots);
  } catch (error) {
    // TODO: Handle error (Show toast message)
  }
}

export function validateShape(items, slots) {
  if (!Array.isArray(items)) {
    throw new Error("Items must be an array");
  }

  if (items.length === 0) {
    throw new Error("Items must not be empty");
  }

  for (const item of items) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error("Items must be an object");
    }
  }

  if (!Array.isArray(slots)) {
    throw new Error("Slots must be an array");
  }

  if (slots.length === 0) {
    throw new Error("Slots must not be empty");
  }

  for (const slot of slots) {
    if (typeof slot !== "object" || slot === null || Array.isArray(slot)) {
      throw new Error("Slots must be an object");
    }
  }
}

export function validateIds(items, slots) {
  const itemIds = new Set();
  const slotIds = new Set();

  for (const item of items) {
    if (!isValidId(item.id)) {
      throw new Error(`Item has invalid id: ${JSON.stringify(item)}`);
    }

    if (itemIds.has(item.id)) {
      throw new Error(`Duplicate item id: ${item.id}`);
    }

    itemIds.add(item.id);
  }

  for (const slot of slots) {
    if (!isValidId(slot.id)) {
      throw new Error(`Slot has invalid id: ${JSON.stringify(slot)}`);
    }

    if (slotIds.has(slot.id)) {
      throw new Error(`Duplicate slot id: ${slot.id}`);
    }

    if (itemIds.has(slot.id)) {
      throw new Error(`Item and slot have the same id: ${slot.id}`);
    }

    slotIds.add(slot.id);
  }
}

function isValidId(id) {
  return (
    (id !== undefined &&
      id !== null &&
      id !== "" &&
      typeof id === "string" &&
      id.trim() !== "") ||
    (typeof id === "number" && Number.isFinite(id))
  );
}
