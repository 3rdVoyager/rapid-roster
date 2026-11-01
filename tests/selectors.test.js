import test from "node:test";
import assert from "node:assert/strict";

import items from "./fixtures/items.json" with { type: "json" };
import slots from "./fixtures/slots.json" with { type: "json" };

import { createModel } from "../src/lib/model.js";
import {
  getItemById,
  getSlotById,
  getItemsWithAttribute,
  getSlotsWithAttribute,
} from "../src/lib/selectors.js";

function createTestModel() {
  return createModel(structuredClone(items), structuredClone(slots));
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
