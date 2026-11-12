import { isItemCompatibleWithSlot } from "./keywords/helpers.js";

export function assignItemToSlot(
  itemId,
  itemOptionsById,
  assignments,
  slotLimits,
  visitedItems = new Set(),
  visitedSlots = new Set(),
) {
  if (visitedItems.has(itemId)) {
    return false;
  }
  visitedItems.add(itemId);

  const compatibleSlots = itemOptionsById
    .get(itemId)
    .compatibleSlots.slice()
    .sort((first, second) =>
      compareSlotCapacity(first, second, assignments, slotLimits),
    );

  for (const slot of compatibleSlots) {
    if (visitedSlots.has(slot.id)) {
      continue;
    }
    visitedSlots.add(slot.id);
    const assignedItemIds = assignments[slot.id];
    if (assignedItemIds.length < slotLimits[slot.id].maximum) {
      assignedItemIds.push(itemId);
      return true;
    }

    for (const displacedItemId of [...assignedItemIds]) {
      const displacedIndex = assignedItemIds.indexOf(displacedItemId);
      assignedItemIds.splice(displacedIndex, 1);
      if (
        assignItemToSlot(
          displacedItemId,
          itemOptionsById,
          assignments,
          slotLimits,
          visitedItems,
          visitedSlots,
        )
      ) {
        assignedItemIds.push(itemId);
        return true;
      }
      assignedItemIds.splice(displacedIndex, 0, displacedItemId);
    }
  }

  return false;
}

function compareSlotCapacity(firstSlot, secondSlot, assignments, slotLimits) {
  const firstCount = assignments[firstSlot.id].length;
  const secondCount = assignments[secondSlot.id].length;
  const firstBelowMinimum =
    firstCount < slotLimits[firstSlot.id].minimum;
  const secondBelowMinimum =
    secondCount < slotLimits[secondSlot.id].minimum;

  if (firstBelowMinimum !== secondBelowMinimum) {
    return firstBelowMinimum ? -1 : 1;
  }
  return firstCount - secondCount;
}

export function cloneAssignments(assignments) {
  return Object.fromEntries(
    Object.entries(assignments).map(([slotId, itemIds]) => [
      slotId,
      [...itemIds],
    ]),
  );
}

export function swapAssignments(
  assignments,
  firstSlotId,
  firstItemId,
  secondSlotId,
  secondItemId,
) {
  if (firstSlotId === secondSlotId || firstItemId === secondItemId) {
    throw new Error("Swap requires two different assignments");
  }

  if (
    !(assignments[firstSlotId] ?? []).includes(firstItemId) ||
    !(assignments[secondSlotId] ?? []).includes(secondItemId)
  ) {
    throw new Error("Cannot swap an unassigned item");
  }

  const nextAssignments = cloneAssignments(assignments);
  nextAssignments[firstSlotId] = nextAssignments[firstSlotId].map((itemId) =>
    itemId === firstItemId ? secondItemId : itemId,
  );
  nextAssignments[secondSlotId] = nextAssignments[secondSlotId].map((itemId) =>
    itemId === secondItemId ? firstItemId : itemId,
  );

  return nextAssignments;
}

export function applySwapToModel(model, swap) {
  const firstSlotItems = model.assignments.slotAssignments[swap.firstSlotId] ?? [];
  const secondSlotItems =
    model.assignments.slotAssignments[swap.secondSlotId] ?? [];
  const firstItemIndex = firstSlotItems.indexOf(swap.firstItemId);
  const secondItemIndex = secondSlotItems.indexOf(swap.secondItemId);
  if (firstItemIndex === -1 || secondItemIndex === -1) {
    throw new Error("Cannot apply candidate swap to the model");
  }

  firstSlotItems[firstItemIndex] = swap.secondItemId;
  secondSlotItems[secondItemIndex] = swap.firstItemId;
  const firstItemAssignment = replaceAssignedSlot(
    model,
    swap.firstItemId,
    swap.firstSlotId,
    swap.secondSlotId,
  );
  const secondItemAssignment = replaceAssignedSlot(
    model,
    swap.secondItemId,
    swap.secondSlotId,
    swap.firstSlotId,
  );

  return () => {
    firstSlotItems[firstItemIndex] = swap.firstItemId;
    secondSlotItems[secondItemIndex] = swap.secondItemId;
    firstItemAssignment.undo();
    secondItemAssignment.undo();
  };
}

