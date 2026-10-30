export function createRandomAssignments(model, random = Math.random) {
  const assignments = {};
  const slots = model.getSlots();

  if (slots.length === 0) {
    throw new Error("Cannot create an assignment without slots");
  }

  for (const slot of slots) {
    assignments[slot.id] = [];
  }

  const shuffledItems = shuffle([...model.getItems()], random);

  for (let index = 0; index < shuffledItems.length; index++) {
    const slot = slots[index % slots.length];
    assignments[slot.id].push(shuffledItems[index].id);
  }
  return assignments;
}

function shuffle(array, random) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}