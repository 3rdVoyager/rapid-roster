import test from "node:test";
import assert from "node:assert/strict";

import items from "./fixtures/items.json" with { type: "json" };
import slots from "./fixtures/slots.json" with { type: "json" };

import { createModel } from "../src/lib/model.js";
import {
  addAssignment,
  createLegalAssignments,
  createRandomAssignments,
  moveAssignment,
  removeAssignment,
  swapAssignments,
} from "../src/lib/assignment.js";

function createTestModel(itemData = items, slotData = slots) {
  return createModel(structuredClone(itemData), structuredClone(slotData));
}

test("creates an array for every slot", () => {
  const model = createTestModel();
  const assignments = createRandomAssignments(model, () => 0);

  assert.deepEqual(
    Object.keys(assignments),
    slots.map((slot) => slot.id),
  );

  for (const slotId of Object.keys(assignments)) {
    assert.ok(Array.isArray(assignments[slotId]));
  }
});

test("assigns every item exactly once", () => {
  const model = createTestModel();
  const assignments = createRandomAssignments(model, () => 0);
  const assignedItemIds = Object.values(assignments).flat();

  assert.equal(assignedItemIds.length, items.length);
  assert.deepEqual(assignedItemIds.sort(), items.map((item) => item.id).sort());
});

test("keeps slot sizes balanced", () => {
  const model = createTestModel();
  const assignments = createRandomAssignments(model, () => 0);
  const sizes = Object.values(assignments).map((itemIds) => itemIds.length);

  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
});

test("does not mutate the model items while shuffling", () => {
  const model = createTestModel();
  const originalItems = structuredClone(model.items);

  createRandomAssignments(model, () => 0);

  assert.deepEqual(model.items, originalItems);
});

test("uses injected randomness consistently", () => {
  const firstAssignment = createRandomAssignments(createTestModel(), () => 0);
  const secondAssignment = createRandomAssignments(createTestModel(), () => 0);

  assert.deepEqual(firstAssignment, secondAssignment);
});

test("rejects creating a model without slots", () => {
  assert.throws(() => createTestModel(items, []), /Slots must not be empty/);
});

test("creates assignments that satisfy hard rules", () => {
  const model = createModel(
    [{ id: "I1" }, { id: "I2" }, { id: "I3" }, { id: "I4" }],
    [{ id: "S1" }, { id: "S2" }],
    [
      {
        id: "R1",
        name: "Limit slot size",
        enforcement: "hard",
        keyword: "limit",
        inputs: {
          source: "slots",
          target: 2,
        },
      },
    ],
  );

  const assignments = createLegalAssignments(model, () => 0);

  assert.deepEqual(
    Object.values(assignments).map((itemIds) => itemIds.length),
    [2, 2],
  );
});

test("restarts after an illegal candidate", () => {
  const model = createModel(
    [
      { id: "I1", division: "B" },
      { id: "I2", division: "A" },
    ],
    [
      { id: "S1", division: "A" },
      { id: "S2", division: "B" },
    ],
    [
      {
        id: "R1",
        name: "Match divisions",
        enforcement: "hard",
        keyword: "match",
        inputs: {
          source: { collection: "items", attribute: "division" },
          target: { collection: "slots", attribute: "division" },
        },
      },
    ],
  );

  let randomCalls = 0;
  const assignments = createLegalAssignments(model, () => {
    randomCalls += 1;
    return randomCalls === 1 ? 0.9 : 0;
  }, 2);

  assert.deepEqual(assignments, { S1: ["I2"], S2: ["I1"] });
  assert.equal(randomCalls, 2);
});

test("stops after the random restart limit", () => {
  const model = createModel(
    [{ id: "I1" }, { id: "I2" }],
    [{ id: "S1" }],
    [
      {
        id: "R1",
        name: "No assigned items",
        enforcement: "hard",
        keyword: "limit",
        inputs: {
          source: "slots",
          target: 0,
        },
      },
    ],
  );

  assert.throws(
    () => createLegalAssignments(model, () => 0, 3),
    /Could not create legal assignments after 3 random restarts/,
  );
});

test("adds an assignment without mutating the original", () => {
  const assignments = { S1: ["I1"], S2: [] };

  const nextAssignments = addAssignment(assignments, "S2", "I1");

  assert.deepEqual(nextAssignments, { S1: ["I1"], S2: ["I1"] });
  assert.deepEqual(assignments, { S1: ["I1"], S2: [] });
});

test("removes an assignment without mutating the original", () => {
  const assignments = { S1: ["I1", "I2"] };

  const nextAssignments = removeAssignment(assignments, "S1", "I1");

  assert.deepEqual(nextAssignments, { S1: ["I2"] });
  assert.deepEqual(assignments, { S1: ["I1", "I2"] });
});

test("moves an assignment between slots", () => {
  const assignments = { S1: ["I1"], S2: ["I2"] };

  assert.deepEqual(
    moveAssignment(assignments, "I1", "S1", "S2"),
    { S1: [], S2: ["I2", "I1"] },
  );
});

test("swaps assignments between slots", () => {
  const assignments = { S1: ["I1"], S2: ["I2"] };

  assert.deepEqual(
    swapAssignments(assignments, "S1", "I1", "S2", "I2"),
    { S1: ["I2"], S2: ["I1"] },
  );
});
