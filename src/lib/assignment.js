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
  maxAttempts = 100,
) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("Max attempts must be a positive integer");
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
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
    `Could not create legal assignments after ${maxAttempts} attempts`,
  );
}

function shuffle(array, random) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
