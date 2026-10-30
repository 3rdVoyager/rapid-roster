import test from "node:test";
import assert from "node:assert/strict";

import items from "./fixtures/items.json" with { type: "json" };
import slots from "./fixtures/slots.json" with { type: "json" };

import { validateData } from "../src/lib/validate.js";

function freshItems() {
  return structuredClone(items);
}

function freshSlots() {
  return structuredClone(slots);
}

test("valid fixtures pass validation", () => {
  assert.doesNotThrow(() => {
    validateData(freshItems(), freshSlots());
  });
});

test("missing item ID fails validation", () => {
  const testItems = freshItems();
  delete testItems[0].id;

  assert.throws(() => {
    validateData(testItems, freshSlots());
  });
});

test("duplicate item IDs fail validation", () => {
  const testItems = freshItems();
  testItems[1].id = testItems[0].id;

  assert.throws(() => {
    validateData(testItems, freshSlots());
  });
});

test("duplicate slot IDs fail validation", () => {
  const testSlots = freshSlots();
  testSlots[1].id = testSlots[0].id;

  assert.throws(() => {
    validateData(freshItems(), testSlots);
  });
});

test("item and slot ID collisions fail validation", () => {
  const testItems = freshItems();
  const testSlots = freshSlots();

  testSlots[0].id = testItems[0].id;

  assert.throws(() => {
    validateData(testItems, testSlots);
  });
});

test("items must be an array", () => {
  assert.throws(() => validateData({}, freshSlots()), /Items must be an array/);
});

test("slots must be an array", () => {
  assert.throws(() => validateData(freshItems(), {}), /Slots must be an array/);
});

test("items must not be empty", () => {
  assert.throws(
    () => validateData([], freshSlots()),
    /Items must not be empty/,
  );
});

test("slots must not be empty", () => {
  assert.throws(
    () => validateData(freshItems(), []),
    /Slots must not be empty/,
  );
});

test("items must contain objects", () => {
  assert.throws(
    () => validateData([null], freshSlots()),
    /Items must be an object/,
  );
});

test("arrays cannot be item records", () => {
  assert.throws(
    () => validateData([[]], freshSlots()),
    /Items must be an object/,
  );
});

test("invalid ID values fail validation", () => {
  const invalidIds = [true, {}, [], Number.NaN];

  for (const invalidId of invalidIds) {
    const testItems = freshItems();
    testItems[0].id = invalidId;

    assert.throws(
      () => validateData(testItems, freshSlots()),
      /Item has invalid id/,
    );
  }
});
