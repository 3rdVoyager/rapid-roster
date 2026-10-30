import test from "node:test";
import assert from "node:assert/strict";

import items from "./fixtures/items.json" with { type: "json" };
import slots from "./fixtures/slots.json" with { type: "json" };

import { createModel } from "../src/lib/model.js";

function createTestModel() {
  return createModel(structuredClone(items), structuredClone(slots));
}

test("returns all items", () => {
  const model = createTestModel();

  assert.deepEqual(model.getItems(), items);
});

test("returns all slots", () => {
  const model = createTestModel();

  assert.deepEqual(model.getSlots(), slots);
});

test("finds an item by ID", () => {
  const model = createTestModel();

  assert.deepEqual(model.getItemById("P1"), items[0]);
});

test("returns undefined for an unknown item ID", () => {
  const model = createTestModel();

  assert.equal(model.getItemById("missing"), undefined);
});

test("finds a slot by ID", () => {
  const model = createTestModel();

  assert.deepEqual(model.getSlotById("T1"), slots[0]);
});

test("returns undefined for an unknown slot ID", () => {
  const model = createTestModel();

  assert.equal(model.getSlotById("missing"), undefined);
});

test("finds items by attribute", () => {
  const model = createTestModel();

  const maleItems = model.getItemsByAttribute("gender", "M");

  assert.ok(maleItems.length > 0);
  assert.ok(maleItems.every((item) => item.gender === "M"));
});

test("finds slots by attribute", () => {
  const model = createTestModel();

  const teamCSlots = model.getSlotsByAttribute("id", "T3");

  assert.deepEqual(teamCSlots, [slots[2]]);
});
