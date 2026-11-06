export function validateData(items, slots) {
  validateShape(items, slots);
  validateIds(items, slots);
}

const supportedKeywords = new Set([
  "match",
  "equalize",
  "limit",
  "balance",
  "distribute",
  "align",
]);

export function validateRules(rules) {
  if (!Array.isArray(rules)) {
    throw new Error("Rules must be an array");
  }

  for (const rule of rules) {
    validateRule(rule);
  }
}

export function validateRule(rule) {
  if (typeof rule !== "object" || rule === null || Array.isArray(rule)) {
    throw new Error("Rule must be an object");
  }

  if (!isValidId(rule.id)) {
    throw new Error("Rule has invalid id");
  }

  if (rule.enforcement !== "hard" && rule.enforcement !== "soft") {
    throw new Error(`Unknown enforcement ${rule.enforcement}`);
  }

  if (!supportedKeywords.has(rule.keyword)) {
    throw new Error(`Unknown keyword: ${rule.keyword}`);
  }

  if (
    typeof rule.inputs !== "object" ||
    rule.inputs === null ||
    Array.isArray(rule.inputs) ||
    !rule.inputs.source ||
    !rule.inputs.target
  ) {
    throw new Error(`Invalid inputs for rule: ${rule.id}`);
  }

  if (rule.enforcement === "soft") {
    if (
      typeof rule.priority !== "number" ||
      !Number.isFinite(rule.priority) ||
      rule.priority < 1 ||
      rule.priority > 100
    ) {
      throw new Error(`Invalid priority for rule: ${rule.id}`);
    }
  }
}

export function validateAssignments(assignments, items, slots) {
  if (
    typeof assignments !== "object" ||
    assignments === null ||
    Array.isArray(assignments)
  ) {
    throw new Error("Assignments must be an object");
  }

  const itemIds = new Set(items.map((item) => String(item.id)));
  const slotIds = new Set(slots.map((slot) => String(slot.id)));

  for (const [slotId, assignedItemIds] of Object.entries(assignments)) {
    if (!slotIds.has(String(slotId))) {
      throw new Error(`Assignment references unknown slot: ${slotId}`);
    }

    if (!Array.isArray(assignedItemIds)) {
      throw new Error(`Assignments for slot must be an array: ${slotId}`);
    }

    const seenItemIds = new Set();
    for (const itemId of assignedItemIds) {
      if (!itemIds.has(String(itemId))) {
        throw new Error(
          `Assignment references unknown item: ${String(itemId)}`,
        );
      }

      if (seenItemIds.has(String(itemId))) {
        throw new Error(
          `Duplicate item assignment in slot: ${slotId}, ${String(itemId)}`,
        );
      }
      seenItemIds.add(String(itemId));
    }
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