function replaceAssignedSlot(model, itemId, previousSlotId, nextSlotId) {
  const assignedSlotIds = model.assignments.itemAssignments[itemId] ?? [];
  const slotIndex = assignedSlotIds.indexOf(previousSlotId);
  if (slotIndex === -1) {
    throw new Error("Cannot update candidate item assignment");
  }
  assignedSlotIds[slotIndex] = nextSlotId;
  return {
    undo() {
      assignedSlotIds[slotIndex] = previousSlotId;
    },
  };
}

export function createInitialAssignments(model) {
  const assignments = Object.fromEntries(
    model.slots.map((slot) => [slot.id, []]),
  );
  const hardMatchRules = model.rules.filter(
    (rule) => rule.enforcement === "hard" && rule.keyword === "match",
  );
  const hardLimitRules = model.rules.filter(
    (rule) => rule.enforcement === "hard" && rule.keyword === "limit",
  );
  const slotLimits = Object.fromEntries(
    model.slots.map((slot) => [slot.id, getSlotLimits(hardLimitRules, slot.id)]),
  );
  const invalidLimitSlots = model.slots.filter(
    (slot) => slotLimits[slot.id].minimum > slotLimits[slot.id].maximum,
  );

  if (invalidLimitSlots.length > 0) {
    throw new Error(
      "Cannot create compatible assignments: minimum slot size exceeds " +
        "maximum for slots: " +
        invalidLimitSlots.map((slot) => slot.id).join(", "),
    );
  }

  const itemOptions = model.items.map((item) => ({
    item,
    compatibleSlots: model.slots.filter((slot) =>
      hardMatchRules.every((rule) =>
        isItemCompatibleWithSlot(item, slot, rule),
      ),
    ),
  }));
  const incompatibleItems = itemOptions.filter(
    ({ compatibleSlots }) => compatibleSlots.length === 0,
  );

  if (incompatibleItems.length > 0) {
    const error = new Error(
      "Could not create compatible assignments for items: " +
        incompatibleItems.map(({ item }) => item.id).join(", "),
    );
    error.incompatibleItemIds = incompatibleItems.map(({ item }) => item.id);
    throw error;
  }

  itemOptions.sort(
    (first, second) =>
      first.compatibleSlots.length - second.compatibleSlots.length,
  );
  const itemOptionsById = new Map(
    itemOptions.map((itemOption) => [itemOption.item.id, itemOption]),
  );

  for (const { item } of itemOptions) {
    if (
      !assignItemToSlot(item.id, itemOptionsById, assignments, slotLimits)
    ) {
      const error = new Error(
        `Could not create compatible assignments within slot limits for item: ${item.id}`,
      );
      error.incompatibleItemIds = [item.id];
      throw error;
    }
  }

  const underfilledSlotIds = model.slots
    .filter(
      (slot) => assignments[slot.id].length < slotLimits[slot.id].minimum,
    )
    .map((slot) => slot.id);
  if (underfilledSlotIds.length > 0) {
    const error = new Error(
      "Could not satisfy minimum slot limits for slots: " +
        underfilledSlotIds.join(", "),
    );
    error.underfilledSlotIds = underfilledSlotIds;
    throw error;
  }

  return assignments;
}

function getSlotLimits(limitRules, slotId) {
  return limitRules.reduce(
    (limits, rule) => {
      const [limitType, limit, slotTargets] = rule.inputs;
      const appliesToSlot =
        slotTargets === "all" ||
        slotTargets.some(
          (targetSlotId) => String(targetSlotId) === String(slotId),
        );
      if (!appliesToSlot) {
        return limits;
      }

      if (limitType === "min") {
        limits.minimum = Math.max(limits.minimum, limit);
      } else {
        limits.maximum = Math.min(limits.maximum, limit);
      }
      return limits;
    },
    { minimum: 0, maximum: Number.POSITIVE_INFINITY },
  );
}
