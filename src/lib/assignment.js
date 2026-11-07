import { createModel } from "./model.js";
import { scoreModel } from "./scoring.js";

export function createRandomAssignments(model, random = Math.random) {
  const assignments = {};
  const slots = model.slots;

  if (slots.length === 0) {
    throw new Error("Cannot create an assignment without slots");
  }

  for (const slot of slots) {
    assignments[slot.id] = [];
  }

  const shuffledItems = shuffle([...model.items], random);

  for (let index = 0; index < shuffledItems.length; index++) {
    const slot = slots[index % slots.length];
    assignments[slot.id].push(shuffledItems[index].id);
  }
  return assignments;
}

export function createLegalAssignments(
  model,
  random = Math.random,
  maxRestarts = 100,
) {
  if (!Number.isInteger(maxRestarts) || maxRestarts < 1) {
    throw new Error("Max restarts must be a positive integer");
  }

  for (let restart = 0; restart < maxRestarts; restart++) {
    const assignments = createRandomAssignments(model, random);
    const candidateModel = createModel(
      model.items,
      model.slots,
      model.rules,
      assignments,
    );
    const score = scoreModel(candidateModel);

    if (score.legal) {
      return assignments;
    }
  }

  throw new Error(
    `Could not create legal assignments after ${maxRestarts} random restarts`,
  );
}

export function addAssignment(assignments, slotId, itemId) {
  const nextAssignments = cloneAssignments(assignments);
  const itemIds = nextAssignments[slotId] ?? [];

  if (!itemIds.includes(itemId)) {
    itemIds.push(itemId);
  }
  nextAssignments[slotId] = itemIds;

  return nextAssignments;
}

export function removeAssignment(assignments, slotId, itemId) {
  const nextAssignments = cloneAssignments(assignments);
  const itemIds = nextAssignments[slotId] ?? [];

  nextAssignments[slotId] = itemIds.filter(
    (assignedItemId) => assignedItemId !== itemId,
  );

  return nextAssignments;
}

export function moveAssignment(
  assignments,
  itemId,
  fromSlotId,
  toSlotId,
) {
  if (fromSlotId === toSlotId) {
    throw new Error("Move requires different slots");
  }

  if (!(assignments[fromSlotId] ?? []).includes(itemId)) {
    throw new Error(`Item is not assigned to slot: ${itemId}, ${fromSlotId}`);
  }

  return addAssignment(
    removeAssignment(assignments, fromSlotId, itemId),
    toSlotId,
    itemId,
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
  nextAssignments[firstSlotId] = nextAssignments[firstSlotId].map(
    (itemId) => (itemId === firstItemId ? secondItemId : itemId),
  );
  nextAssignments[secondSlotId] = nextAssignments[secondSlotId].map(
    (itemId) => (itemId === secondItemId ? firstItemId : itemId),
  );

  return nextAssignments;
}

function shuffle(array, random) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function cloneAssignments(assignments) {
  return Object.fromEntries(
    Object.entries(assignments).map(([slotId, itemIds]) => [
      slotId,
      [...itemIds],
    ]),
  );
}
