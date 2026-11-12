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
