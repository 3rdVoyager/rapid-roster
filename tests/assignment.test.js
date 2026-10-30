import test from "node:test";
import assert from "node:assert/strict";

import items from "./fixtures/items.json" with { type: "json" };
import slots from "./fixtures/slots.json" with { type: "json" };

import { createModel } from "../src/lib/model.js";
import { createRandomAssignments } from "../src/lib/assignment.js";

function createTestModel(itemData = items, slotData = slots) {
  return createModel(structuredClone(itemData), structuredClone(slotData));
}

test("creates an array for every slot", () => {
  const model = createTestModel();
  const assignments = createRandomAssignments(model, () => 0);

  assert.deepEqual(Object.keys(assignments), slots.map((slot) => slot.id));

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
  const originalItems = structuredClone(model.getItems());

  createRandomAssignments(model, () => 0);

  assert.deepEqual(model.getItems(), originalItems);
});

test("uses injected randomness consistently", () => {
  const firstAssignment = createRandomAssignments(
    createTestModel(),
    () => 0,
  );
  const secondAssignment = createRandomAssignments(
    createTestModel(),
    () => 0,
  );

  assert.deepEqual(firstAssignment, secondAssignment);
});

test("rejects a model without slots", () => {
  const model = createTestModel(items, []);

  assert.throws(
    () => createRandomAssignments(model, () => 0),
    /Cannot create an assignment without slots/,
  );
});
