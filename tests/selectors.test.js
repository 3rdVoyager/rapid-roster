import test from "node:test";
import assert from "node:assert/strict";

import items from "./fixtures/items.json" with { type: "json" };
import slots from "./fixtures/slots.json" with { type: "json" };
import assignments from "./fixtures/assignments.json" with { type: "json" };

import { createModel } from "../src/lib/model.js";
import {
  getItemById,
  getSlotById,
  getItemsWithAttribute,
  getSlotsWithAttribute,
  getItemAttribute,
  getSlotAttribute,
  getAssignedItemIds,
  getAssignedSlotIds,
  getAssignedItems,
  getAssignedSlots,
  getCoAssignedItems,
  getCoAssignedSlots,
} from "../src/lib/selectors.js";

function createTestModel() {
  return createModel(
    structuredClone(items),
    structuredClone(slots),
    [],
    structuredClone(assignments),
  );
}

const firstItemId = items[0].id;
const secondItemId = items[1].id;
const firstSlotId = slots[0].id;
const secondSlotId = slots[1].id;
const thirdSlotId = slots[2].id;

test("returns all items", () => {
  const model = createTestModel();

  assert.deepEqual(model.items, items);
});

test("returns all slots", () => {
  const model = createTestModel();

  assert.deepEqual(model.slots, slots);
});

test("finds an item by ID", () => {
  const model = createTestModel();

  assert.deepEqual(getItemById(model, firstItemId), items[0]);
});

test("finds numeric IDs after CSV string conversion", () => {
  const model = createModel(
    [{ id: 1, name: "Item 1" }],
    [{ id: 10, name: "Slot 10" }],
  );

  assert.deepEqual(getItemById(model, "1"), model.items[0]);
  assert.deepEqual(getSlotById(model, "10"), model.slots[0]);
});

test("returns undefined for an unknown item ID", () => {
  const model = createTestModel();

  assert.equal(getItemById(model, "missing"), undefined);
});

test("finds a slot by ID", () => {
  const model = createTestModel();

  assert.deepEqual(getSlotById(model, firstSlotId), slots[0]);
});

test("returns undefined for an unknown slot ID", () => {
  const model = createTestModel();

  assert.equal(getSlotById(model, "missing"), undefined);
});

test("finds items by attribute", () => {
  const model = createTestModel();

  const maleItems = getItemsWithAttribute(model, "gender", "M");

  assert.ok(maleItems.length > 0);
  assert.ok(maleItems.every((item) => item.gender === "M"));
});

test("finds slots by attribute", () => {
  const model = createTestModel();

  const teamCSlots = getSlotsWithAttribute(model, "id", thirdSlotId);

  assert.deepEqual(teamCSlots, [slots[2]]);
});

test("gets item attribute values", () => {
  const model = createTestModel();

  assert.deepEqual(
    getItemAttribute(model, "gender"),
    items.map((item) => item.gender),
  );
});

test("gets slot attribute values", () => {
  const model = createTestModel();

  assert.deepEqual(
    getSlotAttribute(model, "division"),
    slots.map((slot) => slot.division),
  );
});

test("gets item IDs assigned to a slot", () => {
  const model = createTestModel();

  assert.deepEqual(
    getAssignedItemIds(model, firstSlotId),
    assignments[firstSlotId],
  );
});

test("gets slot IDs assigned to an item", () => {
  const model = createTestModel();

  assert.deepEqual(getAssignedSlotIds(model, firstItemId), [firstSlotId]);
});

test("gets assigned item records for a slot", () => {
  const model = createTestModel();

  const assignedItems = getAssignedItems(model, firstSlotId);

  assert.deepEqual(
    assignedItems.map((item) => item.id),
    assignments[firstSlotId],
  );
});

test("gets assigned slot records for an item", () => {
  const model = createTestModel();

  const assignedSlots = getAssignedSlots(model, firstItemId);

  assert.deepEqual(
    assignedSlots.map((slot) => slot.id),
    [firstSlotId],
  );
});

test("finds every slot assigned to an item", () => {
  const model = createModel(
    structuredClone(items),
    structuredClone(slots),
    [],
    {
      [firstSlotId]: [firstItemId],
      [secondSlotId]: [firstItemId],
    },
  );

  assert.deepEqual(getAssignedSlotIds(model, firstItemId), [
    firstSlotId,
    secondSlotId,
  ]);
});

test("returns an empty list for an unassigned item", () => {
  const model = createModel(
    structuredClone(items),
    structuredClone(slots),
    [],
    {
      [firstSlotId]: [firstItemId],
    },
  );

  assert.deepEqual(getAssignedSlotIds(model, secondItemId), []);
  assert.deepEqual(getAssignedSlots(model, secondItemId), []);
});

test("returns an empty list for a slot with no assigned items", () => {
  const model = createModel(
    structuredClone(items),
    structuredClone(slots),
    [],
    {
      [firstSlotId]: [firstItemId],
      [thirdSlotId]: [],
    },
  );

  assert.deepEqual(getAssignedItemIds(model, thirdSlotId), []);
  assert.deepEqual(getAssignedItems(model, thirdSlotId), []);
});

test("gets other items assigned to the same slot", () => {
  const model = createTestModel();

  assert.deepEqual(
    getCoAssignedItems(model, firstItemId).map((item) => item.id),
    assignments[firstSlotId].filter((itemId) => itemId !== firstItemId),
  );
});

test("gets other slots sharing an item without duplicates", () => {
  const model = createModel(
    structuredClone(items),
    structuredClone(slots),
    [],
    {
      [firstSlotId]: [firstItemId, secondItemId],
      [secondSlotId]: [firstItemId, secondItemId],
      [thirdSlotId]: [items[2].id],
    },
  );

  assert.deepEqual(
    getCoAssignedSlots(model, firstSlotId).map((slot) => slot.id),
    [secondSlotId],
  );
});
