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
} from "../src/lib/selectors.js";

function createTestModel() {
  return createModel(
    structuredClone(items),
    structuredClone(slots),
    [],
    structuredClone(assignments),
  );
}

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

  assert.deepEqual(getItemById(model, "P1"), items[0]);
});

test("returns undefined for an unknown item ID", () => {
  const model = createTestModel();

  assert.equal(getItemById(model, "missing"), undefined);
});

test("finds a slot by ID", () => {
  const model = createTestModel();

  assert.deepEqual(getSlotById(model, "T1"), slots[0]);
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

  const teamCSlots = getSlotsWithAttribute(model, "id", "T3");

  assert.deepEqual(teamCSlots, [slots[2]]);
});

test("gets item attribute values", () => {
  const model = createTestModel();

  assert.deepEqual(getItemAttribute(model, "gender"), [
    "M",
    "M",
    "F",
    "M",
    "F",
    "F",
    "M",
    "F",
    "M",
    "F",
    "M",
    "F",
  ]);
});

test("gets slot attribute values", () => {
  const model = createTestModel();

  assert.deepEqual(getSlotAttribute(model, "division"), [
    "4/5",
    "6/7/8",
    "2/3",
    "K/1",
    "4/5",
  ]);
});

test("gets item IDs assigned to a slot", () => {
  const model = createTestModel();

  assert.deepEqual(getAssignedItemIds(model, "T1"), ["P1", "P4", "P12"]);
});

test("gets slot IDs assigned to an item", () => {
  const model = createTestModel();

  assert.deepEqual(getAssignedSlotIds(model, "P1"), ["T1"]);
});

test("gets assigned item records for a slot", () => {
  const model = createTestModel();

  const assignedItems = getAssignedItems(model, "T1");

  assert.deepEqual(
    assignedItems.map((item) => item.id),
    ["P1", "P4", "P12"],
  );
});

test("gets assigned slot records for an item", () => {
  const model = createTestModel();

  const assignedSlots = getAssignedSlots(model, "P1");

  assert.deepEqual(
    assignedSlots.map((slot) => slot.id),
    ["T1"],
  );
});
